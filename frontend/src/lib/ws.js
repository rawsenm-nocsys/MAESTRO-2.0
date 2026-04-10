import { wsStatus, rawTelemetry, systemStatus, messageRate, pushTelemetry, connectionMode, deviceName, clearAllData, playbackState, frozenTime, batchTrail, activeDevices } from './stores.js';
import * as U from './units.js';

let ws = null;
let reconnectTimer = null;
let msgCount = 0;
let rateTimer = null;
let shouldReconnect = false;
let lastDataTimestamp = null;

export function connect(mode = 'websocket') {
  // Clean up any existing connection
  if (ws) {
    shouldReconnect = false;
    ws.close();
    ws = null;
  }
  clearTimeout(reconnectTimer);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}`;

  shouldReconnect = true;
  wsStatus.set('connecting');
  ws = new WebSocket(url);

  ws.onopen = () => {
    wsStatus.set('connected');
    connectionMode.set(mode);
    if (mode === 'log_file') {
      deviceName.set('Log Playback');
      sendCommand('set_mode', { mode: 'log' });
    } else if (mode === 'live') {
      deviceName.set('ADAGIO EDU Live');
      sendCommand('set_mode', { mode: 'live' });
    } else {
      deviceName.set('MAESTRO GCS');
    }
    console.log(`[MAESTRO] WebSocket connected (mode: ${mode})`);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      msgCount++;

      if (msg.type === 0x01) {
        rawTelemetry.set(msg);
        pushTelemetry(msg);
        lastDataTimestamp = msg.ts;
        // Unfreeze charts when receiving new data during playback
        frozenTime.set(null);
      } else if (msg.type === 0x02) {
        systemStatus.set(msg);
        if (Array.isArray(msg.devices)) {
          activeDevices.set(msg.devices);
        }
      } else if (msg.type === 'playback_state') {
        playbackState.set(msg);

        // Freeze charts when playback stops, pauses, or reaches end
        if (!msg.playing && !msg.paused && lastDataTimestamp) {
          // Stopped or ended — freeze at last data timestamp
          frozenTime.set(lastDataTimestamp);
        } else if (msg.paused && lastDataTimestamp) {
          // Paused — freeze at last data timestamp
          frozenTime.set(lastDataTimestamp);
        }
      } else if (msg.type === 'log_batch') {
        // Batch of all snapshots for skip-to-end
        if (msg.snapshots && Array.isArray(msg.snapshots)) {
          // Clear all existing data first so we don't get duplicates
          clearAllData();

          // Process all snapshots into ring buffers
          for (const snap of msg.snapshots) {
            pushTelemetry(snap);
          }

          // Build map trail from all snapshots
          const trail = [];
          for (const snap of msg.snapshots) {
            const lat = U.degE7ToDeg(snap.la);
            const lon = U.degE7ToDeg(snap.lo);
            if (lat !== 0 && lon !== 0) {
              trail.push({ lat, lon, t: snap.ts });
            }
          }
          batchTrail.set(trail);

          // Set the last snapshot as current telemetry display
          if (msg.snapshots.length > 0) {
            const last = msg.snapshots[msg.snapshots.length - 1];
            rawTelemetry.set(last);
            lastDataTimestamp = last.ts;
            // Freeze at the last timestamp
            frozenTime.set(lastDataTimestamp);
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    wsStatus.set('disconnected');
    if (shouldReconnect) {
      reconnectTimer = setTimeout(() => connect(mode), 2000);
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  // Message rate counter
  if (!rateTimer) {
    rateTimer = setInterval(() => {
      messageRate.set(msgCount);
      msgCount = 0;
    }, 1000);
  }
}

export function disconnect() {
  shouldReconnect = false;
  clearTimeout(reconnectTimer);
  clearInterval(rateTimer);
  rateTimer = null;
  lastDataTimestamp = null;
  if (ws) {
    // Tell server to switch back to sim mode
    sendCommand('set_mode', { mode: 'sim' });
    ws.close();
    ws = null;
  }
  wsStatus.set('disconnected');
  connectionMode.set('disconnected');
  deviceName.set('No Device');
  playbackState.set(null);
  frozenTime.set(null);
  clearAllData();
}

export function isConnected() {
  return ws && ws.readyState === 1;
}

export function sendCommand(cmd, params = {}) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 0x10, cmd, ...params }));
  }

  // If replay command, clear all client-side data immediately
  if (cmd === 'log_replay') {
    lastDataTimestamp = null;
    clearAllData();
  }

  // If stop, freeze at current position
  if (cmd === 'log_stop' && lastDataTimestamp) {
    frozenTime.set(lastDataTimestamp);
  }
}
