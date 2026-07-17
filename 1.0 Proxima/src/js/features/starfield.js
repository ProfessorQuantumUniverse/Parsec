export function createStarfield(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stars = [];
  let raf = 0;
  let running = false;
  let last = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(220, Math.floor((innerWidth * innerHeight) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.6 + 0.2,
      tw: Math.random() * 0.02 + 0.004,
      dir: Math.random() < 0.5 ? 1 : -1,
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.02,
    }));
    draw(true);
  }

  function draw(force) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      if (!reduce) {
        s.a += s.tw * s.dir;
        if (s.a > 0.9 || s.a < 0.15) s.dir *= -1;
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = innerWidth;
        if (s.x > innerWidth) s.x = 0;
        if (s.y < 0) s.y = innerHeight;
        if (s.y > innerHeight) s.y = 0;
      }
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#eaf4ff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (force) return;
  }

  function loop(t) {
    if (!running) return;
    if (t - last > 33) { // ~30fps cap
      draw(false);
      last = t;
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    if (reduce) { draw(true); return; }
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onVisibility = () => (document.hidden ? stop() : start());
  addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  start();

  return {
    destroy() {
      stop();
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    },
  };
}
