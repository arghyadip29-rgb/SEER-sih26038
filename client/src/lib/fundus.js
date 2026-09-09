export function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintFundus(ctx, W, H, o = {}) {
  const rnd = mulberry(o.seed || 7);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.52, 40, W * 0.5, H * 0.5, W * 0.62);
  g.addColorStop(0, '#E8632B'); g.addColorStop(0.45, '#C93F16');
  g.addColorStop(0.8, '#7A2410'); g.addColorStop(1, '#3A1208');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,4,2,.72)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (o.dark) {
    const d = ctx.createLinearGradient(0, 0, W, 0);
    d.addColorStop(0, 'rgba(0,0,0,.55)'); d.addColorStop(0.5, 'rgba(0,0,0,0)');
    ctx.fillStyle = d; ctx.fillRect(0, 0, W, H);
  }
  const dx = W * 0.72, dy = H * 0.42;
  ctx.fillStyle = '#F7C873'; ctx.strokeStyle = '#101828'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(dx, dy, W * 0.085, H * 0.105, -0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF3D0';
  ctx.beginPath(); ctx.ellipse(dx, dy, W * 0.035, H * 0.045, -0.2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(60,10,5,.55)';
  ctx.beginPath(); ctx.arc(W * 0.32, H * 0.55, W * 0.055, 0, 7); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + i * (2.1 / 9) + (rnd() - 0.5) * 0.2;
    ctx.strokeStyle = i % 2 ? '#8E1414' : '#A81D1D';
    ctx.lineWidth = 5.5 - (i % 3);
    ctx.beginPath(); ctx.moveTo(dx, dy);
    const len = W * (0.45 + rnd() * 0.3);
    ctx.quadraticCurveTo(dx + Math.cos(a) * len * 0.5, dy + Math.sin(a) * len * 0.55 + (rnd() - 0.5) * 40, dx + Math.cos(a) * len, dy + Math.sin(a) * len);
    ctx.stroke();
  }
  o._lesions = [];
  if (o.lesions) {
    const nMA = [0, 4, 9, 22, 16][o.grade] ?? 6;
    const nH = [0, 0, 6, 18, 26][o.grade] ?? 4;
    const nE = [0, 0, 5, 12, 9][o.grade] ?? 3;
    const put = (n, fn) => {
      for (let i = 0; i < n; i++) {
        const x = W * (0.18 + rnd() * 0.6), y = H * (0.2 + rnd() * 0.6);
        if (Math.hypot(x - dx, y - dy) < W * 0.11) continue;
        fn(x, y); o._lesions.push({ x, y });
      }
    };
    put(nMA, (x, y) => { ctx.fillStyle = '#7A0E0E'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 2.6 + rnd() * 1.8, 0, 7); ctx.fill(); ctx.stroke(); });
    put(nH, (x, y) => { ctx.fillStyle = '#5E0B0B'; ctx.beginPath(); ctx.ellipse(x, y, 4 + rnd() * 5, 3 + rnd() * 3, rnd() * 3, 0, 7); ctx.fill(); });
    put(nE, (x, y) => { ctx.fillStyle = '#FFD23E'; ctx.strokeStyle = '#7A4A00'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, 4.5 + rnd() * 4, 3 + rnd() * 2.5, rnd() * 3, 0, 7); ctx.fill(); });
    if (o.grade >= 4) {
      ctx.strokeStyle = '#B79CFF'; ctx.lineWidth = 3;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); const x = W * (0.3 + rnd() * 0.3), y = H * (0.3 + rnd() * 0.3); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 24, x + 58, y + 6); ctx.stroke(); }
    }
  }
  if (o.heat) {
    ctx.save(); ctx.globalAlpha = o.alpha ?? 0.75;
    (o._lesions.length ? o._lesions : [{ x: W * 0.4, y: H * 0.5 }]).forEach((p, i) => {
      const r = 44 + (i % 3) * 20;
      const hg = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r);
      hg.addColorStop(0, 'rgba(11,91,211,.9)'); hg.addColorStop(0.5, 'rgba(220,38,38,.55)'); hg.addColorStop(1, 'rgba(180,83,9,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    });
    ctx.restore();
  }
}
