<script>
  import { COLORS } from '$lib/theme.js';
  import { telemetry } from '$lib/stores.js';
  import { fmt } from '$lib/units.js';

  let telem = $derived($telemetry);
</script>

<div class="readouts">
  <div class="readout-title">TELEMETRY</div>

  <div class="readout-row">
    <span class="label">GPS Sats</span>
    <span class="value">{telem?.satellites ?? '--'}</span>
  </div>

  <div class="readout-row">
    <span class="label">RSSI</span>
    <span class="value">{telem?.rssi ?? '--'}%</span>
  </div>

  <div class="readout-row">
    <span class="label">Climb</span>
    <span class="value">{telem ? fmt(telem.climbRate) : '--'} m/s</span>
  </div>

  <div class="readout-row">
    <span class="label">Heading</span>
    <span class="value">{telem ? fmt(telem.heading, 0) : '--'}°</span>
  </div>

  <div class="readout-row">
    <span class="label">Voltage</span>
    <span class="value">{telem ? fmt(telem.batteryV) : '--'} V</span>
  </div>

  <div class="readout-row">
    <span class="label">Current</span>
    <span class="value">{telem ? fmt(telem.batteryA) : '--'} A</span>
  </div>

  <div class="readout-row">
    <span class="label">Lat</span>
    <span class="value">{telem ? telem.lat.toFixed(6) : '--'}°</span>
  </div>

  <div class="readout-row">
    <span class="label">Lon</span>
    <span class="value">{telem ? telem.lon.toFixed(6) : '--'}°</span>
  </div>
</div>

<style>
  .readouts {
    background: #1A1A1A;
    border: 1px solid #2A2A2A;
    border-radius: 6px;
    padding: 10px 12px;
  }
  .readout-title {
    font-size: 9px;
    font-weight: 700;
    color: #666666;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }
  .readout-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    border-top: 1px solid #222222;
  }
  .label {
    font-size: 11px;
    color: #666666;
  }
  .value {
    font-size: 11px;
    color: #FFFFFF;
    font-family: 'Consolas', 'Courier New', monospace;
  }
</style>
