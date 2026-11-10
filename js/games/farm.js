// 미니게임: 농장 키우기
// 실제 시간이 흐르면 작물이 자란다 (앱을 꺼 둬도). 씨앗 심기 → 물 주기(30% 빨리) → 수확 → 코인·경험치.
// 코인으로 밭을 넓히고, 레벨이 오르면 비싼 작물이 열린다.
'use strict';

(() => {
  const GRID = 4;               // 4x4 = 16칸
  const START_OPEN = 6;
  const START_COINS = 30;
  const WATER = 0.7;            // 물을 주면 자라는 시간 70%
  const O = '#1b1626';

  // time: 초, cost: 씨앗 값, sell: 수확 시 코인
  const CROPS = [
    { id: 1, name: '무', time: 30, cost: 5, sell: 12, art: 'radish' },
    { id: 2, name: '당근', time: 120, cost: 15, sell: 40, art: 'carrot' },
    { id: 3, name: '토마토', time: 300, cost: 30, sell: 90, art: 'tomato', lv: 2 },
    { id: 4, name: '옥수수', time: 900, cost: 60, sell: 220, art: 'corn', lv: 3 },
    { id: 5, name: '딸기', time: 1800, cost: 100, sell: 400, art: 'strawberry', lv: 5 },
    { id: 6, name: '호박', time: 3600, cost: 200, sell: 900, art: 'pumpkin', lv: 7 },
  ];

  const ART = {
    sprout: ['........', '........', '........', '........', '..g..g..', '..gggg..', '...gg...', '...gg...'],
    growing: ['........', '.g....g.', '.gg..gg.', '..gggg..', '.ggGGgg.', '...gg...', '...gg...', '...gg...'],
    radish: ['.g.gg.g.', '..gGGg..', '...gg...', '..wwww..', '.wwwwww.', '.wwwwWw.', '..wwWw..', '...ww...'],
    carrot: ['..g.g...', '...gg...', '..aaaa..', '..aAaa..', '...aaa..', '...aA...', '....a...', '........'],
    tomato: ['...gg...', '..gggg..', '.rrrrrr.', 'rrwrrrrr', 'rrrrrrRr', 'rrrrrRRr', '.rrRRRr.', '..rrrr..'],
    corn: ['...gg...', '..gyyg..', '..yYyy..', '.gyyYyg.', '.gyYyyg.', '.gyyYyg.', '..gyyg..', '...gg...'],
    strawberry: ['..gggg..', '...gg...', '.rrrrrr.', '.ryrryr.', '.rrrrrr.', '..ryrr..', '..rrrr..', '...rr...'],
    pumpkin: ['...gG...', '....G...', '.aaaaaa.', 'aaAaaAaa', 'aaAaaAaa', 'aaAaaAaa', '.aaaaaa.', '........'],
  };
  const PAL = {
    g: '#22c55e', G: '#15803d', w: '#f8fafc', W: '#cbd5e1', a: '#f97316', A: '#c2410c',
    r: '#ef4444', R: '#b91c1c', y: '#facc15', Y: '#ca8a04',
  };

  function sprite(name, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    Avatar.paint(c.getContext('2d'), ART[name], PAL, size / 8);
    return c;
  }
  const imgCache = {};
  function img(name) {
    if (!imgCache[name]) imgCache[name] = sprite(name, 32).toDataURL();
    return `<img class="spr" src="${imgCache[name]}" alt="">`;
  }

  function fmt(sec) {
    sec = Math.ceil(sec);
    if (sec >= 3600) return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
    if (sec >= 60) return `${Math.floor(sec / 60)}분 ${sec % 60 ? (sec % 60) + '초' : ''}`.trim();
    return `${sec}초`;
  }

  const expandCost = (open) => 40 + (open - START_OPEN) * 40;

  function create(api) {
    const cv = api.canvas;
    const g = cv.getContext('2d');
    const prof = api.profile();

    // ----- 저장된 농장 불러오기 -----
    let coins = api.store.get('coins', START_COINS);
    let open = Math.min(GRID * GRID, Math.max(START_OPEN, api.store.get('open', START_OPEN)));
    let earned = api.store.get('best', 0);
    const plots = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const d = api.store.get('plot' + i, null);
      const crop = d && CROPS.find((c) => c.id === d.c);
      plots.push(crop ? { crop, t: Math.min(d.t, Date.now()), w: !!d.w } : null);
    }

    let cursor = 0;
    const hero = { x: 0, y: 0, face: 1, ready: false, moving: 0 };
    let floats = [], parts = [];
    let T = 0, ox = 0, oy = 0, sprites = null, lastW = 0, lastH = 0;

    function savePlot(i) {
      const p = plots[i];
      if (p) api.store.set('plot' + i, { c: p.crop.id, t: p.t, w: p.w ? 1 : 0 });
      else api.store.del('plot' + i);
    }
    function saveCoins() { api.store.set('coins', coins); }

    const need = (p) => p.crop.time * (p.w ? WATER : 1) * 1000;
    const progress = (p) => Math.min(1, (Date.now() - p.t) / need(p));
    const remain = (p) => Math.max(0, need(p) - (Date.now() - p.t)) / 1000;

    // ----- 행동 -----
    function plotCenter(i) {
      return { x: ox + (i % GRID) * T + T / 2, y: oy + Math.floor(i / GRID) * T + T / 2 };
    }
    function addFloat(i, text, color) {
      const c = plotCenter(i);
      floats.push({ x: c.x, y: c.y, text, color, t: 0 });
    }
    function burst(i, color, n) {
      const c = plotCenter(i);
      for (let k = 0; k < n; k++) parts.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * T * 3, vy: -Math.random() * T * 3, life: 0.5 + Math.random() * 0.3, color });
    }

    function act(i) {
      cursor = i;
      if (i >= open) return askExpand();
      const p = plots[i];
      if (!p) return seedMenu(i);
      if (progress(p) >= 1) return harvest(i);
      if (!p.w) {
        // 물 주기: 남은 시간이 30% 줄어든다 (경과 시간 비율은 유지)
        const ratio = progress(p);
        p.w = true;
        p.t = Date.now() - ratio * need(p);
        savePlot(i);
        burst(i, '#38bdf8', 10);
        addFloat(i, '물 주기! 30% 빨리', '#38bdf8');
        api.vibrate(15);
        return;
      }
      api.toast(`${p.crop.name}: ${fmt(remain(p))} 남았어요`, '#a3e635');
    }

    function harvest(i) {
      const p = plots[i];
      coins += p.crop.sell;
      earned += p.crop.sell;
      plots[i] = null;
      savePlot(i);
      saveCoins();
      api.store.set('best', earned);
      const r = api.addXp(Math.ceil(p.crop.sell / 4));
      burst(i, '#facc15', 12);
      addFloat(i, `+${p.crop.sell}코인 +${r.gained}EXP`, '#facc15');
      api.vibrate(25);
      if (r.leveledUp) {
        api.toast(`🎉 레벨 업! Lv.${r.level}` + (r.unlocked.length ? ` · ${r.unlocked.join(', ')} 열림` : ''), '#facc15');
      }
    }

    function seedMenu(i) {
      const level = api.profile().level;
      const buttons = CROPS.map((c) => {
        const locked = c.lv && c.lv > level;
        return {
          label: locked ? `🔒 Lv.${c.lv} ${c.name}` : `${c.name} · ${fmt(c.time)} · 씨앗 ${c.cost} → ${c.sell}코인`,
          onClick: () => {
            if (locked) { api.toast(`Lv.${c.lv}부터 심을 수 있어요`, '#facc15'); return; }
            if (coins < c.cost) { api.toast('코인이 부족해요', '#ef4444'); return; }
            coins -= c.cost;
            plots[i] = { crop: c, t: Date.now(), w: false };
            savePlot(i);
            saveCoins();
            api.hideOverlay();
            burst(i, '#a16207', 6);
            addFloat(i, `${c.name} 심기!`, '#bbf7d0');
          },
        };
      });
      buttons.push({ label: '취소', onClick: api.hideOverlay });
      api.overlay({
        title: '씨앗 심기',
        html: `보유 코인 <b>${coins}</b><br>심은 뒤 한 번 더 탭해서 <b>물을 주면 30% 빨리</b> 자라요.`,
        buttons,
      });
    }

    function askExpand() {
      if (open >= GRID * GRID) return;
      const cost = expandCost(open);
      api.overlay({
        title: '밭 넓히기',
        html: `밭을 1칸 늘릴까요? (${open} → ${open + 1}칸)<br>비용 <b>${cost}코인</b> · 보유 <b>${coins}코인</b>`,
        buttons: [
          {
            label: `${cost}코인으로 늘리기`, primary: true, onClick: () => {
              if (coins < cost) { api.toast('코인이 부족해요', '#ef4444'); return; }
              coins -= cost;
              open++;
              saveCoins();
              api.store.set('open', open);
              api.hideOverlay();
              burst(open - 1, '#4ade80', 10);
              addFloat(open - 1, '새 밭!', '#4ade80');
            },
          },
          { label: '취소', onClick: api.hideOverlay },
        ],
      });
    }

    // ----- HUD -----
    let hudKey = '';
    function updateHud() {
      let growing = 0, ripe = 0;
      for (const p of plots) if (p) { if (progress(p) >= 1) ripe++; else growing++; }
      const key = [coins, growing, ripe, open].join();
      if (key === hudKey) return;
      hudKey = key;
      api.setHud(
        `<span class="stage">💰 ${coins}</span>` +
        `<span>🌱 자라는 중 ${growing}</span>` +
        `<span style="color:#facc15">✨ 수확 ${ripe}</span>` +
        `<span>밭 ${open}/${GRID * GRID}</span>`
      );
    }

    // ----- 그리기 -----
    function layout() {
      lastW = cv.width; lastH = cv.height;
      T = Math.floor(Math.min((cv.width * 0.9) / GRID, (cv.height * 0.66) / GRID));
      ox = Math.floor((cv.width - T * GRID) / 2);
      oy = Math.floor(Math.max(cv.height * 0.2, cv.height - T * GRID - T * 0.9));
      const sz = Math.max(8, Math.round(T * 0.62));
      sprites = {};
      for (const k in ART) sprites[k] = sprite(k, sz);
      const c = plotCenter(cursor);
      if (!hero.ready) { hero.x = c.x; hero.y = c.y; hero.ready = true; }
    }

    function roundRect(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    function draw() {
      if (cv.width !== lastW || cv.height !== lastH || !sprites) layout();
      const W = cv.width, H = cv.height, now = performance.now() / 1000;
      const u = Math.max(1, Math.round(T / 16));
      g.imageSmoothingEnabled = false;

      // 하늘과 풀밭
      const skyH = oy - T * 0.55;
      const sky = g.createLinearGradient(0, 0, 0, skyH);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#bae6fd');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, skyH);
      g.fillStyle = '#fde047';
      g.beginPath();
      g.arc(W * 0.82, skyH * 0.4, T * 0.35, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#86efac';
      g.fillRect(0, skyH, W, H - skyH);
      // 헛간
      const bx = W * 0.08, bw = T * 1.3, bh = T * 0.9, by = skyH - bh * 0.75;
      g.fillStyle = '#dc2626'; g.fillRect(bx, by, bw, bh);
      g.fillStyle = '#7f1d1d';
      g.beginPath(); g.moveTo(bx - u * 3, by); g.lineTo(bx + bw / 2, by - bh * 0.5); g.lineTo(bx + bw + u * 3, by); g.fill();
      g.fillStyle = '#fef3c7'; g.fillRect(bx + bw * 0.35, by + bh * 0.4, bw * 0.3, bh * 0.6);
      // 울타리
      g.fillStyle = '#d6a76b';
      const fy = oy - T * 0.35;
      g.fillRect(0, fy, W, u * 2);
      g.fillRect(0, fy + u * 5, W, u * 2);
      for (let x = u * 4; x < W; x += T * 0.5) g.fillRect(x, fy - u * 3, u * 3, u * 12);
      // 풀 무늬
      g.fillStyle = '#4ade80';
      for (let i = 0; i < 40; i++) {
        const gx = (i * 97) % W, gy = skyH + ((i * 53) % Math.max(1, H - skyH));
        g.fillRect(gx, gy, u * 2, u * 3);
      }

      // 밭
      for (let i = 0; i < GRID * GRID; i++) {
        const x = ox + (i % GRID) * T, y = oy + Math.floor(i / GRID) * T;
        const pad = u * 2;
        if (i >= open) {
          g.fillStyle = 'rgba(21,128,61,0.35)';
          roundRect(x + pad, y + pad, T - pad * 2, T - pad * 2, u * 3);
          g.fill();
          if (i === open) {
            g.fillStyle = '#14532d';
            g.font = `bold ${Math.round(T * 0.16)}px system-ui, sans-serif`;
            g.textAlign = 'center';
            g.fillText('🔒 늘리기', x + T / 2, y + T * 0.45);
            g.fillText(`${expandCost(open)}코인`, x + T / 2, y + T * 0.66);
          }
          continue;
        }
        const p = plots[i];
        g.fillStyle = p && p.w && progress(p) < 1 ? '#5b3a1e' : '#8b5a2b';
        roundRect(x + pad, y + pad, T - pad * 2, T - pad * 2, u * 3);
        g.fill();
        g.fillStyle = p && p.w && progress(p) < 1 ? '#4a2f18' : '#7a4b22';
        for (let k = 1; k < 4; k++) g.fillRect(x + pad * 2, y + (T * k) / 4, T - pad * 4, u);

        if (p) {
          const pr = progress(p);
          const s = sprites.sprout.width;
          const cx = x + (T - s) / 2, cy = y + (T - s) / 2 - u * 2;
          if (pr >= 1) {
            const bob = Math.sin(now * 4 + i) * u * 1.5;
            g.fillStyle = `rgba(253,224,71,${0.25 + 0.15 * Math.sin(now * 5 + i)})`;
            g.beginPath(); g.arc(x + T / 2, y + T / 2, T * 0.38, 0, Math.PI * 2); g.fill();
            g.drawImage(sprites[p.crop.art], cx, cy + bob);
          } else {
            g.drawImage(pr < 0.4 ? sprites.sprout : sprites.growing, cx, cy);
            // 진행 막대
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(x + pad * 2, y + T - pad * 2 - u * 3, T - pad * 4, u * 3);
            g.fillStyle = p.w ? '#38bdf8' : '#a3e635';
            g.fillRect(x + pad * 2, y + T - pad * 2 - u * 3, (T - pad * 4) * pr, u * 3);
            if (!p.w) {                                   // 물방울: 물 주세요
              const dx = x + T - pad * 2 - u * 5, dy = y + pad * 2 + Math.sin(now * 3 + i) * u;
              g.fillStyle = '#38bdf8';
              g.beginPath();
              g.moveTo(dx + u * 2, dy);
              g.quadraticCurveTo(dx + u * 4.5, dy + u * 4, dx + u * 2, dy + u * 5);
              g.quadraticCurveTo(dx - u * 0.5, dy + u * 4, dx + u * 2, dy);
              g.fill();
            }
          }
        }
      }

      // 선택 표시
      const cxp = ox + (cursor % GRID) * T, cyp = oy + Math.floor(cursor / GRID) * T;
      g.strokeStyle = '#facc15';
      g.lineWidth = u * 2;
      roundRect(cxp + u, cyp + u, T - u * 2, T - u * 2, u * 3);
      g.stroke();
      const sel = plots[cursor];
      if (cursor < open && sel && progress(sel) < 1) {        // 선택한 작물의 남은 시간
        g.font = `bold ${Math.round(T * 0.17)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = u * 2;
        g.strokeStyle = O;
        const label = `${sel.crop.name} ${fmt(remain(sel))}`;
        g.strokeText(label, cxp + T / 2, cyp - u * 2);
        g.fillStyle = '#fff';
        g.fillText(label, cxp + T / 2, cyp - u * 2);
      }

      // 캐릭터 (선택한 밭 오른쪽 가장자리로 걸어가서, 작물을 가리지 않게 섬)
      const hs = Math.round(T * 0.55);
      const av = Avatar.render(prof.look, hs);
      const bob = hero.moving ? Math.abs(Math.sin(now * 14)) * u * 2 : 0;
      const hx = hero.x + T * 0.5, hy = hero.y + T * 0.5;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(hx, hy, hs * 0.28, hs * 0.07, 0, 0, Math.PI * 2); g.fill();
      g.save();
      g.translate(Math.round(hx), Math.round(hy - hs - bob));
      g.scale(hero.face, 1);
      g.drawImage(av, -hs / 2, 0);
      g.restore();

      for (const q of parts) {
        g.globalAlpha = Math.max(0, q.life * 1.6);
        g.fillStyle = q.color;
        g.fillRect(Math.round(q.x), Math.round(q.y), u * 2, u * 2);
      }
      g.globalAlpha = 1;

      g.font = `bold ${Math.round(T * 0.2)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = u * 2;
      g.strokeStyle = O;
      for (const f of floats) {
        g.globalAlpha = Math.max(0, 1 - f.t);
        const fy = f.y - f.t * T * 0.6;
        g.strokeText(f.text, f.x, fy);
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, fy);
      }
      g.globalAlpha = 1;
    }

    function update(dt) {
      for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += T * 8 * dt; q.life -= dt; }
      parts = parts.filter((q) => q.life > 0);
      for (const f of floats) f.t += dt * 0.9;
      floats = floats.filter((f) => f.t < 1);
      if (T) {
        const c = plotCenter(cursor);
        const dx = c.x - hero.x, dy = c.y - hero.y;
        const d = Math.hypot(dx, dy), step = T * 5 * dt;
        if (d > 1) {
          if (Math.abs(dx) > 1) hero.face = dx > 0 ? 1 : -1;
          hero.x += d < step ? dx : (dx / d) * step;
          hero.y += d < step ? dy : (dy / d) * step;
          hero.moving = 1;
        } else hero.moving = 0;
      }
      updateHud();
    }

    // ----- 시작 -----
    let ripeNow = 0;
    for (const p of plots) if (p && progress(p) >= 1) ripeNow++;
    if (!api.store.get('intro', 0)) {
      api.store.set('intro', 1);
      api.store.set('coins', coins);
      api.overlay({
        title: '농장 키우기',
        html:
          '<div class="rules">' +
          `<div>${img('sprout')} 빈 밭을 탭해서 씨앗을 심어요</div>` +
          '<div>💧 한 번 더 탭해서 물을 주면 30% 빨리 자라요</div>' +
          `<div>${img('carrot')} 다 자라면 탭해서 수확! 코인과 경험치를 얻어요</div>` +
          '<div>🔒 코인으로 밭을 넓히고, 레벨이 오르면 새 작물이 열려요</div>' +
          '</div>' +
          '<p style="margin:6px 0 0">⏰ 실제 시간이 흐르면 자라요. 앱을 꺼 둬도 자라요!<br>💻 PC: 방향키로 고르고 스페이스/엔터</p>' +
          `<p style="margin:10px 0 0">시작 코인 <b>${START_COINS}</b>개를 드릴게요.</p>`,
        buttons: [{ label: '농사 시작!', primary: true, onClick: api.hideOverlay }],
      });
    } else if (ripeNow) {
      api.toast(`없는 동안 ${ripeNow}개가 다 자랐어요! ✨`, '#facc15');
    }

    if (window.__TEST__) window.__TEST__.farm = { plots, get coins() { return coins; }, get open() { return open; }, get cursor() { return cursor; }, layout: () => ({ T, ox, oy }), act, CROPS };

    return {
      isPlaying: () => false,     // 일시정지 없음 (실시간으로 자람)
      onDir(dx, dy) {
        const cx = Math.max(0, Math.min(GRID - 1, (cursor % GRID) + dx));
        const cy = Math.max(0, Math.min(GRID - 1, Math.floor(cursor / GRID) + dy));
        cursor = cy * GRID + cx;
      },
      onAction() { act(cursor); },
      onPointer(type, x, y) {
        if (type !== 'pointerdown' || !T) return;
        const col = Math.floor((x * cv.width - ox) / T), row = Math.floor((y * cv.height - oy) / T);
        if (col >= 0 && col < GRID && row >= 0 && row < GRID) act(row * GRID + col);
      },
      update,
      draw,
      resize() { lastW = 0; },
    };
  }

  Arcade.register({
    id: 'farm',
    title: '농장 키우기',
    desc: '씨앗을 심고 수확하는 힐링 농장',
    bestLabel: '누적 수익',
    noPause: true,
    drawIcon(ctx, size) {
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(size * 0.12, size * 0.4, size * 0.76, size * 0.5);
      ctx.fillStyle = '#7a4b22';
      ctx.fillRect(size * 0.16, size * 0.58, size * 0.68, size * 0.04);
      ctx.fillRect(size * 0.16, size * 0.74, size * 0.68, size * 0.04);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite('carrot', 32), size * 0.25, size * 0.12);
    },
    create,
  });
})();
