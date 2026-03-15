/**
 * MAVLink .tlog file parser for MAESTRO 2.0
 *
 * Parses binary .tlog files (MAVLink v2) into telemetry snapshots
 * matching the same wire format as telemetry-sim.js
 *
 * .tlog format: [8-byte BE timestamp (µs)] [MAVLink v2 packet] repeating
 * MAVLink v2:   0xFD | len | incompat | compat | seq | sysid | compid | msgid[3 LE] | payload[len] | crc[2]
 */

// MAVLink v2 message IDs we care about
const MSG_HEARTBEAT          = 0;
const MSG_SYS_STATUS         = 1;
const MSG_GPS_RAW_INT        = 24;
const MSG_SCALED_IMU         = 26;
const MSG_ATTITUDE           = 30;
const MSG_GLOBAL_POSITION_INT = 33;
const MSG_RC_CHANNELS        = 65;
const MSG_VFR_HUD            = 74;

/**
 * Parse a .tlog buffer into an array of timestamped telemetry snapshots.
 * Each snapshot matches the format from telemetry-sim.js (type 0x01).
 *
 * @param {Buffer} buf - Raw .tlog file contents
 * @returns {{ snapshots: Array, duration: number, messageCount: number }}
 */
export function parseTlog(buf) {
  // Accumulated state from different message types
  const state = {
    roll: 0, pitch: 0, yaw: 0,
    lat: 0, lon: 0, altMsl: 0, altRel: 0,
    vx: 0, vy: 0, vz: 0,
    groundspeed: 0, airspeed: 0, climbRate: 0,
    ax: 0, ay: 0, az: 0,
    batteryV: 0, batteryA: 0, batteryPct: 0,
    satellites: 0, rssi: 0,
    armed: 0, flightMode: 0,
  };

  const snapshots = [];
  let offset = 0;
  let firstTimestamp = null;
  let lastTimestamp = null;
  let msgCount = 0;
  let lastSnapshotTime = 0;
  const SNAPSHOT_INTERVAL_US = 100000; // 10 Hz = every 100ms

  while (offset + 8 < buf.length) {
    // Read 8-byte big-endian timestamp (microseconds)
    const tsHi = buf.readUInt32BE(offset);
    const tsLo = buf.readUInt32BE(offset + 4);
    const timestampUs = tsHi * 0x100000000 + tsLo;
    offset += 8;

    if (firstTimestamp === null) firstTimestamp = timestampUs;
    lastTimestamp = timestampUs;

    // Look for MAVLink v2 start byte (0xFD)
    if (offset >= buf.length || buf[offset] !== 0xFD) {
      // Try to find next 0xFD or next timestamp+0xFD pattern
      let found = false;
      for (let scan = offset; scan < Math.min(offset + 300, buf.length); scan++) {
        if (buf[scan] === 0xFD) {
          offset = scan;
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    // Parse MAVLink v2 header
    if (offset + 12 > buf.length) break;

    const startByte = buf[offset]; // 0xFD
    if (startByte !== 0xFD) { offset++; continue; }

    const payloadLen = buf[offset + 1];
    const incompatFlags = buf[offset + 2];
    // const compatFlags = buf[offset + 3];
    // const seq = buf[offset + 4];
    // const sysid = buf[offset + 5];
    // const compid = buf[offset + 6];
    const msgId = buf[offset + 7] | (buf[offset + 8] << 8) | (buf[offset + 9] << 16);

    const headerSize = 10; // bytes before payload
    const crcSize = 2;
    const sigSize = (incompatFlags & 0x01) ? 13 : 0;
    const packetSize = headerSize + payloadLen + crcSize + sigSize;

    if (offset + packetSize > buf.length) break;

    const payloadStart = offset + headerSize;
    const payload = buf.subarray(payloadStart, payloadStart + payloadLen);

    // Parse known message types
    try {
      switch (msgId) {
        case MSG_HEARTBEAT:
          if (payload.length >= 9) {
            state.flightMode = payload.readUInt32LE(0); // custom_mode
            const baseMode = payload[6];
            state.armed = (baseMode & 0x80) ? 1 : 0; // MAV_MODE_FLAG_SAFETY_ARMED
          }
          break;

        case MSG_SYS_STATUS:
          if (payload.length >= 31) {
            state.batteryV = payload.readUInt16LE(14);  // voltage_battery (mV)
            state.batteryA = payload.readInt16LE(16);   // current_battery (centi-amps)
            state.batteryPct = payload.readInt8(30);     // battery_remaining (%)
          }
          break;

        case MSG_GPS_RAW_INT:
          if (payload.length >= 30) {
            state.satellites = payload[29]; // satellites_visible
          }
          break;

        case MSG_SCALED_IMU:
          if (payload.length >= 10) {
            state.ax = payload.readInt16LE(4);  // xacc (milli-g)
            state.ay = payload.readInt16LE(6);  // yacc (milli-g)
            state.az = payload.readInt16LE(8);  // zacc (milli-g)
          }
          break;

        case MSG_ATTITUDE:
          if (payload.length >= 16) {
            state.roll  = payload.readFloatLE(4);  // radians
            state.pitch = payload.readFloatLE(8);  // radians
            state.yaw   = payload.readFloatLE(12); // radians
          }
          break;

        case MSG_GLOBAL_POSITION_INT:
          if (payload.length >= 28) {
            state.lat    = payload.readInt32LE(4);   // degE7
            state.lon    = payload.readInt32LE(8);   // degE7
            state.altMsl = payload.readInt32LE(12);  // mm
            state.altRel = payload.readInt32LE(16);  // mm
            state.vx     = payload.readInt16LE(20);  // cm/s (North)
            state.vy     = payload.readInt16LE(22);  // cm/s (East)
            state.vz     = payload.readInt16LE(24);  // cm/s (Down)
          }
          break;

        case MSG_RC_CHANNELS:
          if (payload.length >= 42) {
            state.rssi = payload[41]; // rssi (0-100)
          }
          break;

        case MSG_VFR_HUD:
          if (payload.length >= 20) {
            state.airspeed    = Math.round(payload.readFloatLE(0) * 100);  // m/s → cm/s
            state.groundspeed = Math.round(payload.readFloatLE(4) * 100);  // m/s → cm/s
            state.climbRate   = Math.round(payload.readFloatLE(12) * 100); // m/s → cm/s
          }
          break;
      }
    } catch (e) {
      // Skip malformed messages
    }

    offset += packetSize;
    msgCount++;

    // Emit snapshots at ~10 Hz
    const elapsed = timestampUs - firstTimestamp;
    if (elapsed - lastSnapshotTime >= SNAPSHOT_INTERVAL_US) {
      lastSnapshotTime = elapsed;
      snapshots.push({
        // Relative time in ms from start of log
        _timeMs: Math.round(elapsed / 1000),
        type: 0x01,
        ts: 0, // Will be set during playback to real wall-clock time
        r: state.roll,
        p: state.pitch,
        w: state.yaw,
        la: state.lat,
        lo: state.lon,
        am: state.altMsl,
        ar: state.altRel,
        gs: state.groundspeed,
        as: state.airspeed,
        cr: state.climbRate,
        vx: state.vx,
        vy: state.vy,
        vz: state.vz,
        ax: state.ax,
        ay: state.ay,
        az: state.az,
        bv: state.batteryV,
        bc: state.batteryA,
        br: Math.max(0, state.batteryPct),
        sat: state.satellites,
        rs: Math.min(100, Math.max(0, state.rssi)),
        arm: state.armed,
        fm: state.flightMode,
      });
    }
  }

  const durationMs = lastTimestamp && firstTimestamp
    ? Math.round((lastTimestamp - firstTimestamp) / 1000)
    : 0;

  return {
    snapshots,
    duration: durationMs,
    messageCount: msgCount,
  };
}
