<script>
  import { onMount } from 'svelte';
  import { COLORS } from '$lib/theme.js';

  let { roll = 0, pitch = 0, heading = 0, size = 196 } = $props();

  let canvas;
  const DEG2RAD = Math.PI / 180;

  // Extra space at bottom for HDG text
  const HDG_HEIGHT = 20;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = size;
    const h = size + HDG_HEIGHT;
    const cx = w / 2;
    const cy = size / 2;
    const r = w * 0.44;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rollRad = -roll * DEG2RAD;
    const pitchOffset = (pitch / 45) * r;

    // Clip to rounded rectangle (square with rounded corners)
    const cornerR = 8;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, size, cornerR);
    ctx.clip();

    // Rotate by roll
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rollRad);

    // Sky
    ctx.fillStyle = 'rgba(26,58,92,0.9)';
    ctx.fillRect(-w, -w + pitchOffset, w * 2, w);

    // Ground
    ctx.fillStyle = 'rgba(74,46,26,0.9)';
    ctx.fillRect(-w, pitchOffset, w * 2, w);

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(-w, pitchOffset);
    ctx.lineTo(w, pitchOffset);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pitch ladder
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = -60; deg <= 60; deg += 10) {
      if (deg === 0) continue;
      const y = pitchOffset - (deg / 45) * r;
      const halfW = Math.abs(deg) % 30 === 0 ? 25 : 15;
      ctx.lineWidth = Math.abs(deg) % 30 === 0 ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.stroke();

      if (Math.abs(deg) % 20 === 0) {
        ctx.fillText(`${deg}`, halfW + 14, y);
        ctx.fillText(`${deg}`, -halfW - 14, y);
      }
    }

    ctx.restore(); // un-rotate

    // Aircraft reference (yellow wings + dot)
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.lineTo(cx - 15, cy);
    ctx.lineTo(cx - 15, cy + 6);
    ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + 40, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.lineTo(cx + 15, cy + 6);
    ctx.stroke();
    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.yellow;
    ctx.fill();

    ctx.restore(); // un-clip

    // Outer border (rounded rectangle)
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, w - 1, size - 1, cornerR);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Roll index ticks along top edge
    const tickAngles = [-60, -30, -20, -10, 0, 10, 20, 30, 60];
    for (const deg of tickAngles) {
      const a = (-90 + deg) * DEG2RAD;
      const isMajor = Math.abs(deg) % 30 === 0;
      const len = isMajor ? 10 : 6;
      const x1 = cx + r * Math.cos(a);
      const y1 = cy + r * Math.sin(a);
      const x2 = cx + (r - len) * Math.cos(a);
      const y2 = cy + (r - len) * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = COLORS.text_white;
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();
    }

    // Roll pointer (triangle at top)
    const rollPointerAngle = (-90 - roll) * DEG2RAD;
    const px = cx + (r - 2) * Math.cos(rollPointerAngle);
    const py = cy + (r - 2) * Math.sin(rollPointerAngle);
    ctx.beginPath();
    ctx.moveTo(px, py);
    const pl = cx + (r - 12) * Math.cos(rollPointerAngle - 0.08);
    const plt = cy + (r - 12) * Math.sin(rollPointerAngle - 0.08);
    const pr = cx + (r - 12) * Math.cos(rollPointerAngle + 0.08);
    const prt = cy + (r - 12) * Math.sin(rollPointerAngle + 0.08);
    ctx.lineTo(pl, plt);
    ctx.lineTo(pr, prt);
    ctx.closePath();
    ctx.fillStyle = COLORS.red_warn;
    ctx.fill();

    // Heading text below the square
    ctx.fillStyle = COLORS.text_white;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`HDG ${Math.round(heading)}°`, cx, size + 4);
  }

  onMount(() => { draw(); });
  $effect(() => { roll; pitch; heading; draw(); });
</script>

<canvas bind:this={canvas} class="attitude-indicator"></canvas>

<style>
  .attitude-indicator {
    display: block;
  }
</style>
