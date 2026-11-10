// 미니게임: 구름 점프
// 발판에 닿으면 자동으로 점프. 좌우로 움직여 더 높은 발판으로! 화면 아래로 떨어지면 끝.
// 발판: 풀밭(기본) / 구름(이동) / 낡은 나무(한 번 밟으면 부서짐) / 스프링(높이 점프). 60m부터 꿀벌 등장.
'use strict';

(() => {
  const COLS = 9;             // 화면 가로 칸 수
  const MAX_HP = 5;
  const GRAVITY = 30;         // 칸/초²
  const JUMP = 14;            // 기본 점프 속도 (약 3.3칸 높이)
  const SPRING = 22;          // 스프링 점프 속도 (약 8칸)
  const MOVE = 7.5;           // 좌우 최고 속도
  const PW = 1.7;             // 발판 너비
  const O = '#1b1626';
  const rand = (a, b) => a + Math.random() * (b - a);

  const SPR = {
    coin: [
      '..oooo..',
      '.oyyyYo.',
      'oyywyyYo',
      'oyywyyYo',
      'oyywyyYo',
      'oyyyyyYo',
      '.oYYYYo.',
      '..oooo..',
    ],
    bee: [
      '..ww.ww.',
      '..wwwww.',
      '.oyyyyyo',
      'oykyykyo',
      'opyyyypo',
      'okkkkkko',
      '.oyyyyo.',
      '..oooo..',
    ],
  };
  const PAL = { o: O, y: '#facc15', Y: '#ca8a04', w: '#e0f2fe', k: O, p: '#fda4af' };

  const EFFECT = {
    shield: '꿀벌과 부딪혀도 1회 막기',
    sword: '부딪힌 꿀벌을 베어서 퇴치 (1회, +100점)',
    lantern: '가까운 코인을 끌어당기는 자석',
    staff: '떨어질 때 마법 발판이 1회 구해줌',
  };

  function sprite(name, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    Avatar.paint(c.getContext('2d'), SPR[name], PAL, size / 8);
    return c;
  }
  const imgCache = {};
  function img(name) {
    if (!imgCache[name]) imgCache[name] = sprite(name, 32).toDataURL();
    return `<img class="spr" src="${imgCache[name]}" alt="">`;
  }

  // 높이에 따라 하늘 색 (낮 → 노을 → 밤 → 우주)
  const SKY = [
    [0, '#7dd3fc', '#e0f2fe'],
    [150, '#fb923c', '#fde68a'],
    [300, '#312e81', '#7c3aed'],
    [450, '#020617', '#1e1b4b'],
  ];
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function skyAt(h) {
    for (let i = SKY.length - 1; i >= 0; i--) {
      if (h >= SKY[i][0]) {
        const next = SKY[i + 1];
        if (!next) return [SKY[i][1], SKY[i][2]];
        const t = Math.min(1, (h - SKY[i][0]) / (next[0] - SKY[i][0]));
        return [mix(SKY[i][1], next[1], t), mix(SKY[i][2], next[2], t)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }

  function create(api) {
    const cv = api.canvas;
    const g = cv.getContext('2d');
    const prof = api.profile();
    const item = prof.look.item;

    let state = 'ready';
    let cs = 0, rows = 0, sprites = null, clouds = [], stars = [];
    let p, plats, coinsArr, bees, parts, floats, camY, topY, maxH, coins, bonus, hp, invuln, shield, sword, rescue, shake, target, down;

    function reset() {
      p = { x: (COLS - 0.6) / 2, y: 0.01, vx: 0, vy: JUMP, face: 1, squash: 0 };
      plats = [{ x: 0, y: 0, w: COLS, type: 'ground' }];
      coinsArr = [];
      bees = [];
      parts = [];
      floats = [];
      camY = -1;
      topY = 0;
      maxH = 0;
      coins = 0;
      bonus = 0;
      hp = api.startHp();
      invuln = 0;
      shield = item === 'shield' ? 1 : 0;
      sword = item === 'sword' ? 1 : 0;
      rescue = item === 'staff' ? 1 : 0;
      shake = 0;
      target = null;
      down = false;
      generate();
    }

    // 화면 위쪽까지 발판을 미리 만든다
    function generate() {
      while (topY < camY + (rows || 20) + 4) {
        const h = topY;
        topY += Math.min(2.7, rand(1.1, 1.6) + h / 300);
        const r = Math.random();
        let type = 'normal';
        if (h > 20 && r < Math.min(0.35, h / 400)) type = 'move';
        else if (h > 30 && r < Math.min(0.35, h / 400) + Math.min(0.22, h / 500)) type = 'crumble';
        const pl = { x: rand(0, COLS - PW), y: topY, w: PW, type, vx: type === 'move' ? rand(1, 2) * (Math.random() < 0.5 ? -1 : 1) : 0 };
        if (type === 'normal' && Math.random() < 0.08) pl.spring = rand(0.2, PW - 0.7);
        plats.push(pl);
        // 부서지는 발판만 이어지면 못 올라가니, 그 위에는 안전한 발판을 하나 더 둔다
        if (type === 'crumble') {
          topY += rand(0.6, 1);
          plats.push({ x: rand(0, COLS - PW), y: topY, w: PW, type: 'normal', vx: 0 });
        }
        if (Math.random() < 0.28) coinsArr.push({ x: pl.x + PW / 2 - 0.4, y: topY + rand(0.8, 1.6), ph: Math.random() * 6 });
        if (h > 60 && Math.random() < Math.min(0.12, 0.04 + h / 4000)) {
          bees.push({ x: rand(0, COLS - 1), y: topY + rand(0.8, 1.4), vx: rand(1.5, 2.5) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * 6 });
        }
      }
    }

    function layout() {
      cs = cv.width / COLS;
      rows = cv.height / cs;
      const sz = Math.max(8, Math.round(cs * 0.8));
      sprites = { coin: sprite('coin', sz), bee: sprite('bee', Math.max(8, Math.round(cs))) };
      clouds = Array.from({ length: 7 }, () => ({ x: Math.random() * COLS, y: Math.random() * 60, w: rand(1.5, 3) }));
      stars = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6 }));
    }

    // ----- 흐름 -----
    function showReady() {
      state = 'ready';
      api.overlay({
        title: '구름 점프',
        html:
          '<div class="rules">' +
          '<div>🟩 발판에 닿으면 자동으로 점프!</div>' +
          '<div>☁️ 구름 발판은 움직이고, 🟫 낡은 나무는 한 번 밟으면 부서져요</div>' +
          '<div>🔴 스프링을 밟으면 아주 높이 점프</div>' +
          `<div>${img('bee')} 꿀벌: 위에서 밟으면 퇴치, 부딪히면 HP 감소</div>` +
          `<div>${img('coin')} 코인 +50점 · 화면 아래로 떨어지면 끝</div>` +
          '</div>' +
          '<p style="margin:6px 0">📱 화면을 누른 채 좌우로 끌거나 ◀ ▶ 버튼 · 💻 ← → 키<br>화면 옆으로 나가면 반대편에서 나와요</p>' +
          `<div class="opt-desc">시작 HP ${api.startHp()} · ${Avatar.find('item', item).label}: ${EFFECT[item] || '이 게임에서는 효과 없음'}</div>` +
          `<p style="margin:10px 0 0">최고 점수 <b>${api.store.get('best', 0)}</b> · 최고 높이 <b>${api.store.get('bestHeight', 0)}m</b></p>`,
        buttons: [
          { label: '시작', primary: true, onClick: start },
          { label: '메뉴로', onClick: api.exit },
        ],
      });
    }

    function start() {
      reset();
      state = 'play';
      api.hideOverlay();
      api.toast('발판을 밟고 높이 올라가세요!', '#facc15');
    }

    function score() { return Math.floor(maxH) * 10 + coins * 50 + bonus; }

    function gameOver(reason) {
      state = 'over';
      const s = score(), h = Math.floor(maxH);
      let isBest = false;
      if (s > api.store.get('best', 0)) { api.store.set('best', s); isBest = true; }
      if (h > api.store.get('bestHeight', 0)) api.store.set('bestHeight', h);
      api.vibrate([120, 60, 200]);
      const xpHtml = api.xpReport(s);
      api.overlay({
        title: 'GAME OVER',
        html:
          `<p style="margin:0 0 10px;text-align:center">${reason}</p>` +
          '<div class="score-table">' +
          `<span>최고 높이</span><span>${h}m</span>` +
          `<span>모은 코인</span><span>${coins}개</span>` +
          `<span class="total">최종 점수</span><span class="total">${s}</span>` +
          `<span>최고 점수</span><span>${api.store.get('best', 0)}</span>` +
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 달성! ★</div>' : '') + xpHtml,
        buttons: [
          { label: '다시 하기', primary: true, onClick: start },
          { label: '메뉴로', onClick: api.exit },
        ],
      });
    }

    function burst(x, y, color, n) {
      for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-3, 3), vy: rand(1, 5), life: rand(0.3, 0.6), color });
    }
    function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

    function hurt() {
      if (invuln > 0) return;
      invuln = 1.2;
      if (shield > 0) { shield--; addFloat(p.x + 0.3, p.y + 1, '막았다!', '#94a3b8'); api.vibrate(30); return; }
      hp--;
      shake = 0.3;
      api.vibrate(90);
      p.vy = Math.min(p.vy, -4);     // 맞으면 살짝 튕겨 떨어짐
      if (hp <= 0) gameOver('꿀벌에게 너무 많이 쏘였어요!');
      else api.toast('앗 따가워! 꿀벌에 쏘였어요', '#ef4444');
    }

    // ----- HUD -----
    let hudKey = '';
    function updateHud() {
      const key = [Math.floor(maxH), hp, coins, score(), shield, sword, rescue].join();
      if (key === hudKey) return;
      hudKey = key;
      const charge = item === 'shield' ? `<span>🛡${shield}</span>` : item === 'sword' ? `<span>🗡${sword}</span>` :
        item === 'staff' ? `<span>🪄${rescue}</span>` : '';
      api.setHud(
        `<span class="stage">${Math.floor(maxH)}m</span>` +
        `<span class="hp">${'♥'.repeat(Math.max(0, hp))}<i>${'♥'.repeat(Math.max(0, MAX_HP - hp))}</i></span>` +
        `<span>${img('coin')} ${coins}</span>` + charge +
        `<span>${score()}</span>`
      );
    }

    // ----- 갱신 -----
    function update(dt) {
      for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 12 * dt; q.life -= dt; }
      parts = parts.filter((q) => q.life > 0);
      for (const f of floats) f.t += dt * 1.2;
      floats = floats.filter((f) => f.t < 1);
      if (shake > 0) shake = Math.max(0, shake - dt);
      if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 4);
      updateHud();
      if (state !== 'play') return;
      if (invuln > 0) invuln -= dt;

      // 좌우 이동 (손가락 위치 > 방향키)
      let want = 0;
      const h = api.held();
      if (h && h[0]) want = h[0];
      if (target !== null) {
        const diff = target - p.x;
        want = Math.abs(diff) < 0.05 ? 0 : Math.sign(diff) * Math.min(1, Math.abs(diff) * 3);
      }
      p.vx += (want * MOVE - p.vx) * Math.min(1, dt * 12);
      if (Math.abs(want) > 0.1) p.face = want > 0 ? 1 : -1;
      p.x += p.vx * dt;
      if (target === null) {                       // 화면 옆으로 나가면 반대편에서 등장
        if (p.x < -0.6) p.x += COLS;
        if (p.x > COLS - 0.4) p.x -= COLS;
      } else {
        p.x = Math.max(0, Math.min(COLS - 1, p.x));
      }

      // 중력과 착지
      const prevY = p.y;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.vy < 0) {
        for (const pl of plats) {
          if (pl.broken) continue;
          const left = p.x + 0.25, right = p.x + 0.75;
          if (prevY >= pl.y && p.y <= pl.y && right > pl.x && left < pl.x + pl.w) {
            p.y = pl.y;
            const onSpring = pl.spring !== undefined && right > pl.x + pl.spring && left < pl.x + pl.spring + 0.5;
            p.vy = onSpring ? SPRING : JUMP;
            p.squash = 1;
            if (onSpring) { addFloat(p.x + 0.5, p.y + 1, '슝!', '#f87171'); api.vibrate(20); }
            if (pl.type === 'crumble') { pl.broken = true; burst(pl.x + pl.w / 2, pl.y, '#a16207', 8); }
            break;
          }
        }
      }

      // 움직이는 것들
      for (const pl of plats) {
        if (pl.type === 'move') {
          pl.x += pl.vx * dt;
          if (pl.x < 0 || pl.x > COLS - pl.w) { pl.vx = -pl.vx; pl.x = Math.max(0, Math.min(COLS - pl.w, pl.x)); }
        }
        if (pl.broken) pl.fall = (pl.fall || 0) + dt * 6;
      }
      const pcx = p.x + 0.5, pcy = p.y + 0.5;
      for (const c of coinsArr) {
        if (item === 'lantern') {                  // 랜턴: 코인 자석
          const dx = pcx - (c.x + 0.4), dy = pcy - (c.y + 0.4), d = Math.hypot(dx, dy);
          if (d < 2.5 && d > 0.01) { c.x += (dx / d) * 6 * dt; c.y += (dy / d) * 6 * dt; }
        }
        if (Math.abs(c.x + 0.4 - pcx) < 0.6 && Math.abs(c.y + 0.4 - pcy) < 0.7) {
          c.dead = true;
          coins++;
          burst(c.x + 0.4, c.y + 0.4, '#facc15', 5);
          addFloat(c.x + 0.4, c.y + 0.8, '+50', '#facc15');
          api.vibrate(10);
        }
      }
      for (const b of bees) {
        b.x += b.vx * dt;
        if (b.x < 0 || b.x > COLS - 1) { b.vx = -b.vx; b.x = Math.max(0, Math.min(COLS - 1, b.x)); }
        const by = b.y + Math.sin(performance.now() / 300 + b.ph) * 0.2;
        if (Math.abs(b.x + 0.5 - pcx) < 0.65 && Math.abs(by + 0.5 - pcy) < 0.7) {
          if (p.vy < 0 && p.y > by + 0.35) {       // 위에서 밟음
            b.dead = true;
            p.vy = JUMP;
            p.squash = 1;
            bonus += 100;
            burst(b.x + 0.5, by + 0.5, '#facc15', 8);
            addFloat(b.x + 0.5, by + 1, '밟기! +100', '#facc15');
            api.vibrate(25);
          } else if (sword > 0) {
            sword--;
            b.dead = true;
            bonus += 100;
            burst(b.x + 0.5, by + 0.5, '#e5e7eb', 8);
            addFloat(b.x + 0.5, by + 1, '베기! +100', '#e5e7eb');
          } else {
            hurt();
            if (state !== 'play') return;
          }
        }
      }

      // 카메라는 위로만 따라간다
      maxH = Math.max(maxH, p.y);
      camY = Math.max(camY, p.y - rows * 0.4);
      generate();

      // 화면 아래로 떨어짐
      if (p.y < camY - 1.2) {
        if (rescue > 0) {                          // 지팡이: 마법 발판이 1회 구해줌
          rescue--;
          p.y = camY + 0.5;
          p.vy = SPRING;
          burst(p.x + 0.5, p.y, '#22d3ee', 12);
          addFloat(p.x + 0.5, p.y + 1, '마법 발판!', '#22d3ee');
          api.toast('마법 지팡이가 구해줬어요!', '#22d3ee');
        } else {
          gameOver('아래로 떨어졌어요!');
          return;
        }
      }

      // 화면 아래로 지나간 것 정리
      const cut = camY - 3;
      plats = plats.filter((pl) => pl.y > cut && !(pl.fall > 6));
      coinsArr = coinsArr.filter((c) => !c.dead && c.y > cut);
      bees = bees.filter((b) => !b.dead && b.y > cut);
    }

    // ----- 그리기 -----
    const sy = (y) => cv.height - (y - camY) * cs;   // 월드 높이 → 화면 y

    function drawPlat(pl) {
      const x = pl.x * cs, y = sy(pl.y) + (pl.fall || 0) * cs * 0.3, w = pl.w * cs, h = cs * 0.38;
      const u = Math.max(1, Math.round(cs / 10));
      if (pl.type === 'ground') {
        g.fillStyle = '#4ade80'; g.fillRect(0, y, cv.width, h);
        g.fillStyle = '#7c4a2a'; g.fillRect(0, y + h, cv.width, cs * 3);
        return;
      }
      g.globalAlpha = pl.broken ? Math.max(0, 1 - (pl.fall || 0) / 6) : 1;
      if (pl.type === 'move') {                     // 구름
        g.fillStyle = '#f8fafc';
        g.beginPath();
        g.ellipse(x + w * 0.5, y + h * 0.5, w * 0.5, h * 0.7, 0, 0, Math.PI * 2);
        g.ellipse(x + w * 0.3, y + h * 0.2, w * 0.25, h * 0.6, 0, 0, Math.PI * 2);
        g.ellipse(x + w * 0.68, y + h * 0.15, w * 0.22, h * 0.55, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#cbd5e1';
        g.fillRect(x + w * 0.15, y + h * 0.9, w * 0.7, u);
      } else if (pl.type === 'crumble') {           // 낡은 나무
        g.fillStyle = '#a16207'; g.fillRect(x, y, w, h);
        g.fillStyle = '#713f12';
        g.fillRect(x, y + h - u, w, u);
        g.fillRect(x + w * 0.3, y, u, h);
        g.fillRect(x + w * 0.62, y + h * 0.3, u, h * 0.7);
      } else {                                       // 풀밭 섬
        g.fillStyle = '#7c4a2a';
        g.beginPath();
        g.moveTo(x + w * 0.05, y + h);
        g.lineTo(x + w * 0.95, y + h);
        g.lineTo(x + w * 0.6, y + h * 2.2);
        g.lineTo(x + w * 0.4, y + h * 2.2);
        g.fill();
        g.fillStyle = '#4ade80'; g.fillRect(x, y, w, h);
        g.fillStyle = '#22c55e'; g.fillRect(x, y + h - u, w, u);
      }
      if (pl.spring !== undefined) {                 // 스프링
        const spx = x + pl.spring * cs, spw = cs * 0.5;
        g.fillStyle = '#94a3b8';
        for (let i = 0; i < 3; i++) g.fillRect(spx + spw * 0.2, y - (i + 1) * u * 2, spw * 0.6, u);
        g.fillStyle = '#ef4444'; g.fillRect(spx, y - u * 8, spw, u * 2);
      }
      g.globalAlpha = 1;
    }

    function draw() {
      if (!cs || Math.abs(cs - cv.width / COLS) > 0.5) { layout(); generate(); }
      const W = cv.width, Hpx = cv.height, now = performance.now() / 1000;
      g.imageSmoothingEnabled = false;

      const [top, bottom] = skyAt(camY);
      const sky = g.createLinearGradient(0, 0, 0, Hpx);
      sky.addColorStop(0, top);
      sky.addColorStop(1, bottom);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, Hpx);
      const starA = Math.max(0, Math.min(1, (camY - 250) / 150));   // 밤이 되면 별
      if (starA > 0) {
        g.fillStyle = '#fff';
        for (const s of stars) {
          g.globalAlpha = starA * (0.4 + 0.6 * Math.abs(Math.sin(now + s.ph)));
          g.fillRect(Math.round(s.x * W), Math.round(((s.y * Hpx + camY * cs * 0.1) % Hpx)), 2, 2);
        }
        g.globalAlpha = 1;
      }
      // 배경 구름 (천천히 움직이는 원근감)
      g.fillStyle = `rgba(255,255,255,${0.35 * (1 - starA)})`;
      for (const c of clouds) {
        const cy = Hpx - ((c.y * cs - camY * cs * 0.3) % (Hpx + cs * 3) + Hpx + cs * 3) % (Hpx + cs * 3) + cs;
        g.beginPath();
        g.ellipse(c.x * cs, cy, c.w * cs * 0.5, cs * 0.35, 0, 0, Math.PI * 2);
        g.fill();
      }

      g.save();
      const sk = shake > 0 ? cs * 0.3 * (shake / 0.3) : 0;
      g.translate((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk);

      for (const pl of plats) drawPlat(pl);
      for (const c of coinsArr) {
        const s = cs * 0.8, sx = Math.abs(Math.cos(now * 4 + c.ph));
        g.drawImage(sprites.coin, Math.round(c.x * cs + s * (1 - sx) / 2), Math.round(sy(c.y) - s), Math.max(1, Math.round(s * sx)), Math.round(s));
      }
      for (const b of bees) {
        const by = b.y + Math.sin(now * 3.3 + b.ph) * 0.2;
        g.save();
        g.translate(Math.round(b.x * cs + (b.vx < 0 ? cs : 0)), Math.round(sy(by) - cs));
        if (b.vx < 0) g.scale(-1, 1);
        g.drawImage(sprites.bee, 0, 0);
        g.restore();
      }

      // 캐릭터 (착지할 때 찌그러짐)
      if (!(invuln > 0 && Math.floor(invuln * 10) % 2 === 0)) {
        const av = Avatar.render(prof.look, Math.round(cs));
        const sq = p.squash * 0.18;
        const w = cs * (1 + sq), h = cs * (1 - sq);
        const drawAt = (x) => {
          g.save();
          g.translate(Math.round(x * cs + cs / 2), Math.round(sy(p.y)));
          g.scale(p.face < 0 ? -1 : 1, 1);
          g.drawImage(av, -w / 2, -h, w, h);
          g.restore();
        };
        drawAt(p.x);
        if (p.x < 0) drawAt(p.x + COLS);           // 화면 가장자리에서 반대편에도 보이게
        if (p.x > COLS - 1) drawAt(p.x - COLS);
      }

      for (const q of parts) {
        g.globalAlpha = Math.max(0, q.life * 2);
        g.fillStyle = q.color;
        const s = Math.ceil(cs / 10);
        g.fillRect(Math.round(q.x * cs), Math.round(sy(q.y)), s, s);
      }
      g.globalAlpha = 1;

      g.font = `bold ${Math.round(cs * 0.4)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = Math.max(2, cs * 0.07);
      g.strokeStyle = O;
      for (const f of floats) {
        g.globalAlpha = Math.max(0, 1 - f.t);
        const fx = f.x * cs, fy = sy(f.y + f.t);
        g.strokeText(f.text, fx, fy);
        g.fillStyle = f.color;
        g.fillText(f.text, fx, fy);
      }
      g.globalAlpha = 1;
      g.restore();
    }

    reset();
    showReady();

    if (window.__TEST__) window.__TEST__.jump = { get p() { return p; }, get plats() { return plats; }, get bees() { return bees; }, get camY() { return camY; }, get hp() { return hp; }, get maxH() { return maxH; }, get rescue() { return rescue; } };

    return {
      isPlaying: () => state === 'play',
      onPointer(type, x) {
        if (type === 'pointerdown') { down = true; target = x * COLS - 0.5; }
        else if (type === 'pointermove') { if (down) target = x * COLS - 0.5; }
        else { down = false; target = null; }
      },
      update,
      draw,
      resize() { cs = 0; },
    };
  }

  Arcade.register({
    id: 'jump',
    title: '구름 점프',
    desc: '발판을 밟고 하늘 높이 올라가자!',
    controls: 'lr',
    drawIcon(ctx, size) {
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
      const u = size / 16;
      ctx.fillStyle = '#4ade80'; ctx.fillRect(u * 2, u * 12, u * 6, u * 2);
      ctx.fillStyle = '#4ade80'; ctx.fillRect(u * 9, u * 6, u * 5, u * 2);
      ctx.fillStyle = '#7c4a2a'; ctx.fillRect(u * 3, u * 14, u * 4, u);
      ctx.fillStyle = '#7c4a2a'; ctx.fillRect(u * 10, u * 8, u * 3, u);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Avatar.render(Avatar.DEFAULT, Math.round(u * 6)), u * 5, u * 2);
    },
    create,
  });
})();
