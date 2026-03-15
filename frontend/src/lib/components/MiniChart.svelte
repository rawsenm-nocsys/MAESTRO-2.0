<script>
  import { onMount } from 'svelte';
  import { COLORS } from '$lib/theme.js';
  import { chartWindow, frozenTime } from '$lib/stores.js';

  let { buffer = null, title = '', unit = '', color = COLORS.cyan, height = 155, fixedYMin = null, fixedYMax = null } = $props();

  let canvas;
  let animFrame;
  let windowMs;
  let frozen = null;

  chartWindow.subscribe(v => { windowMs = v; });
  frozenTime.subscribe(v => { frozen = v; });

  function smooth(data, window = 7) {
    if (data.length < window) return data;
    const result = [];
    const half = Math.floor(window / 2);
    for (let i = 0; i < data.length; i++) {
      if (i < half || i >= data.length - half) {
        result.push(data[i]);
      } else {
        let sum = 0;
        for (let j = i - half; j <= i + half; j++) sum += data[j].v;
        result.push({ t: data[i].t, v: sum / window });
      }
    }
    return result;
  }

  function draw() {
    if (!canvas || !buffer) { animFrame = requestAnimationFrame(draw); return; }
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement?.clientWidth || 300;
    const h = height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const pad = { top: 22, right: 10, bottom: 20, left: 10 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.panel_border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Title
    ctx.fillStyle = COLORS.text_dim;
    ctx.font = '600 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title.toUpperCase(), pad.left + 4, 14);

    // Use frozen time if set, otherwise live
    const now = frozen || Date.now();

    // Get data using the reference time
    const raw = buffer.getWindow(windowMs, now);
    const data = smooth(raw);

    if (data.length < 2) {
      ctx.fillStyle = COLORS.text_dim;
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data...', w / 2, h / 2);
      animFrame = requestAnimationFrame(draw);
      return;
    }

    // Compute Y bounds — use fixed bounds if provided, otherwise auto-scale
    let yMin, yMax;
    if (fixedYMin !== null && fixedYMax !== null) {
      yMin = fixedYMin;
      yMax = fixedYMax;
    } else {
      yMin = Infinity;
      yMax = -Infinity;
      for (const pt of data) {
        if (pt.v < yMin) yMin = pt.v;
        if (pt.v > yMax) yMax = pt.v;
      }
      const yRange = yMax - yMin || 1;
      yMin -= yRange * 0.1;
      yMax += yRange * 0.1;
    }

    const tMin = now - windowMs;
    const tMax = now;

    function toX(t) { return pad.left + ((t - tMin) / (tMax - tMin)) * cw; }
    function toY(v) { return pad.top + (1 - (v - yMin) / (yMax - yMin)) * ch; }

    // Grid lines (3 horizontal)
    ctx.strokeStyle = COLORS.panel_border;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (ch * i) / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Data line
    ctx.beginPath();
    ctx.moveTo(toX(data[0].t), toY(data[0].v));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(toX(data[i].t), toY(data[i].v));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(toX(data[data.length - 1].t), pad.top + ch);
    ctx.lineTo(toX(data[0].t), pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = color + '14'; // ~8% opacity
    ctx.fill();

    // Latest value annotation
    const latest = data[data.length - 1];
    const latestStr = Math.abs(latest.v) >= 100 ? Math.round(latest.v).toString() : latest.v.toFixed(1);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${latestStr} ${unit}`, w - pad.right - 4, 14);

    animFrame = requestAnimationFrame(draw);
  }

  onMount(() => {
    draw();
    return () => cancelAnimationFrame(animFrame);
  });
</script>

<div class="mini-chart" style="height: {height}px">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .mini-chart {
    width: 100%;
    position: relative;
  }
  canvas {
    display: block;
    width: 100%;
  }
</style>
