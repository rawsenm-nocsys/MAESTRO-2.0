<script>
  import { COLORS } from '$lib/theme.js';
  import { telemetry, systemStatus, wsStatus, messageRate, deviceName, activeDevices } from '$lib/stores.js';

  let telem   = $derived($telemetry);
  let status  = $derived($systemStatus);
  let connStatus = $derived($wsStatus);
  let msgRate = $derived($messageRate);
  let name    = $derived($deviceName);
  let devices = $derived($activeDevices);
  let isLive  = $derived($systemStatus?.mode === 'live');

  function batteryColor(pct) {
    if (pct >= 50) return COLORS.green;
    if (pct >= 20) return COLORS.yellow;
    return COLORS.red_warn;
  }
</script>

<div class="device-card">
  <div class="device-header">
    <span class="device-name">{name}</span>
    <span class="device-mode">{isLive ? 'LIVE' : (telem?.flightMode || '--')}</span>
  </div>

  {#if isLive}
    <!-- ADAGIO EDU device list -->
    {#if devices.length === 0}
      <div class="awaiting-label">Awaiting ADAGIO pairing...</div>
    {:else}
      {#each devices as dev}
        <div class="adagio-row">
          <span class="pipe-badge">PIPE {dev.pipe}</span>
          <span class="dev-id">{dev.id}</span>
          {#if telem?.devicePipe === dev.pipe}
            <span class="dot" style="background:{telem.mpuOk ? '#4ADE80' : '#EF4444'}" title="MPU6050"></span>
            <span class="dot" style="background:{telem.bmpOk ? '#4ADE80' : '#EF4444'}" title="BMP280"></span>
            <span class="dot" style="background:{telem.txEnabled ? '#22D3EE' : '#555555'}" title="TX enabled"></span>
          {:else}
            <span class="dot dot-idle" title="MPU6050"></span>
            <span class="dot dot-idle" title="BMP280"></span>
            <span class="dot dot-idle" title="TX enabled"></span>
          {/if}
          <span class="msg-rate">{msgRate} msg/s</span>
        </div>
      {/each}
    {/if}
  {:else}
    <!-- Standard battery row -->
    {#if telem}
      <div class="battery-row">
        <span class="label">Battery:</span>
        <div class="battery-shell">
          <div class="battery-bar-bg">
            <div class="battery-fill" style="width:{telem.batteryPct}%; background:{batteryColor(telem.batteryPct)}"></div>
          </div>
          <div class="battery-nub"></div>
        </div>
        <span class="battery-pct">{telem.batteryPct}%</span>
        <span class="msg-rate">{msgRate} msg/s</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .device-card {
    background: #1A1A1A;
    border: 1px solid #2A2A2A;
    border-radius: 6px;
    padding: 10px 12px;
    width: 100%;
  }
  .device-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .device-name {
    font-weight: 700;
    font-size: 14px;
    color: #FFFFFF;
  }
  .device-mode {
    font-size: 9px;
    font-weight: 600;
    color: #00BFFF;
    background: rgba(0,191,255,0.12);
    padding: 2px 8px;
    border-radius: 3px;
    letter-spacing: 0.5px;
  }
  .label {
    font-size: 11px;
    color: #AAAAAA;
  }
  /* ── Battery row (sim / log mode) ── */
  .battery-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .battery-shell {
    display: flex;
    align-items: center;
    gap: 0;
  }
  .battery-bar-bg {
    width: 70px;
    height: 14px;
    background: #333333;
    border-radius: 2px;
    overflow: hidden;
  }
  .battery-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .battery-nub {
    width: 4px;
    height: 8px;
    background: #555555;
    border-radius: 0 2px 2px 0;
  }
  .battery-pct {
    font-size: 11px;
    font-weight: 600;
    color: #FFFFFF;
  }
  .msg-rate {
    font-size: 11px;
    color: #AAAAAA;
    margin-left: auto;
  }
  /* ── ADAGIO device list (live mode) ── */
  .awaiting-label {
    font-size: 11px;
    color: #555555;
    padding: 4px 0 2px;
    font-style: italic;
  }
  .adagio-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    border-top: 1px solid #222222;
    margin-top: 2px;
  }
  .pipe-badge {
    background: #222222;
    color: #22D3EE;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .dev-id {
    color: #AAAAAA;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .dot-idle {
    background: #333333;
  }
</style>
