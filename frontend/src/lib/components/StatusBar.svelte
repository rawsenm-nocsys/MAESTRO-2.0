<script>
  import { COLORS } from '$lib/theme.js';
  import { wsStatus, telemetry, messageRate, systemStatus } from '$lib/stores.js';

  let connStatus = $derived($wsStatus);
  let telem = $derived($telemetry);
  let msgRate = $derived($messageRate);
  let sysStatus = $derived($systemStatus);
</script>

<div class="statusbar">
  <span class="status-item">
    <span class="dot" style="background:{connStatus === 'connected' ? COLORS.green : COLORS.red_warn}"></span>
    {connStatus === 'connected' ? 'Connected' : 'Disconnected'}
  </span>

  <span class="divider">|</span>
  <span class="status-item">{msgRate} msg/s</span>

  {#if telem}
    <span class="divider">|</span>
    <span class="status-item" style="color:{telem.batteryPct >= 50 ? COLORS.green : telem.batteryPct >= 20 ? COLORS.yellow : COLORS.red_warn}">
      BAT {telem.batteryPct}%
    </span>

    <span class="divider">|</span>
    <span class="status-item" style="color:{telem.armed ? COLORS.red_warn : COLORS.text_dim}">
      {telem.armed ? 'ARMED' : 'SAFE'}
    </span>
  {/if}

  <span class="spacer"></span>

  {#if sysStatus}
    <span class="status-item dim">Heap: {Math.round(sysStatus.heap / 1024)} MB</span>
    <span class="divider">|</span>
    <span class="status-item dim">Clients: {sysStatus.clients}</span>
    <span class="divider">|</span>
  {/if}
  <span class="status-item dim">MAESTRO 2.0</span>
</div>

<style>
  .statusbar {
    height: 24px;
    background: #1A1A1A;
    border-top: 1px solid #2A2A2A;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    flex-shrink: 0;
  }
  .status-item {
    font-size: 10px;
    color: #AAAAAA;
    display: flex;
    align-items: center;
    gap: 4px;
    letter-spacing: 0.5px;
  }
  .status-item.dim {
    color: #666666;
  }
  .divider {
    color: #333333;
    font-size: 10px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .spacer {
    flex: 1;
  }
</style>
