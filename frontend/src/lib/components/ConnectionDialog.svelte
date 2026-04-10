<script>
  import { COLORS } from '$lib/theme.js';
  import { showConnectDialog, connDialogPreset, wsStatus, deviceName } from '$lib/stores.js';
  import { connect, sendCommand } from '$lib/ws.js';
  import { get } from 'svelte/store';

  let connType = $state('Serial Port');
  let serialPort = $state('COM3');
  let baudRate = $state(57600);
  let udpAddress = $state('127.0.0.1');
  let udpPort = $state(14550);
  let tcpAddress = $state('127.0.0.1');
  let tcpPort = $state(5760);
  let logFile = $state(null);
  let connecting = $state(false);
  let error = $state('');
  let statusMsg = $state('');

  let visible = $derived($showConnectDialog);
  let status = $derived($wsStatus);

  // Apply preset when dialog opens
  $effect(() => {
    const preset = $connDialogPreset;
    if (preset && visible) {
      connType = preset;
      connDialogPreset.set('');
    }
  });

  function close() {
    showConnectDialog.set(false);
    connecting = false;
    error = '';
    statusMsg = '';
  }

  async function doConnect() {
    error = '';
    connecting = true;

    try {
      if (connType === 'Log File') {
        if (!logFile) {
          error = 'Please select a log file';
          connecting = false;
          return;
        }

        // Step 1: Upload log file to server
        statusMsg = 'Uploading log file...';
        const formData = new FormData();
        formData.append('logfile', logFile);

        const uploadRes = await fetch('/api/upload-log', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
        }

        const uploadData = await uploadRes.json();
        console.log('[LOG] Upload result:', uploadData);

        // Step 2: Connect WebSocket and start playback
        statusMsg = 'Connecting...';
        connect('log_file');

        // Set device name from filename
        const fname = logFile.name.replace(/\.(tlog|bin)$/i, '');
        const displayName = fname.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        deviceName.set(displayName);

        // Wait a moment for WebSocket to connect, then auto-play
        setTimeout(() => {
          sendCommand('log_play');
        }, 1500);

        connecting = false;
        statusMsg = '';
        close();
        return;
      } else if (connType === 'ADAGIO Live') {
        connect('live');
        connecting = false;
        statusMsg = '';
        close();
        return;
      } else {
        connect('websocket');
      }

      // Wait for connection (non-log-file connections)
      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
        const unsub = wsStatus.subscribe(s => {
          if (s === 'connected') {
            clearTimeout(timeout);
            unsub();
            resolve();
          }
        });
      });

      connecting = false;
      statusMsg = '';
      close();
    } catch (e) {
      error = 'Connection failed: ' + e.message;
      connecting = false;
      statusMsg = '';
    }
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      logFile = files[0];
    }
  }

  const baudRates = [9600, 57600, 115200, 230400];
  const connTypes = ['Serial Port', 'UDP Network', 'TCP Network', 'Log File', 'ADAGIO Live'];
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <div class="dialog-header">
        <span class="dialog-title">Connect to Data Source</span>
        <button class="close-btn" onclick={close}>&times;</button>
      </div>

      <div class="dialog-body">
        <!-- Connection type selector -->
        <div class="field">
          <label class="field-label">Connection Type</label>
          <select class="field-input" bind:value={connType}>
            {#each connTypes as ct}
              <option value={ct}>{ct}</option>
            {/each}
          </select>
        </div>

        {#if connType === 'Serial Port'}
          <div class="field">
            <label class="field-label">Port</label>
            <input class="field-input" type="text" bind:value={serialPort} placeholder="COM3" />
          </div>
          <div class="field">
            <label class="field-label">Baud Rate</label>
            <select class="field-input" bind:value={baudRate}>
              {#each baudRates as br}
                <option value={br}>{br}</option>
              {/each}
            </select>
          </div>

        {:else if connType === 'UDP Network'}
          <div class="field">
            <label class="field-label">Address</label>
            <input class="field-input" type="text" bind:value={udpAddress} placeholder="127.0.0.1" />
          </div>
          <div class="field">
            <label class="field-label">Port</label>
            <input class="field-input" type="number" bind:value={udpPort} min={1} max={65535} />
          </div>

        {:else if connType === 'TCP Network'}
          <div class="field">
            <label class="field-label">Address</label>
            <input class="field-input" type="text" bind:value={tcpAddress} placeholder="127.0.0.1" />
          </div>
          <div class="field">
            <label class="field-label">Port</label>
            <input class="field-input" type="number" bind:value={tcpPort} min={1} max={65535} />
          </div>

        {:else if connType === 'Log File'}
          <div class="field">
            <label class="field-label">Log File (.tlog, .bin)</label>
            <input class="file-input" type="file" accept=".tlog,.bin" onchange={handleFileSelect} />
          </div>
          {#if logFile}
            <div class="file-info">
              {logFile.name} ({(logFile.size / 1024).toFixed(1)} KB)
            </div>
          {/if}

        {:else if connType === 'ADAGIO Live'}
          <div class="adagio-info">
            <div class="adagio-info-row"><span class="adagio-key">WiFi AP</span><span class="adagio-val">MAESTRO_GS</span></div>
            <div class="adagio-info-row"><span class="adagio-key">GS IP</span><span class="adagio-val">192.168.50.1</span></div>
            <div class="adagio-info-row"><span class="adagio-key">Discovery</span><span class="adagio-val">UDP :5010</span></div>
            <div class="adagio-info-row"><span class="adagio-key">NRF24</span><span class="adagio-val">ch108 · 250 kbps</span></div>
            <div class="adagio-info-row"><span class="adagio-key">Max devices</span><span class="adagio-val">3</span></div>
          </div>
          <div class="status-msg">Ensure ADAGIO_EDU_MAESTRO firmware is flashed and the RPi WiFi AP is active.</div>
        {/if}

        {#if statusMsg}
          <div class="status-msg">{statusMsg}</div>
        {/if}

        {#if error}
          <div class="error-msg">{error}</div>
        {/if}
      </div>

      <div class="dialog-footer">
        {#if connType === 'Log File'}
          <button class="btn btn-primary" onclick={doConnect} disabled={connecting || !logFile}>
            {connecting ? 'Loading...' : 'Load Log'}
          </button>
        {:else if connType === 'ADAGIO Live'}
          <button class="btn btn-live" onclick={doConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Go Live'}
          </button>
        {:else}
          <button class="btn btn-primary" onclick={doConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Now'}
          </button>
        {/if}
        <button class="btn btn-secondary" onclick={close}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
  }
  .dialog {
    background: #1A1A1A;
    border: 1px solid #3A3A3A;
    border-radius: 8px;
    width: 380px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #2A2A2A;
  }
  .dialog-title {
    font-size: 14px;
    font-weight: 700;
    color: #FFFFFF;
  }
  .close-btn {
    background: none;
    border: none;
    color: #AAAAAA;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .close-btn:hover { color: #FFFFFF; }
  .dialog-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field-label {
    font-size: 11px;
    color: #AAAAAA;
    font-weight: 600;
  }
  .field-input, .file-input {
    background: #222222;
    border: 1px solid #3A3A3A;
    border-radius: 4px;
    color: #FFFFFF;
    font-size: 12px;
    padding: 8px 10px;
    font-family: inherit;
    outline: none;
  }
  .field-input:focus {
    border-color: #003D7A;
  }
  select.field-input {
    cursor: pointer;
  }
  .file-input {
    padding: 6px;
    font-size: 11px;
  }
  .file-input::file-selector-button {
    background: #003D7A;
    border: none;
    color: #FFFFFF;
    padding: 4px 12px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    margin-right: 8px;
  }
  .file-info {
    font-size: 11px;
    color: #00BFFF;
    padding: 4px 0;
  }
  .status-msg {
    color: #00BFFF;
    font-size: 11px;
    padding: 6px 8px;
    background: rgba(0,191,255,0.1);
    border-radius: 4px;
  }
  .error-msg {
    color: #FF3B30;
    font-size: 11px;
    padding: 6px 8px;
    background: rgba(255,59,48,0.1);
    border-radius: 4px;
  }
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #2A2A2A;
  }
  .btn {
    font-size: 12px;
    font-weight: 600;
    padding: 7px 18px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    border: none;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-primary {
    background: #003D7A;
    color: #FFFFFF;
  }
  .btn-primary:hover:not(:disabled) { background: #00508F; }
  .btn-secondary {
    background: #222222;
    color: #AAAAAA;
    border: 1px solid #3A3A3A;
  }
  .btn-secondary:hover { background: #2A2A2A; color: #FFFFFF; }
  .btn-live {
    background: #0A3A2A;
    color: #4ADE80;
    border: 1px solid #1A6040;
  }
  .btn-live:hover:not(:disabled) { background: #0D4A35; }
  /* ADAGIO Live info panel */
  .adagio-info {
    background: #111111;
    border: 1px solid #2A2A2A;
    border-radius: 4px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .adagio-info-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
  .adagio-key {
    color: #666666;
  }
  .adagio-val {
    color: #22D3EE;
    font-family: 'Consolas', 'Courier New', monospace;
  }
</style>
