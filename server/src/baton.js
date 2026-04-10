// server/src/baton.js
// ADAGIO EDU live radio pipeline:
//   UDP discovery (port 5010) → pairing ACK (port 5011) → NRF24 receive → broadcastTelemetry

import dgram from 'dgram';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Constants ──────────────────────────────────────────────────────────────────
const DISCOVERY_PORT    = 5010;       // RPi listens for ADAGIO beacons
const PAIRING_PORT      = 5011;       // ADAGIO listens for pairing ACK
const NRF_CHANNEL       = 108;
const NRF_CE_PIN        = 22;         // BCM GPIO22 — confirm against BATON schematic
const NRF_CSN_PIN       = 0;          // SPI CE0 (/dev/spidev0.0)
const PIPE_ADDR_BASE    = [0x41, 0x44, 0x47, 0x00];  // 'A','D','G',\x00
const DEVICE_TIMEOUT_MS = 30000;      // Remove device if no beacon for 30 s

// ── Device Registry ────────────────────────────────────────────────────────────
// deviceId (string) → { id, pipeIndex, chipId, lastSeen, ip, paired }
const devices = new Map();
// pipeIndex (1–3) → deviceId (string)
const pipeMap = new Map();

// ── A. UDP Discovery Server ────────────────────────────────────────────────────
function startDiscoveryServer(broadcastFn) {
  const sock = dgram.createSocket('udp4');

  sock.on('message', (msg, rinfo) => handleBeacon(msg, rinfo, sock, broadcastFn));

  sock.on('error', (err) => {
    console.error('[BATON] UDP error:', err.message);
  });

  sock.bind(DISCOVERY_PORT, '0.0.0.0', () => {
    console.log(`[BATON] UDP discovery listening on :${DISCOVERY_PORT}`);
  });
}

// ── B. PairingAck builder (20 bytes) ──────────────────────────────────────────
// Layout:
//   [0..3]   "ADGA"
//   [4..11]  device_id (char[8], zero-padded)
//   [12]     pipe_index (uint8)
//   [13..17] nrf_addr = PIPE_ADDR_BASE + pipe_index
//   [18..19] reserved (0x00)
function buildPairingAck(deviceId, pipeIndex) {
  const buf = Buffer.alloc(20, 0);
  buf.write('ADGA', 0, 'ascii');
  buf.write(deviceId.slice(0, 8).padEnd(8, '\0'), 4, 'ascii');
  buf.writeUInt8(pipeIndex, 12);
  PIPE_ADDR_BASE.forEach((b, i) => buf.writeUInt8(b, 13 + i));
  buf.writeUInt8(pipeIndex, 17);
  return buf;
}

// ── C. Handle incoming DiscoveryBeacon ────────────────────────────────────────
// Beacon layout (20 bytes):
//   [0..3]  "ADGB"
//   [4]     version (must be 1)
//   [5..12] device_id (char[8])
//   [13..16] chip_id (uint32 LE)
//   [17]    pipe_request (0 = let RPi assign)
//   [18..19] reserved
function handleBeacon(msg, rinfo, sock, broadcastFn) {
  if (msg.length < 20) return;
  if (msg.toString('ascii', 0, 4) !== 'ADGB') return;
  if (msg.readUInt8(4) !== 1) return;   // version check

  const deviceId = msg.toString('ascii', 5, 13).replace(/\0/g, '');
  const chipId   = msg.readUInt32LE(13);

  if (devices.has(deviceId)) {
    // Already paired — update presence and re-send ACK (idempotent on ADAGIO reboot)
    const existing = devices.get(deviceId);
    existing.lastSeen = Date.now();
    existing.ip = rinfo.address;
    const ack = buildPairingAck(deviceId, existing.pipeIndex);
    sock.send(ack, 0, 20, PAIRING_PORT, rinfo.address);
    return;
  }

  // Assign next free pipe index (1–3)
  let pipeIndex = null;
  for (let i = 1; i <= 3; i++) {
    if (!pipeMap.has(i)) { pipeIndex = i; break; }
  }
  if (pipeIndex === null) {
    console.warn(`[BATON] Max devices (3) reached — rejecting ${deviceId}`);
    return;
  }

  devices.set(deviceId, {
    id: deviceId,
    pipeIndex,
    chipId,
    lastSeen: Date.now(),
    ip: rinfo.address,
    paired: true,
  });
  pipeMap.set(pipeIndex, deviceId);
  console.log(`[BATON] Paired ${deviceId} → pipe ${pipeIndex} (${rinfo.address})`);

  const ack = buildPairingAck(deviceId, pipeIndex);
  sock.send(ack, 0, 20, PAIRING_PORT, rinfo.address);
}

// ── D. NRF24 receive loop ──────────────────────────────────────────────────────
function startNRF24(broadcastFn) {
  let RF24, RF24_250KBPS, RF24_PA_LOW;
  try {
    ({ RF24, RF24_250KBPS, RF24_PA_LOW } = require('nrf24'));
  } catch {
    console.warn('[BATON] nrf24 not available (non-RPi environment) — NRF24 disabled');
    return;
  }

  const radio = new RF24(NRF_CE_PIN, NRF_CSN_PIN);
  if (!radio.begin()) {
    console.error('[BATON] NRF24 begin() failed — check wiring/CE/CSN pins');
    return;
  }

  radio.setChannel(NRF_CHANNEL);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);
  radio.setPayloadSize(32);
  radio.setAutoAck(1);   // Enable auto-ACK so ESP32 setRetries() works cleanly

  // Open reading pipes 1–3: ADG\x00\x01, ADG\x00\x02, ADG\x00\x03
  for (let i = 1; i <= 3; i++) {
    radio.openReadingPipe(i, Buffer.from([...PIPE_ADDR_BASE, i]));
  }
  radio.startListening();
  console.log('[BATON] NRF24 listening on pipes 1–3 (ch108, 250 kbps)');

  // Poll at ~25 Hz
  setInterval(() => pollNRF24(radio, broadcastFn), 40);
}

function pollNRF24(radio, broadcastFn) {
  while (radio.available()) {
    const result = radio.read(32);
    // nrf24 v1.x: Buffer directly; v2.x: { data, pipe }
    const buf  = Buffer.isBuffer(result) ? result : result.data;
    const pipe = (result && result.pipe != null) ? result.pipe : 1;
    const raw  = parsePacket(buf, pipe);
    broadcastFn(translateToSnapshot(raw));
  }
}

// ── E. Parse 32-byte TelemetryPacketCompact ───────────────────────────────────
// Layout (little-endian):
//   offset  0  uint32_t  time_ms
//   offset  4  int16_t   ax_mg
//   offset  6  int16_t   ay_mg
//   offset  8  int16_t   az_mg
//   offset 10  uint8_t[2] _pad
//   offset 12  float     gx_rps
//   offset 16  float     gy_rps
//   offset 20  float     gz_rps
//   offset 24  float     altitude_m
//   offset 28  int16_t   pressure_hpa
//   offset 30  uint8_t   status_flags (Bit0=MPU_OK Bit1=BMP_OK Bit2=TX_ENABLED)
//   offset 31  uint8_t   reserved
function parsePacket(buf, pipeIndex) {
  return {
    time_ms:      buf.readUInt32LE(0),
    ax_mg:        buf.readInt16LE(4),
    ay_mg:        buf.readInt16LE(6),
    az_mg:        buf.readInt16LE(8),
    gx_rps:       buf.readFloatLE(12),
    gy_rps:       buf.readFloatLE(16),
    gz_rps:       buf.readFloatLE(20),
    altitude_m:   buf.readFloatLE(24),
    pressure_hpa: buf.readInt16LE(28),
    status_flags: buf.readUInt8(30),
    pipe:         pipeIndex,
  };
}

// ── F. Translate ADAGIO packet → type 0x01 snapshot ──────────────────────────
// Maps ADAGIO fields onto the existing wire format understood by the frontend,
// appending ADAGIO-specific extensions (pr, gx, gy, gz, sf, dev).
function translateToSnapshot(raw) {
  return {
    type: 0x01,
    ts:   Date.now(),

    // Attitude — gyro rates only, not integrated; leave as zero
    r: 0, p: 0, w: 0,

    // GPS — not available on ADAGIO EDU
    la: 0, lo: 0, am: 0,

    // Altitude: convert m → mm so the existing altRel path (mmToM) works unchanged
    ar: Math.round(raw.altitude_m * 1000),

    // Velocity — not available
    vx: 0, vy: 0, vz: 0, gs: 0, as: 0, cr: 0,

    // Accelerometer — already in milli-g, matches existing wire format
    ax: raw.ax_mg,
    ay: raw.ay_mg,
    az: raw.az_mg,

    // Battery — not available
    bv: 0, bc: 0, br: 0,

    // Link quality / state — not available
    sat: 0, rs: 0, arm: 0, fm: 0,

    // ADAGIO-specific extensions (new fields consumed by frontend stores)
    pr:  raw.pressure_hpa,
    gx:  raw.gx_rps,
    gy:  raw.gy_rps,
    gz:  raw.gz_rps,
    sf:  raw.status_flags,
    dev: raw.pipe,
  };
}

// ── G. Device timeout housekeeping ────────────────────────────────────────────
function startHousekeeping() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, dev] of devices.entries()) {
      if (now - dev.lastSeen > DEVICE_TIMEOUT_MS) {
        pipeMap.delete(dev.pipeIndex);
        devices.delete(id);
        console.log(`[BATON] Device ${id} timed out (no beacon for ${DEVICE_TIMEOUT_MS / 1000}s)`);
      }
    }
  }, 5000);
}

// ── Exports ───────────────────────────────────────────────────────────────────

/** Return a snapshot of the current device registry for the system status broadcast. */
export function getDevices() {
  return [...devices.values()].map(d => ({
    id:       d.id,
    pipe:     d.pipeIndex,
    chipId:   d.chipId.toString(16).toUpperCase(),
    lastSeen: d.lastSeen,
    paired:   d.paired,
  }));
}

/** Start the ADAGIO EDU pipeline. Call once at server startup. */
export function startBaton(broadcastFn) {
  startDiscoveryServer(broadcastFn);
  startNRF24(broadcastFn);
  startHousekeeping();
  console.log('[BATON] ADAGIO EDU pipeline started (UDP:5010 + NRF24 ch108)');
}
