import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import TelemetrySim from './telemetry-sim.js';
import { parseTlog } from './tlog-parser.js';
import { getVersionInfo } from './version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const TELEMETRY_HZ = 10;
const VERSION_INFO = getVersionInfo();

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Serve static frontend build
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// Log playback engine
const logPlayback = {
  snapshots: [],
  duration: 0,
  currentIndex: 0,
  isPlaying: false,
  isPaused: false,
  playbackTimer: null,
  startWallTime: 0,
  startLogTime: 0,

  load(snapshots, duration) {
    this.stop();
    this.snapshots = snapshots;
    this.duration = duration;
    this.currentIndex = 0;
    console.log(`[LOG] Loaded ${snapshots.length} snapshots for playback`);
  },

  play() {
    if (this.snapshots.length === 0) return;

    if (this.isPaused) {
      this.isPaused = false;
      this.isPlaying = true;
      this.startWallTime = Date.now();
      this.startLogTime = this.snapshots[this.currentIndex]._timeMs;
      this._scheduleNext();
      broadcastPlaybackState();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.startWallTime = Date.now();
    this.startLogTime = this.snapshots[this.currentIndex]._timeMs;
    this._scheduleNext();
    broadcastPlaybackState();
  },

  pause() {
    if (!this.isPlaying) return;
    this.isPaused = true;
    this.isPlaying = false;
    clearTimeout(this.playbackTimer);
    this.playbackTimer = null;
    broadcastPlaybackState();
  },

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    clearTimeout(this.playbackTimer);
    this.playbackTimer = null;
    broadcastPlaybackState();
  },

  replay() {
    this.stop();
    this.currentIndex = 0;
    this.play();
  },

  skipToEnd() {
    if (this.snapshots.length === 0) return;

    clearTimeout(this.playbackTimer);
    this.playbackTimer = null;

    const now = Date.now();
    const totalCount = this.snapshots.length;
    const intervalMs = 100;
    const allSnapshots = [];

    for (let i = 0; i < totalCount; i++) {
      const snap = { ...this.snapshots[i] };
      snap.ts = now - (totalCount - 1 - i) * intervalMs;
      delete snap._timeMs;
      allSnapshots.push(snap);
    }

    const batchMsg = JSON.stringify({
      type: 'log_batch',
      snapshots: allSnapshots
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(batchMsg);
      }
    }

    this.currentIndex = this.snapshots.length;
    this.isPlaying = false;
    this.isPaused = false;
    broadcastPlaybackState();
  },

  _scheduleNext() {
    if (!this.isPlaying || this.currentIndex >= this.snapshots.length) {
      if (this.currentIndex >= this.snapshots.length) {
        this.isPlaying = false;
        this.isPaused = false;
        broadcastPlaybackState();
      }
      return;
    }

    const snap = this.snapshots[this.currentIndex];
    const logTimeMs = snap._timeMs;
    const wallElapsed = Date.now() - this.startWallTime;
    const logElapsed = logTimeMs - this.startLogTime;
    const delay = Math.max(0, logElapsed - wallElapsed);

    this.playbackTimer = setTimeout(() => {
      if (!this.isPlaying) return;

      const payload = { ...snap, ts: Date.now() };
      delete payload._timeMs;
      broadcastTelemetry(payload);

      this.currentIndex++;

      if (this.currentIndex % 10 === 0) {
        broadcastPlaybackState();
      }

      this._scheduleNext();
    }, delay);
  },

  getState() {
    return {
      type: 'playback_state',
      loaded: this.snapshots.length > 0,
      playing: this.isPlaying,
      paused: this.isPaused,
      progress: this.snapshots.length > 0 ? this.currentIndex / this.snapshots.length : 0,
      currentIndex: this.currentIndex,
      totalSnapshots: this.snapshots.length,
      duration: this.duration,
    };
  },
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: VERSION_INFO.version,
    gitSha: VERSION_INFO.gitSha,
    buildTime: VERSION_INFO.buildTime,
    clients: wss.clients.size,
    telemetryHz: TELEMETRY_HZ,
  });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({
    version: VERSION_INFO.version,
    gitSha: VERSION_INFO.gitSha,
    buildTime: VERSION_INFO.buildTime,
  });
});

// Log upload
app.post('/api/upload-log', upload.single('logfile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(
      `[LOG] Parsing uploaded file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`
    );

    const result = parseTlog(req.file.buffer);

    if (result.snapshots.length === 0) {
      return res.status(400).json({ error: 'No telemetry data found in log file' });
    }

    logPlayback.load(result.snapshots, result.duration);

    console.log(
      `[LOG] Parsed ${result.messageCount} MAVLink messages → ${result.snapshots.length} snapshots (${(result.duration / 1000).toFixed(1)}s)`
    );

    res.json({
      status: 'ok',
      snapshots: result.snapshots.length,
      duration: result.duration,
      messageCount: result.messageCount,
    });
  } catch (e) {
    console.error('[LOG] Parse error:', e.message);
    res.status(500).json({ error: 'Failed to parse log file: ' + e.message });
  }
});

function broadcastTelemetry(payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

function broadcastPlaybackState() {
  const data = JSON.stringify(logPlayback.getState());
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  console.log(`[WSS] Upgrade request from ${req.socket.remoteAddress} → ${req.url}`);
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// Telemetry simulator
const sim = new TelemetrySim();

// Track message rate
let msgCount = 0;
let lastRateCheck = Date.now();
let messageRate = 0;

// Current mode
let serverMode = 'sim';

wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIP} (${wss.clients.size} total)`);

  ws.send(JSON.stringify({
    type: 0x02,
    ts: Date.now(),
    version: VERSION_INFO.version,
    gitSha: VERSION_INFO.gitSha,
    buildTime: VERSION_INFO.buildTime,
    clients: wss.clients.size,
    uptime: Math.floor(process.uptime()),
    heap: Math.round(process.memoryUsage().heapUsed / 1024),
    msgRate: messageRate,
  }));

  if (logPlayback.snapshots.length > 0) {
    ws.send(JSON.stringify(logPlayback.getState()));
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 0x10) {
        console.log(`[CMD] ${JSON.stringify(msg)}`);

        switch (msg.cmd) {
          case 'set_mode':
            serverMode = msg.mode || 'sim';
            console.log(`[MODE] Switched to: ${serverMode}`);
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok', mode: serverMode }));
            break;

          case 'log_play':
            serverMode = 'log';
            logPlayback.play();
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
            break;

          case 'log_pause':
            logPlayback.pause();
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
            break;

          case 'log_stop':
            logPlayback.stop();
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
            break;

          case 'log_replay':
            serverMode = 'log';
            logPlayback.replay();
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
            break;

          case 'log_skip':
            logPlayback.skipToEnd();
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
            break;

          default:
            ws.send(JSON.stringify({ type: 'cmd_ack', cmd: msg.cmd, status: 'ok' }));
        }
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected (${wss.clients.size} remaining)`);
  });
});

// Telemetry broadcast loop
setInterval(() => {
  if (serverMode !== 'sim') {
    sim.tick(1 / TELEMETRY_HZ);
    return;
  }

  if (wss.clients.size === 0) {
    sim.tick(1 / TELEMETRY_HZ);
    return;
  }

  const snapshot = sim.tick(1 / TELEMETRY_HZ);
  const payload = JSON.stringify(snapshot);

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
      msgCount++;
    }
  }
}, 1000 / TELEMETRY_HZ);

// System status broadcast
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastRateCheck) / 1000;
  messageRate = Math.round(msgCount / elapsed);
  msgCount = 0;
  lastRateCheck = now;

  const status = JSON.stringify({
    type: 0x02,
    ts: now,
    version: VERSION_INFO.version,
    gitSha: VERSION_INFO.gitSha,
    buildTime: VERSION_INFO.buildTime,
    clients: wss.clients.size,
    uptime: Math.floor(process.uptime()),
    heap: Math.round(process.memoryUsage().heapUsed / 1024),
    msgRate: messageRate,
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(status);
    }
  }
}, 1000);

// Start
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n MAESTRO 2.0 Ground Station`);
  console.log(` HTTP: http://localhost:${PORT}`);
  console.log(` WebSocket: ws://localhost:${PORT}`);
  console.log(` Telemetry: ${TELEMETRY_HZ} Hz`);
  console.log(` Version: ${VERSION_INFO.version}`);
  console.log(` Git SHA: ${VERSION_INFO.gitSha}`);
  console.log(` Build Time: ${VERSION_INFO.buildTime}\n`);
});
