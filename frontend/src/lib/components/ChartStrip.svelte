<script>
  import MiniChart from './MiniChart.svelte';
  import { COLORS } from '$lib/theme.js';
  import { chartBuffers, chartWindow } from '$lib/stores.js';

  const windows = [
    { label: '10s', ms: 10000 },
    { label: '30s', ms: 30000 },
    { label: '1m', ms: 60000 },
    { label: '5m', ms: 300000 },
  ];

  let activeWindow;
  chartWindow.subscribe(v => { activeWindow = v; });

  function setWindow(ms) {
    chartWindow.set(ms);
  }

  function exportCSV() {
    const streams = {
      'altitude_rel': chartBuffers.altRel,
      'groundspeed': chartBuffers.groundspeed,
      'accel_x': chartBuffers.accelX,
      'battery_voltage': chartBuffers.batteryV,
    };
    const tsSet = new Set();
    const allData = {};
    for (const [name, buf] of Object.entries(streams)) {
      const data = buf.getAll();
      allData[name] = new Map(data.map(d => [d.t, d.v]));
      data.forEach(d => tsSet.add(d.t));
    }
    const timestamps = [...tsSet].sort();
    const header = ['timestamp', ...Object.keys(streams)].join(',');
    const rows = timestamps.map(ts => {
      const vals = Object.keys(streams).map(name => {
        const v = allData[name].get(ts);
        return v != null ? v.toFixed(4) : '';
      });
      return [new Date(ts).toISOString(), ...vals].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-telemetry-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="chart-strip">
  <div class="chart-header">
    <span class="chart-label">CHARTS</span>
    <div class="time-pills">
      {#each windows as w}
        <button class="pill" class:active={activeWindow === w.ms} onclick={() => setWindow(w.ms)}>
          {w.label}
        </button>
      {/each}
    </div>
    <div class="spacer"></div>
    <button class="export-btn" onclick={exportCSV}>Export CSV</button>
  </div>
  <div class="charts-row">
    <MiniChart buffer={chartBuffers.altRel} title="Altitude" unit="m" color={COLORS.chart_cyan} />
    <MiniChart buffer={chartBuffers.groundspeed} title="Velocity" unit="m/s" color={COLORS.chart_green} />
    <MiniChart buffer={chartBuffers.accelX} title="Accel X" unit="m/s²" color={COLORS.chart_orange} />
    <MiniChart buffer={chartBuffers.batteryPct} title="Battery" unit="%" color={COLORS.chart_purple} fixedYMin={0} fixedYMax={100} />
  </div>
</div>

<style>
  .chart-strip {
    background: #141414;
    border-top: 1px solid #2A2A2A;
  }
  .chart-header {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    gap: 8px;
  }
  .chart-label {
    font-size: 9px;
    font-weight: 700;
    color: #666666;
    letter-spacing: 1.5px;
    margin-right: 4px;
  }
  .time-pills {
    display: flex;
    gap: 4px;
  }
  .pill {
    background: #222222;
    border: 1px solid #3A3A3A;
    color: #AAAAAA;
    font-size: 10px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .pill:hover {
    background: #2A2A2A;
    color: #FFFFFF;
  }
  .pill.active {
    background: #003D7A;
    border-color: #003D7A;
    color: #FFFFFF;
  }
  .spacer {
    flex: 1;
  }
  .export-btn {
    background: #222222;
    border: 1px solid #3A3A3A;
    color: #AAAAAA;
    font-size: 10px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .export-btn:hover {
    background: #003D7A;
    border-color: #003D7A;
    color: #FFFFFF;
  }
  .charts-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    padding: 0 2px 2px;
  }
</style>
