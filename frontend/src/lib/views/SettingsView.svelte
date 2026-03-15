<script>
  import { COLORS } from '$lib/theme.js';
  import { wsStatus, systemStatus, telemetry } from '$lib/stores.js';
  import { sendCommand } from '$lib/ws.js';

  let sysStatus = $derived($systemStatus);
  let connStatus = $derived($wsStatus);
  let telem = $derived($telemetry);

  function armDisarm() {
    if (telem?.armed) {
      sendCommand('disarm');
    } else {
      sendCommand('arm');
    }
  }

  function setMode(mode) {
    sendCommand('set_mode', { mode });
  }

  const modes = ['STABILIZE', 'ALT_HOLD', 'LOITER', 'AUTO', 'RTL', 'LAND', 'GUIDED', 'POSHOLD'];
</script>

<div class="settings-view">
  <div class="settings-section">
    <h3>System Information</h3>
    <div class="info-grid">
      <div class="info-row"><span class="label">Version</span><span class="value">{sysStatus?.version || '--'}</span></div>
      <div class="info-row"><span class="label">Uptime</span><span class="value">{sysStatus ? Math.floor(sysStatus.uptime) + 's' : '--'}</span></div>
      <div class="info-row"><span class="label">Heap</span><span class="value">{sysStatus ? Math.round(sysStatus.heap / 1024) + ' MB' : '--'}</span></div>
      <div class="info-row"><span class="label">Clients</span><span class="value">{sysStatus?.clients ?? '--'}</span></div>
      <div class="info-row"><span class="label">Connection</span><span class="value">{connStatus}</span></div>
    </div>
  </div>

  <div class="settings-section">
    <h3>Commands</h3>
    <div class="cmd-row">
      <button class="cmd-btn" class:armed={telem?.armed} onclick={armDisarm}>
        {telem?.armed ? 'DISARM' : 'ARM'}
      </button>
    </div>
    <div class="mode-grid">
      {#each modes as mode}
        <button class="mode-btn" class:active={telem?.flightMode === mode} onclick={() => setMode(mode)}>
          {mode}
        </button>
      {/each}
    </div>
  </div>

  <div class="settings-section">
    <h3>About</h3>
    <p class="about-text">
      MAESTRO 2.0 is a UAV ground station dashboard by Nocturne Systems.
      Designed for real-time telemetry visualization via WebSocket.
    </p>
  </div>
</div>

<style>
  .settings-view {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 600px;
    margin: 0 auto;
  }
  .settings-section {
    background: #1A1A1A;
    border: 1px solid #2A2A2A;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  }
  h3 {
    font-size: 13px;
    font-weight: 700;
    color: #FFFFFF;
    margin: 0 0 12px 0;
    letter-spacing: 0.5px;
  }
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid #222222;
  }
  .label { font-size: 11px; color: #666666; }
  .value { font-size: 11px; color: #FFFFFF; font-family: 'Consolas', monospace; }
  .cmd-row { margin-bottom: 12px; }
  .cmd-btn {
    background: #003D7A;
    border: none;
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 24px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 1px;
  }
  .cmd-btn.armed { background: #FF3B30; }
  .cmd-btn:hover { opacity: 0.85; }
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .mode-btn {
    background: #222222;
    border: 1px solid #3A3A3A;
    color: #AAAAAA;
    font-size: 10px;
    padding: 6px 4px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .mode-btn:hover { background: #2A2A2A; color: #FFFFFF; }
  .mode-btn.active { background: #003D7A; border-color: #003D7A; color: #FFFFFF; }
  .about-text {
    font-size: 11px;
    color: #AAAAAA;
    line-height: 1.5;
    margin: 0;
  }
</style>
