<script>
  import { COLORS } from '$lib/theme.js';
  import { telemetry, systemStatus, wsStatus, messageRate, deviceName } from '$lib/stores.js';

  let telem = $derived($telemetry);
  let status = $derived($systemStatus);
  let connStatus = $derived($wsStatus);
  let msgRate = $derived($messageRate);
  let name = $derived($deviceName);

  function batteryColor(pct) {
    if (pct >= 50) return COLORS.green;
    if (pct >= 20) return COLORS.yellow;
    return COLORS.red_warn;
  }
</script>

<div class="device-card">
  <div class="device-header">
    <span class="device-name">{name}</span>
    <span class="device-mode">{telem?.flightMode || '--'}</span>
  </div>

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
</style>
