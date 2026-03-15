<script>
  import { currentView, telemetry, showSidebar, showChartsPanel, showAbout } from '$lib/stores.js';

  import TopBar from '$lib/components/TopBar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import DeviceCard from '$lib/components/DeviceCard.svelte';
  import ArcGauge from '$lib/components/ArcGauge.svelte';
  import AttitudeIndicator from '$lib/components/AttitudeIndicator.svelte';
  import TelemetryReadouts from '$lib/components/TelemetryReadouts.svelte';
  import MapCanvas from '$lib/components/MapCanvas.svelte';
  import ChartStrip from '$lib/components/ChartStrip.svelte';
  import ChartsView from '$lib/views/ChartsView.svelte';
  import SettingsView from '$lib/views/SettingsView.svelte';
  import ConnectionDialog from '$lib/components/ConnectionDialog.svelte';

  let telem = $derived($telemetry);
  let view = $derived($currentView);
  let sidebar = $derived($showSidebar);
  let charts = $derived($showChartsPanel);
  let aboutVisible = $derived($showAbout);

  function closeAbout() {
    showAbout.set(false);
  }
</script>

<div class="app">
  <TopBar />

  <div class="main-content">
    {#if view === 'dashboard'}
      <div class="dashboard">
        <!-- Sidebar -->
        {#if sidebar}
          <div class="sidebar">
            <div class="section-label">CONNECTED DEVICE</div>
            <DeviceCard />

            <div class="sidebar-divider"></div>
            <div class="section-label">FLIGHT INSTRUMENTS</div>

            <div class="gauges-row">
              <ArcGauge
                value={telem?.altRel ?? 0}
                min={0} max={200}
                title="Altitude" unit="m"
                color="#00BFFF"
                size={120}
              />
              <ArcGauge
                value={telem?.groundspeed ?? 0}
                min={0} max={30}
                title="Speed" unit="m/s"
                color="#34C759"
                size={120}
              />
            </div>

            <div class="section-label">ATTITUDE</div>
            <div class="attitude-wrapper">
              <AttitudeIndicator
                roll={telem?.roll ?? 0}
                pitch={telem?.pitch ?? 0}
                heading={telem?.heading ?? 0}
                size={200}
              />
            </div>

            <div class="sidebar-divider"></div>

            <div class="readouts-fill">
              <TelemetryReadouts />
            </div>
          </div>
        {/if}

        <!-- Main area -->
        <div class="main-area">
          <div class="map-area">
            <MapCanvas />
          </div>
          {#if charts}
            <ChartStrip />
          {/if}
        </div>
      </div>

    {:else if view === 'charts'}
      <ChartsView />

    {:else if view === 'settings'}
      <SettingsView />
    {/if}
  </div>

  <StatusBar />

  <!-- Connection dialog (modal) -->
  <ConnectionDialog />

  <!-- About dialog -->
  {#if aboutVisible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="about-overlay" onclick={closeAbout}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="about-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="about-header">
          <span class="about-title">About MAESTRO</span>
          <button class="about-close" onclick={closeAbout}>&times;</button>
        </div>
        <div class="about-body">
          <div class="about-logo">M</div>
          <div class="about-name">MAESTRO 2.0</div>
          <div class="about-org">Nocturne Systems</div>
          <div class="about-desc">UAV Ground Station Dashboard</div>
          <div class="about-ver">Version 2.0.0</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #141414;
    color: #FFFFFF;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .dashboard {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    width: 310px;
    min-width: 310px;
    background: #0D0D0D;
    border-right: 1px solid #2A2A2A;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    overflow-y: auto;
  }

  .section-label {
    font-size: 9px;
    font-weight: 700;
    color: #666666;
    letter-spacing: 1.5px;
    padding: 2px 4px;
  }

  .sidebar-divider {
    height: 1px;
    background: #2A2A2A;
    margin: 2px 0;
  }

  .gauges-row {
    display: flex;
    gap: 4px;
    justify-content: center;
    width: 100%;
  }

  .attitude-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    padding-bottom: 4px;
  }

  .readouts-fill {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .readouts-fill > :global(.readouts) {
    flex: 1;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .map-area {
    flex: 1;
    min-height: 200px;
  }

  /* About dialog */
  .about-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
  }
  .about-dialog {
    background: #1A1A1A;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    width: 300px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }
  .about-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #2A2A2A;
  }
  .about-title {
    font-size: 14px;
    font-weight: 700;
    color: #FFFFFF;
  }
  .about-close {
    background: none;
    border: none;
    color: #AAAAAA;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .about-close:hover { color: #FFFFFF; }
  .about-body {
    padding: 24px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .about-logo {
    width: 48px;
    height: 48px;
    background: #003D7A;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 24px;
    color: #FFFFFF;
    margin-bottom: 8px;
  }
  .about-name {
    font-size: 18px;
    font-weight: 700;
    color: #FFFFFF;
  }
  .about-org {
    font-size: 12px;
    color: #00BFFF;
    letter-spacing: 1px;
  }
  .about-desc {
    font-size: 11px;
    color: #AAAAAA;
  }
  .about-ver {
    font-size: 10px;
    color: #666666;
    margin-top: 4px;
  }

  /* Responsive: phone layout */
  @media (max-width: 768px) {
    .dashboard {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
      min-width: unset;
      border-right: none;
      border-bottom: 1px solid #2A2A2A;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      padding: 6px;
      overflow-y: visible;
      max-height: 280px;
    }
    .section-label, .sidebar-divider {
      display: none;
    }
    .gauges-row {
      gap: 2px;
    }
    .map-area {
      min-height: 250px;
    }
  }
</style>
