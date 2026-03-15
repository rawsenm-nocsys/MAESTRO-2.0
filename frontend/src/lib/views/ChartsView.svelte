<script>
  import MiniChart from '$lib/components/MiniChart.svelte';
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

  function setWindow(ms) { chartWindow.set(ms); }

  function exportCSV() {
    const streams = {
      'altitude_rel': chartBuffers.altRel,
      'groundspeed': chartBuffers.groundspeed,
      'velocity_x': chartBuffers.vx,
      'velocity_y': chartBuffers.vy,
      'velocity_z': chartBuffers.vz,
      'accel_x': chartBuffers.accelX,
      'accel_y': chartBuffers.accelY,
      'accel_z': chartBuffers.accelZ,
      'battery_voltage': chartBuffers.batteryV,
      'battery_current': chartBuffers.batteryA,
    };

    // Collect all timestamps
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

  const charts = [
    { buffer: chartBuffers.altRel, title: 'Altitude', unit: 'm', color: COLORS.chart_cyan },
    { buffer: chartBuffers.vx, title: 'Velocity X', unit: 'm/s', color: COLORS.chart_red },
    { buffer: chartBuffers.vy, title: 'Velocity Y', unit: 'm/s', color: COLORS.chart_green2 },
    { buffer: chartBuffers.vz, title: 'Velocity Z', unit: 'm/s', color: COLORS.chart_blue },
    { buffer: chartBuffers.accelX, title: 'Accel X', unit: 'm/s²', color: COLORS.chart_orange },
    { buffer: chartBuffers.accelY, title: 'Accel Y', unit: 'm/s²', color: COLORS.chart_teal },
    { buffer: chartBuffers.accelZ, title: 'Accel Z', unit: 'm/s²', color: COLORS.chart_violet },
    { buffer: chartBuffers.batteryV, title: 'Battery Voltage', unit: 'V', color: COLORS.chart_yellow },
    { buffer: chartBuffers.batteryA, title: 'Battery Current', unit: 'A', color: COLORS.chart_pink },
  ];
</script>

<div class="charts-view">
  <div class="charts-toolbar">
    <div class="time-pills">
      {#each windows as w}
        <button class="pill" class:active={activeWindow === w.ms} onclick={() => setWindow(w.ms)}>
          {w.label}
        </button>
      {/each}
    </div>
    <button class="export-btn" onclick={exportCSV}>Export CSV</button>
  </div>

  <div class="charts-grid">
    {#each charts as chart}
      <MiniChart buffer={chart.buffer} title={chart.title} unit={chart.unit} color={chart.color} height={175} />
    {/each}
  </div>
</div>

<style>
  .charts-view {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  .charts-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
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
  .pill:hover { background: #2A2A2A; color: #FFFFFF; }
  .pill.active { background: #003D7A; border-color: #003D7A; color: #FFFFFF; }
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
  .export-btn:hover { background: #003D7A; color: #FFFFFF; border-color: #003D7A; }
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
</style>
