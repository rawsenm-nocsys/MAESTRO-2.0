<script>
  import { COLORS } from '$lib/theme.js';
  import { wsStatus, currentView, connectionMode, showConnectDialog, connDialogPreset, showAbout, showSidebar, showChartsPanel, playbackState } from '$lib/stores.js';
  import { connect, disconnect, sendCommand } from '$lib/ws.js';

  let connStatus = $derived($wsStatus);
  let view = $derived($currentView);
  let connMode = $derived($connectionMode);
  let pbState = $derived($playbackState);

  // Dropdown state
  let openMenu = $state(null);

  function toggleMenu(name) {
    openMenu = openMenu === name ? null : name;
  }

  function closeMenus() {
    openMenu = null;
  }

  // --- File menu ---
  function openLogFile() {
    closeMenus();
    showConnectDialog.set(true);
    connDialogPreset.set('Log File');
  }

  function exportCSV() {
    closeMenus();
    window.dispatchEvent(new CustomEvent('maestro-export-csv'));
  }

  // --- Connection menu ---
  function openConnect() {
    closeMenus();
    showConnectDialog.set(true);
  }

  function doDisconnect() {
    closeMenus();
    disconnect();
  }

  function openConnectPreset(preset) {
    closeMenus();
    showConnectDialog.set(true);
    connDialogPreset.set(preset);
  }

  // --- View menu ---
  function setView(v) {
    closeMenus();
    currentView.set(v);
  }

  function toggleSidebar() {
    closeMenus();
    showSidebar.update(v => !v);
  }

  function toggleCharts() {
    closeMenus();
    showChartsPanel.update(v => !v);
  }

  function resetLayout() {
    closeMenus();
    showSidebar.set(true);
    showChartsPanel.set(true);
    currentView.set('dashboard');
  }

  // --- Help menu ---
  function openAbout() {
    closeMenus();
    showAbout.update(v => !v);
  }

  // --- Toolbar buttons ---
  function toolbarConnect() {
    closeMenus();
    showConnectDialog.set(true);
  }

  function toolbarDisconnect() {
    closeMenus();
    disconnect();
  }

  // Playback only enabled for log file mode
  let isLog = $derived(connMode === 'log_file');

  // --- Playback controls ---
  function pbReplay() {
    sendCommand('log_replay');
  }

  function pbPlay() {
    sendCommand('log_play');
  }

  function pbPause() {
    sendCommand('log_pause');
  }

  function pbStop() {
    sendCommand('log_stop');
  }

  function pbSkip() {
    sendCommand('log_skip');
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="topbar" onclick={(e) => { if (!e.target.closest('.dropdown')) closeMenus(); }}>
  <!-- Brand -->
  <div class="brand">
    <img class="logo-img" src="/logo.png" alt="Nocturne" />
    <div class="logo-text">
      <span class="logo-title">NOCTURNE SYSTEMS</span>
      <span class="logo-subtitle">MAESTRO 2.0</span>
    </div>
  </div>

  <!-- FILE -->
  <div class="dropdown">
    <button class="menu-btn" class:open={openMenu === 'file'} onclick={() => toggleMenu('file')}>File</button>
    {#if openMenu === 'file'}
      <div class="dropdown-panel">
        <button class="dropdown-item" onclick={openLogFile}>Open Log File...</button>
        <button class="dropdown-item" onclick={exportCSV}>Export to CSV</button>
      </div>
    {/if}
  </div>

  <!-- CONNECTION -->
  <div class="dropdown">
    <button class="menu-btn" class:open={openMenu === 'connection'} onclick={() => toggleMenu('connection')}>Connection</button>
    {#if openMenu === 'connection'}
      <div class="dropdown-panel">
        <button class="dropdown-item" onclick={openConnect} disabled={connStatus === 'connected'}>Connect...</button>
        <button class="dropdown-item" onclick={doDisconnect} disabled={connStatus !== 'connected'}>Disconnect</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => openConnectPreset('Serial Port')}>Serial Port</button>
        <button class="dropdown-item" onclick={() => openConnectPreset('UDP Network')}>UDP Network</button>
        <button class="dropdown-item" onclick={() => openConnectPreset('TCP Network')}>TCP Network</button>
      </div>
    {/if}
  </div>

  <!-- VIEW -->
  <div class="dropdown">
    <button class="menu-btn" class:open={openMenu === 'view'} onclick={() => toggleMenu('view')}>View</button>
    {#if openMenu === 'view'}
      <div class="dropdown-panel">
        <button class="dropdown-item" class:active-item={view === 'dashboard'} onclick={() => setView('dashboard')}>Dashboard</button>
        <button class="dropdown-item" class:active-item={view === 'charts'} onclick={() => setView('charts')}>Charts (Full)</button>
        <button class="dropdown-item" class:active-item={view === 'visualizer'} onclick={() => setView('visualizer')}>Visualizer</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={toggleSidebar}>Show/Hide Sidebar</button>
        <button class="dropdown-item" onclick={toggleCharts}>Show/Hide Charts</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={resetLayout}>Reset Layout</button>
      </div>
    {/if}
  </div>

  <!-- HELP -->
  <div class="dropdown">
    <button class="menu-btn" class:open={openMenu === 'help'} onclick={() => toggleMenu('help')}>Help</button>
    {#if openMenu === 'help'}
      <div class="dropdown-panel">
        <button class="dropdown-item" onclick={openAbout}>About MAESTRO</button>
        <div class="dropdown-divider"></div>
        <a class="dropdown-item" href="https://nocturnesys.com" target="_blank" rel="noopener">Website</a>
      </div>
    {/if}
  </div>

  <div class="spacer"></div>

  <!-- Action buttons -->
  <button class="action-btn" disabled={connStatus === 'connected'} onclick={toolbarConnect}>Connect</button>
  <button class="action-btn" disabled={connStatus !== 'connected'} onclick={toolbarDisconnect}>Disconnect</button>

  <div class="btn-separator"></div>

  <!-- Playback controls — only enabled for Log File mode -->
  <button class="playback-btn" title="Replay" disabled={!isLog} onclick={pbReplay}>&#x21BB;</button>
  <button class="playback-btn" title="Play" disabled={!isLog || pbState?.playing} onclick={pbPlay}>&#x25B6;</button>
  <button class="playback-btn" title="Pause" disabled={!isLog || !pbState?.playing} onclick={pbPause}>&#x23F8;</button>
  <button class="playback-btn" title="Skip to End" disabled={!isLog} onclick={pbSkip}>&#x23ED;</button>

  <div class="btn-separator"></div>

  <!-- Connection dot -->
  <span class="conn-dot" style="background:{connStatus === 'connected' ? COLORS.green : connStatus === 'connecting' ? COLORS.yellow : COLORS.red_warn}"></span>
</div>

<style>
  .topbar {
    height: 50px;
    background: #1A1A1A;
    border-bottom: 1px solid #3A3A3A;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 0;
    flex-shrink: 0;
    position: relative;
    z-index: 100;
  }

  /* Brand */
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: 12px;
  }
  .logo-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    background: #FFFFFF;
    border: 1px solid #3A3A3A;
  }
  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .logo-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #FFFFFF;
  }
  .logo-subtitle {
    font-size: 8px;
    color: #AAAAAA;
    letter-spacing: 1px;
  }

  /* Dropdown menus */
  .dropdown {
    position: relative;
  }
  .menu-btn {
    background: none;
    border: none;
    color: #AAAAAA;
    font-size: 12px;
    font-weight: 500;
    padding: 8px 12px;
    cursor: pointer;
    font-family: inherit;
    border-radius: 3px;
  }
  .menu-btn:hover, .menu-btn.open {
    background: #222222;
    color: #FFFFFF;
  }
  .dropdown-panel {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 180px;
    background: #222222;
    border: 1px solid #3A3A3A;
    border-radius: 4px;
    padding: 4px 0;
    z-index: 200;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .dropdown-item {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: #CCCCCC;
    font-size: 12px;
    padding: 6px 14px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
  }
  a.dropdown-item {
    box-sizing: border-box;
  }
  .dropdown-item:hover {
    background: #003D7A;
    color: #FFFFFF;
  }
  .dropdown-item:disabled {
    color: #555555;
    cursor: default;
  }
  .dropdown-item:disabled:hover {
    background: none;
    color: #555555;
  }
  .dropdown-item.active-item {
    color: #00BFFF;
  }
  .dropdown-divider {
    height: 1px;
    background: #3A3A3A;
    margin: 4px 0;
  }

  .spacer { flex: 1; }

  /* Action buttons */
  .action-btn {
    background: #222222;
    border: 1px solid #3A3A3A;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    margin: 0 2px;
  }
  .action-btn:hover:not(:disabled) {
    background: #003D7A;
    border-color: #003D7A;
  }
  .action-btn:disabled {
    color: #555555;
    cursor: default;
    opacity: 0.5;
  }

  .btn-separator {
    width: 1px;
    height: 24px;
    background: #3A3A3A;
    margin: 0 8px;
  }

  /* Playback buttons */
  .playback-btn {
    background: #222222;
    border: 1px solid #3A3A3A;
    color: #FFFFFF;
    font-size: 13px;
    width: 32px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 1px;
    padding: 0;
  }
  .playback-btn:hover:not(:disabled) {
    background: #003D7A;
    border-color: #003D7A;
  }
  .playback-btn:disabled {
    color: #555555;
    cursor: default;
    opacity: 0.4;
  }

  /* Connection dot */
  .conn-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: 4px;
  }
</style>
