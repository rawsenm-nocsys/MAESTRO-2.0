<script>
  import { onMount } from 'svelte';
  import { COLORS } from '$lib/theme.js';
  import { telemetry, wsStatus, batchTrail } from '$lib/stores.js';
  import { fmt } from '$lib/units.js';

  let canvas;
  let animFrame;
  let trail = [];
  const MAX_TRAIL = 2000;

  let telem = $derived($telemetry);
  let connStatus = $derived($wsStatus);

  // Watch for batch trail data (skip-to-end)
  let bt = $derived($batchTrail);
  $effect(() => {
    if (bt && bt.length > 0) {
      trail = [...bt];
      // Clear the batch trail store so it doesn't re-trigger
      batchTrail.set(null);
      return;
    }
  });

  $effect(() => {
    if (connStatus !== 'connected') {
      trail = [];
      return;
    }
    if (telem && telem.lat !== 0 && telem.lon !== 0) {
      trail.push({ lat: telem.lat, lon: telem.lon, t: Date.now() });
      if (trail.length > MAX_TRAIL) trail.shift();
    }
  });

  function draw() {
    if (!canvas) { animFrame = requestAnimationFrame(draw); return; }
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 600;
    const h = rect?.height || 400;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = COLORS.map_bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    const gridSize = 40;
    ctx.strokeStyle = COLORS.map_grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (connStatus !== 'connected') {
      ctx.fillStyle = '#555555';
      ctx.font = '600 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DISCONNECTED', w / 2, h / 2 - 8);
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = '#444444';
      ctx.fillText('Connect to a data source to begin', w / 2, h / 2 + 12);
      animFrame = requestAnimationFrame(draw);
      return;
    }

    if (trail.length < 2) {
      ctx.fillStyle = COLORS.text_dim;
      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GPS TRACK', w / 2, h / 2 - 10);
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillText('Waiting for position data...', w / 2, h / 2 + 10);
      animFrame = requestAnimationFrame(draw);
      return;
    }

    // Auto-scale to fit trail
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const p of trail) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }

    // Add padding
    const latRange = (maxLat - minLat) || 0.001;
    const lonRange = (maxLon - minLon) || 0.001;
    const padFactor = 0.15;
    minLat -= latRange * padFactor;
    maxLat += latRange * padFactor;
    minLon -= lonRange * padFactor;
    maxLon += lonRange * padFactor;

    const margin = 30;
    const plotW = w - margin * 2;
    const plotH = h - margin * 2;

    function toX(lon) { return margin + ((lon - minLon) / (maxLon - minLon)) * plotW; }
    function toY(lat) { return margin + (1 - (lat - minLat) / (maxLat - minLat)) * plotH; }

    // Draw trail with fade
    for (let i = 1; i < trail.length; i++) {
      const alpha = 0.15 + 0.85 * (i / trail.length);
      ctx.beginPath();
      ctx.moveTo(toX(trail[i - 1].lon), toY(trail[i - 1].lat));
      ctx.lineTo(toX(trail[i].lon), toY(trail[i].lat));
      ctx.strokeStyle = `rgba(0,153,255,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Current position dot
    const last = trail[trail.length - 1];
    ctx.beginPath();
    ctx.arc(toX(last.lon), toY(last.lat), 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.waypoint_blue;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Heading indicator
    if (telem) {
      const headRad = (telem.heading - 90) * Math.PI / 180;
      const hx = toX(last.lon) + 18 * Math.cos(headRad);
      const hy = toY(last.lat) + 18 * Math.sin(headRad);
      ctx.beginPath();
      ctx.moveTo(toX(last.lon) + 7 * Math.cos(headRad), toY(last.lat) + 7 * Math.sin(headRad));
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = COLORS.yellow;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // HUD overlay - top left
    if (telem) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, 8, 200, 44);

      ctx.fillStyle = COLORS.text_gray;
      ctx.font = '10px "Consolas", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`LAT: ${telem.lat.toFixed(6)}°  LON: ${telem.lon.toFixed(6)}°`, 14, 22);
      ctx.fillText(`ALT: ${fmt(telem.altRel)}m  SPD: ${fmt(telem.groundspeed)} m/s  HDG: ${fmt(telem.heading, 0)}°`, 14, 38);
    }

    animFrame = requestAnimationFrame(draw);
  }

  onMount(() => {
    draw();
    return () => cancelAnimationFrame(animFrame);
  });
</script>

<div class="map-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: #101820;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
