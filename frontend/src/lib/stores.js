import { writable, derived } from 'svelte/store';
import { FLIGHT_MODES } from './theme.js';
import * as U from './units.js';

// --- Ring Buffer for client-side chart data ---
class RingBuffer {
  constructor(capacity = 3000) {
    this.capacity = capacity;
    this.data = new Array(capacity);
    this.head = 0;
    this.length = 0;
  }

  push(timestamp, value) {
    this.data[this.head] = { t: timestamp, v: value };
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
  }

  getWindow(windowMs, refTime = null) {
    const now = refTime || Date.now();
    const cutoff = now - windowMs;
    const result = [];
    const start = this.length < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.length; i++) {
      const idx = (start + i) % this.capacity;
      const pt = this.data[idx];
      if (pt && pt.t >= cutoff) result.push(pt);
    }
    return result;
  }

  getAll() {
    const result = [];
    const start = this.length < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.length; i++) {
      const idx = (start + i) % this.capacity;
      if (this.data[idx]) result.push(this.data[idx]);
    }
    return result;
  }

  get latest() {
    if (this.length === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.data[idx];
  }

  clear() {
    this.head = 0;
    this.length = 0;
  }
}

// --- Telemetry Stores ---

// Raw latest telemetry snapshot from server
export const rawTelemetry = writable(null);

// Decoded display-ready telemetry
export const telemetry = derived(rawTelemetry, ($raw) => {
  if (!$raw) return null;
  return {
    roll: U.radToDeg($raw.r),
    pitch: U.radToDeg($raw.p),
    heading: ((U.radToDeg($raw.w) % 360) + 360) % 360,
    lat: U.degE7ToDeg($raw.la),
    lon: U.degE7ToDeg($raw.lo),
    altMsl: U.mmToM($raw.am),
    altRel: U.mmToM($raw.ar),
    groundspeed: U.cmsToMs($raw.gs),
    airspeed: U.cmsToMs($raw.as),
    climbRate: U.cmsToMs($raw.cr),
    vx: U.cmsToMs($raw.vx),
    vy: U.cmsToMs($raw.vy),
    vz: U.cmsToMs($raw.vz),
    ax: U.mgToMs2($raw.ax),
    ay: U.mgToMs2($raw.ay),
    az: U.mgToMs2($raw.az),
    batteryV: U.mvToV($raw.bv),
    batteryA: U.caToA($raw.bc),
    batteryPct: $raw.br,
    satellites: $raw.sat,
    rssi: $raw.rs,
    armed: $raw.arm === 1,
    flightMode: FLIGHT_MODES[$raw.fm] || `MODE_${$raw.fm}`,
    timestamp: $raw.ts,
  };
});

// Connection state
export const wsStatus = writable('disconnected');    // disconnected | connecting | connected
export const systemStatus = writable(null);          // server status (type 0x02)
export const messageRate = writable(0);

// Connection mode: disconnected | websocket | log_file
export const connectionMode = writable('disconnected');

// UI state
export const showConnectDialog = writable(false);
export const connDialogPreset = writable('');         // '' | 'Serial Port' | 'UDP Network' | 'TCP Network' | 'Log File'
export const showAbout = writable(false);
export const showSidebar = writable(true);
export const showChartsPanel = writable(true);

// Chart time window (ms)
export const chartWindow = writable(30000); // default 30s

// View state
export const currentView = writable('dashboard'); // dashboard | charts | settings

// Device info
export const deviceName = writable('No Device');

// Playback state (from server log playback engine)
export const playbackState = writable(null);

// Frozen time — when playback is paused/stopped/ended, charts freeze at this timestamp
// null = use Date.now() (live mode)
export const frozenTime = writable(null);

// Batch trail data for skip-to-end (array of {lat, lon, t} or null)
// MapCanvas watches this and replaces its trail when set
export const batchTrail = writable(null);

// Clear all telemetry data (on disconnect or replay)
export function clearAllData() {
  rawTelemetry.set(null);
  systemStatus.set(null);
  messageRate.set(0);
  frozenTime.set(null);
  for (const buf of Object.values(chartBuffers)) {
    buf.clear();
  }
}

// --- Chart Ring Buffers (singleton) ---
export const chartBuffers = {
  altRel: new RingBuffer(3000),
  groundspeed: new RingBuffer(3000),
  accelX: new RingBuffer(3000),
  batteryV: new RingBuffer(3000),
  batteryPct: new RingBuffer(3000),
  // Full charts view
  vx: new RingBuffer(3000),
  vy: new RingBuffer(3000),
  vz: new RingBuffer(3000),
  accelY: new RingBuffer(3000),
  accelZ: new RingBuffer(3000),
  batteryA: new RingBuffer(3000),
};

// Push incoming telemetry into ring buffers
export function pushTelemetry(raw) {
  const ts = raw.ts;
  chartBuffers.altRel.push(ts, U.mmToM(raw.ar));
  chartBuffers.groundspeed.push(ts, U.cmsToMs(raw.gs));
  chartBuffers.accelX.push(ts, U.mgToMs2(raw.ax));
  chartBuffers.batteryV.push(ts, U.mvToV(raw.bv));
  chartBuffers.batteryPct.push(ts, Math.max(0, Math.min(100, raw.br)));
  chartBuffers.vx.push(ts, U.cmsToMs(raw.vx));
  chartBuffers.vy.push(ts, U.cmsToMs(raw.vy));
  chartBuffers.vz.push(ts, U.cmsToMs(raw.vz));
  chartBuffers.accelY.push(ts, U.mgToMs2(raw.ay));
  chartBuffers.accelZ.push(ts, U.mgToMs2(raw.az));
  chartBuffers.batteryA.push(ts, U.caToA(raw.bc));
}
