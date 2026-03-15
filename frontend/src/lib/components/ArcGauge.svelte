<script>
  import { onMount } from 'svelte';
  import { COLORS } from '$lib/theme.js';

  let { value = 0, min = 0, max = 100, title = '', unit = '', color = COLORS.cyan, size = 150 } = $props();

  let canvas;
  const ARC_START = (225 * Math.PI) / 180;
  const ARC_SWEEP = (270 * Math.PI) / 180;

  function getStatusColor(pct) {
    if (pct > 0.7) return COLORS.green;
    if (pct > 0.3) return COLORS.yellow;
    return COLORS.red_warn;
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = size;
    const h = size;
    const cx = w / 2;
    const cy = h / 2;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const outerR = w * 0.47;
    const innerR = w * 0.38;
    const arcR = w * 0.425;

    // Outer ring background
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#1E1E1E';
    ctx.fill();
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Background arc track
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, ARC_START, ARC_START - ARC_SWEEP, true);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Value arc
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    if (pct > 0.005) {
      const endAngle = ARC_START - ARC_SWEEP * pct;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, ARC_START, endAngle, true);
      ctx.strokeStyle = color || getStatusColor(pct);
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Tick marks (every 45 degrees of the 270-degree arc)
    for (let i = 0; i <= 6; i++) {
      const angle = ARC_START - (ARC_SWEEP * i) / 6;
      const x1 = cx + (outerR - 2) * Math.cos(angle);
      const y1 = cy - (outerR - 2) * Math.sin(angle);
      const x2 = cx + (outerR - 7) * Math.cos(angle);
      const y2 = cy - (outerR - 7) * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center value text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text_white;
    ctx.font = `bold ${Math.round(w * 0.14)}px 'Segoe UI', sans-serif`;
    const displayVal = value != null ? (Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(1)) : '--';
    ctx.fillText(displayVal, cx, cy - 4);

    // Unit
    ctx.fillStyle = COLORS.text_gray;
    ctx.font = `${Math.round(w * 0.07)}px 'Segoe UI', sans-serif`;
    ctx.fillText(unit, cx, cy + w * 0.1);

    // Title
    ctx.fillStyle = COLORS.text_dim;
    ctx.font = `600 ${Math.round(w * 0.055)}px 'Segoe UI', sans-serif`;
    ctx.fillText(title.toUpperCase(), cx, cy + w * 0.2);
  }

  onMount(() => { draw(); });
  $effect(() => { value; draw(); });
</script>

<canvas bind:this={canvas} class="arc-gauge"></canvas>

<style>
  .arc-gauge {
    display: block;
  }
</style>
