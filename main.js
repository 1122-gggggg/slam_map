(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- reveal on scroll ---------- */
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  } else items.forEach((el) => el.classList.add('in'));

  /* ---------- contact form -> mailto (static site, no backend) ---------- */
  const form = document.getElementById('form');
  const note = document.getElementById('formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll('[required]').forEach((f) => {
      const bad = !f.value.trim() || (f.type === 'email' && !f.validity.valid);
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.style.color = '#ff6b8b'; note.textContent = '請填寫姓名、有效 Email 與需求說明。'; return; }
    const d = Object.fromEntries(new FormData(form));
    const body = `姓名：${d.name}\nEmail：${d.email}\n公司：${d.org || '-'}\n類型：${d.type}\n\n${d.msg}`;
    location.href = `mailto:founder@visionmap.tech?subject=${encodeURIComponent('[官網詢問] ' + d.type + ' - ' + d.name)}&body=${encodeURIComponent(body)}`;
    note.style.color = '';
    note.textContent = '已開啟你的郵件程式，請按送出完成寄信。';
  });

  /* ---------- reconstruction illustration: points -> mesh -> textured ---------- */
  const recon = document.getElementById('recon');
  if (recon) {
    const G = [
      [[15, 30], [50, 14], [85, 22], [120, 32]],
      [[15, 62], [50, 48], [85, 40], [120, 58]],
      [[15, 94], [50, 82], [85, 86], [120, 90]],
      [[15, 124], [50, 118], [85, 110], [120, 126]],
    ];
    const panel = (ox, mode, label) => {
      let s = `<g transform="translate(${ox} 36)">`;
      if (mode === 2) {
        let i = 0;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const a = G[r][c], b = G[r][c + 1], d = G[r + 1][c + 1], e = G[r + 1][c];
          for (const tri of [[a, b, d], [a, d, e]]) {
            const o = 0.18 + 0.5 * (((c * 3 + r * 5 + i++ * 7) % 10) / 10);
            const col = i % 3 === 0 ? '124,255,178' : '56,225,255';
            s += `<polygon points="${tri.map((p) => p.join(',')).join(' ')}" fill="rgba(${col},${o.toFixed(2)})" stroke="rgba(56,225,255,.35)" stroke-width=".6"/>`;
          }
        }
      }
      if (mode === 1) {
        let d = '';
        for (let r = 0; r < 4; r++) d += 'M' + G[r].map((p) => p.join(',')).join('L');
        for (let c = 0; c < 4; c++) d += 'M' + G.map((row) => row[c].join(',')).join('L');
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) d += `M${G[r][c].join(',')}L${G[r + 1][c + 1].join(',')}`;
        s += `<path d="${d}" fill="none" stroke="rgba(56,225,255,.6)" stroke-width="1"/>`;
      }
      if (mode < 2) for (const row of G) for (const p of row) s += `<circle cx="${p[0]}" cy="${p[1]}" r="${mode === 0 ? 3 : 2.2}" fill="#38e1ff"/>`;
      if (mode === 0) for (let k = 0; k < 40; k++) s += `<circle cx="${(10 + ((k * 37) % 115))}" cy="${(14 + ((k * 53) % 118))}" r="1.3" fill="#38e1ff" fill-opacity=".55"/>`;
      s += `<text x="68" y="168" text-anchor="middle" font-size="12" fill="#9fb3c8" font-family="ui-monospace,Consolas,monospace">${label}</text></g>`;
      return s;
    };
    recon.innerHTML = panel(12, 0, 'point cloud') + panel(170, 1, 'mesh') + panel(328, 2, 'textured model') +
      '<g stroke="#38e1ff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"><path d="M152 100l8 0M148 94l8 6-8 6"/><path d="M310 100l8 0M306 94l8 6-8 6"/></g>';
  }

  /* ---------- hero scene: drone scanning terrain ---------- */
  const cv = document.getElementById('scene');
  const ctx = cv.getContext('2d');
  const PITCH = 0.5, SP = Math.sin(PITCH), CP = Math.cos(PITCH);
  const CAM_Y = 46, ZNEAR = 24, ZFAR = 250, ZD = 58, DRONE_ALT = 20, SPEED = 14;
  let W = 0, H = 0, F = 1, offX = 0, offY = 0, camX = 0, camTarget = 0, travel = 0, t = 0, last = 0;
  const pts = [];
  const trail = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // terrain height at world (x, z)
  const hgt = (x, z) => 0.6 * (
    7 * Math.sin(x * 0.045 + z * 0.02) + 5 * Math.sin(x * 0.09 - z * 0.05 + 1.3) +
    3 * Math.sin(x * 0.17 + z * 0.11 + 2.1) + 4 * Math.sin(z * 0.035 + 0.5));

  const proj = (x, y, z) => {
    const Y = y - CAM_Y, d = -Y * SP + z * CP;
    if (d < 4) return null;
    const up = Y * CP + z * SP, s = F / d;
    return [W / 2 + offX + (x - camX) * s, H * 0.55 + offY - up * s, s];
  };

  const newPoint = (p, z) => {
    p.z = z;
    p.x = rnd(-1, 1) * (z * 0.9 + 25);
    return p;
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = Math.max(H * 0.95, W * 0.55);
    offX = W > 900 ? W * 0.16 : 0;
    offY = W > 900 ? 0 : H * 0.2;
    const n = W < 760 ? 2200 : 4800;
    pts.length = 0;
    for (let i = 0; i < n; i++) pts.push(newPoint({}, rnd(ZNEAR, ZFAR)));
  };

  const heightColor = (y, a) => {
    const k = clamp((y + 12) / 24, 0, 1);
    const r = Math.round(56 + (255 - 56) * Math.max(0, k - 0.55) * 2.2 + (124 - 56) * Math.min(k, 0.55) * 0.6);
    const g = Math.round(225 + 30 * Math.min(k, 0.6));
    const b = Math.round(255 - 77 * Math.min(k * 1.6, 1) - (k > 0.7 ? 60 : 0));
    return `rgba(${Math.min(r, 255)},${Math.min(g, 255)},${clamp(b, 90, 255)},${a})`;
  };

  const frame = (now) => {
    const dt = reduce ? 0.016 : Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    travel += SPEED * dt;
    camX += (camTarget - camX) * Math.min(1, dt * 3);
    ctx.clearRect(0, 0, W, H);

    // --- reconstructed mesh behind the drone (nearer rows) ---
    const STEP_Z = 5, STEP_X = 8;
    const z0 = ZNEAR - (travel % STEP_Z);
    const rows = [];
    for (let z = z0; z < ZD + 16; z += STEP_Z) {
      if (z < ZNEAR - STEP_Z) continue;
      const row = [];
      const span = z * 0.95 + 40;
      for (let x = -Math.ceil(span / STEP_X) * STEP_X; x <= span; x += STEP_X) {
        const y = hgt(x, z + travel);
        row.push({ x, y, z, p: proj(x, y, z) });
      }
      rows.push(row);
    }
    const meshA = (z) => clamp((ZD + 8 - z) / 24, 0, 1) * clamp(1.1 - z / ZFAR, 0, 1);
    ctx.lineWidth = 1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const a = meshA(row[0].z);
      if (a <= 0.01) continue;
      // shaded quads between this row and the next
      const nx0 = rows[r + 1];
      if (nx0 && nx0.length) {
        for (let i = 0; i < row.length - 1; i++) {
          const A = row[i], B = row[i + 1];
          const ci = clamp(Math.round((A.x - nx0[0].x) / STEP_X), 0, nx0.length - 2);
          const C = nx0[ci + 1], D = nx0[ci];
          if (!A.p || !B.p || !C.p || !D.p) continue;
          const lit = clamp(0.5 + (A.y - D.y) * 0.05 + (A.y - B.y) * 0.04, 0, 1);
          ctx.fillStyle = `rgba(${Math.round(30 + 90 * lit)},${Math.round(150 + 80 * lit)},${Math.round(210 - 30 * lit)},${(a * (0.12 + 0.3 * lit)).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(A.p[0], A.p[1]); ctx.lineTo(B.p[0], B.p[1]); ctx.lineTo(C.p[0], C.p[1]); ctx.lineTo(D.p[0], D.p[1]);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.strokeStyle = `rgba(56,225,255,${(a * 0.7).toFixed(3)})`;
      ctx.beginPath();
      let pen = false;
      for (const v of row) {
        if (!v.p) { pen = false; continue; }
        if (!pen) { ctx.moveTo(v.p[0], v.p[1]); pen = true; } else ctx.lineTo(v.p[0], v.p[1]);
      }
      ctx.stroke();
      // cross-row lines (to next row) with diagonal to read as triangles
      const nx = rows[r + 1];
      if (nx && nx.length) {
        ctx.beginPath();
        for (let i = 0; i < row.length; i++) {
          const v = row[i];
          const w = nx[clamp(Math.round((v.x - nx[0].x) / STEP_X), 0, nx.length - 1)];
          if (!v.p || !w || !w.p) continue;
          ctx.moveTo(v.p[0], v.p[1]); ctx.lineTo(w.p[0], w.p[1]);
        }
        ctx.stroke();
      }
    }

    // --- point cloud ---
    for (const p of pts) {
      p.z -= SPEED * dt;
      if (p.z < ZNEAR) newPoint(p, ZFAR);
      const y = hgt(p.x, p.z + travel);
      const q = proj(p.x, y, p.z);
      if (!q || q[0] < -6 || q[0] > W + 6 || q[1] < -6 || q[1] > H + 6) continue;
      const ahead = p.z > ZD;
      const a = clamp(1.15 - p.z / ZFAR, 0.12, 1) * (ahead ? 1 : 0.55);
      const sz = clamp(q[2] * 0.28, 1, 3);
      ctx.fillStyle = heightColor(y, a.toFixed(3));
      ctx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
    }

    // --- drone state ---
    const dx = 16 * Math.sin(t * 0.35);
    const dy = DRONE_ALT + 1.2 * Math.sin(t * 1.3);
    trail.push({ x: dx, y: dy, z: ZD });
    for (const v of trail) v.z -= SPEED * dt;
    while (trail.length && trail[0].z < ZNEAR) trail.shift();
    if (trail.length > 400) trail.shift();

    // flight path
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 7]);
    ctx.strokeStyle = 'rgba(124,255,178,.75)';
    ctx.beginPath();
    let pen = false;
    for (const v of trail) {
      const q = proj(v.x, v.y, v.z);
      if (!q) { pen = false; continue; }
      if (!pen) { ctx.moveTo(q[0], q[1]); pen = true; } else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // scan footprint + cone
    const gy = hgt(dx, ZD + travel);
    const R = 15, N = 36;
    const ring = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = dx + Math.cos(a) * R, z = ZD + Math.sin(a) * R;
      ring.push(proj(x, hgt(x, z + travel) + 0.3, z));
    }
    const dronePos = proj(dx, dy, ZD);
    if (dronePos && ring.every(Boolean)) {
      ctx.strokeStyle = 'rgba(56,225,255,.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const i of [0, 9, 18, 27]) { ctx.moveTo(dronePos[0], dronePos[1]); ctx.lineTo(ring[i][0], ring[i][1]); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(56,225,255,.10)';
      ctx.strokeStyle = 'rgba(56,225,255,.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ring.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // sweep line
      const sw = Math.sin(t * 2.2) * R;
      const a1 = proj(dx - R, hgt(dx - R, ZD + sw + travel) + 0.4, ZD + sw);
      const a2 = proj(dx + R, hgt(dx + R, ZD + sw + travel) + 0.4, ZD + sw);
      if (a1 && a2) {
        ctx.strokeStyle = 'rgba(255,209,102,.9)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
      }

      // drone body
      const s = dronePos[2] * 1.7, bx = dronePos[0], by = dronePos[1];
      const roll = Math.cos(t * 0.35) * 0.12;
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(roll);
      const arm = 1.7 * s, rr = 1.0 * s, ry = rr * 0.38;
      ctx.strokeStyle = '#e8f1fa'; ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-arm, -arm * 0.38); ctx.lineTo(arm, arm * 0.38);
      ctx.moveTo(arm, -arm * 0.38); ctx.lineTo(-arm, arm * 0.38);
      ctx.stroke();
      for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.fillStyle = `rgba(56,225,255,${0.12 + 0.1 * Math.sin(t * 60 + ax)})`;
        ctx.strokeStyle = 'rgba(232,241,250,.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ax * arm, ay * arm * 0.38, rr, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#0b1520'; ctx.strokeStyle = '#38e1ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-0.6 * s, -0.4 * s, 1.2 * s, 0.8 * s, 0.25 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#38e1ff';
      ctx.beginPath(); ctx.arc(0, 0.5 * s, 0.22 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // HUD
      ctx.font = '11px ui-monospace,Consolas,monospace';
      ctx.fillStyle = 'rgba(190,215,235,.9)';
      const dir = bx + 2.6 * s + 100 > W ? -1 : 1;
      const hx = bx + dir * 2.6 * s, hy = by - 1.4 * s;
      ctx.strokeStyle = 'rgba(190,215,235,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + dir * 1.2 * s, by - 0.4 * s); ctx.lineTo(hx, hy); ctx.lineTo(hx + dir * 96, hy); ctx.stroke();
      const tx = dir > 0 ? hx + 4 : hx - 92;
      ctx.fillText(`ALT ${(dy - gy).toFixed(1)} m`, tx, hy - 4);
      ctx.fillText(`SPD ${SPEED.toFixed(1)} m/s`, tx, hy + 13);
    }
  };

  resize();
  addEventListener('resize', () => { resize(); if (reduce) { last = performance.now(); frame(last); } });
  addEventListener('pointermove', (e) => { camTarget = ((e.clientX / innerWidth) - 0.5) * 24; }, { passive: true });

  if (reduce) {
    // warm up the trail, then draw one static frame
    last = performance.now();
    for (let i = 0; i < 90; i++) frame(last + i * 16);
  } else {
    const hero = document.getElementById('top');
    let visible = true, raf = 0;
    const tick = (n) => {
      if (!visible || document.hidden) { raf = 0; return; }
      frame(n);
      raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (visible && !document.hidden && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(hero);
    document.addEventListener('visibilitychange', wake);
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
})();
