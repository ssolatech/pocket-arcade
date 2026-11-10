// 미니게임: 별똥별 피하기
// 하늘에서 떨어지는 운석을 좌우로 피하며 최대한 오래 버티기. 코인은 점수, 하트는 회복, 별은 3초 무적.
// 시간이 지날수록 빨라지고, 15초마다 "운석 벽", 40초부터 대각선 운석이 나온다.
'use strict';

(() => {
  const COLS = 9;             // 화면 가로를 9칸으로 나눈다 (칸 = 캐릭터 크기)
  const MAX_HP = 5;
  const SPEED = 8;            // 캐릭터 이동 속도 (칸/초)
  const GROUND = 0.7;         // 바닥 높이 (칸)
  const O = '#1b1626';
  const rand = (a, b) => a + Math.random() * (b - a);

  const SPR = {
    meteor: [
      '..oooo..',
      '.orrRro.',
      'orRrrrRo',
      'orrrrRro',
      'oRrrrrro',
      'orrRrrRo',
      '.orrrro.',
      '..oooo..',
    ],
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
    heart: [
      '........',
      '.oo..oo.',
      'oppoopPo',
      'owpppPPo',
      'oppppPPo',
      '.oppPPo.',
      '..oPPo..',
      '...oo...',
    ],
    star: [
      '...yy...',
      '...yy...',
      'yyywyyyy',
      '.yyyyyY.',
      '..yyyY..',
      '.yyyyYY.',
      '.yY..YY.',
      'yY....YY',
    ],
  };
  const PAL = { o: O, r: '#a8a29e', R: '#78716c', y: '#facc15', Y: '#ca8a04', w: '#ffffff', p: '#f472b6', P: '#db2777' };

  // 아이템별 이 게임에서의 효과
  const EFFECT = {
    shield: '첫 번째 충돌 1회 막기',
    sword: '운석 1개를 베어서 부수기 (+100점)',
    lantern: '가까운 코인을 끌어당기는 자석',
    staff: '운석이 15% 느리게 떨어짐',
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

  function create(api) {
    const cv = api.canvas;
    const g = cv.getContext('2d');
    const prof = api.profile();
    const item = prof.look.item;

    let state = 'ready';     // ready | play | over
    let cs = 0, rows = 0, sprites = null, skyStars = [];
    let p, objs, parts, floats, t, timers, score, coins, bonus, hp, invuln, starPower, shield, sword, shake, target, down;

    function reset() {
      p = { x: (COLS - 1) / 2, face: 1, run: 0 };
      objs = [];
      parts = [];
      floats = [];
      t = 0;
      timers = { meteor: 0.8, coin: 1.5, heart: 18, star: 22, wave: 15 };
      score = 0;
      coins = 0;
      bonus = 0;
      hp = api.startHp();
      invuln = 0;
      starPower = 0;
      shield = item === 'shield' ? 1 : 0;
      sword = item === 'sword' ? 1 : 0;
      shake = 0;
      target = null;
      down = false;
    }
    reset();

    function layout() {
      cs = cv.width / COLS;
      rows = cv.height / cs;
      const sz = Math.max(8, Math.round(cs));
      sprites = { meteor: sprite('meteor', sz), coin: sprite('coin', sz), heart: sprite('heart', sz), star: sprite('star', sz) };
      skyStars = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.8, s: Math.random() < 0.2 ? 2 : 1, ph: Math.random() * 6 }));
    }

    // ----- 흐름 -----
    function showReady() {
      state = 'ready';
      const eff = EFFECT[item];
      api.overlay({
        title: '별똥별 피하기',
        html:
          '<div class="rules">' +
          `<div>${img('meteor')} 운석을 좌우로 피하세요</div>` +
          `<div>${img('coin')} 코인 +50점</div>` +
          `<div>${img('heart')} 하트로 HP 회복</div>` +
          `<div>${img('star')} 별을 먹으면 3초 무적</div>` +
          '</div>' +
          '<p style="margin:6px 0">📱 화면을 누른 채 좌우로 끌거나 ◀ ▶ 버튼 · 💻 ← → 키</p>' +
          `<div class="opt-desc">시작 HP ${api.startHp()} · ${Avatar.find('item', item).label}: ${eff || '이 게임에서는 효과 없음'}</div>` +
          `<p style="margin:10px 0 0">최고 점수 <b>${api.store.get('best', 0)}</b> · 최고 기록 <b>${api.store.get('bestTime', 0)}초</b></p>`,
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
      api.toast('운석을 피하세요!', '#facc15');
    }

    function gameOver() {
      state = 'over';
      const secs = Math.floor(t);
      let isBest = false;
      if (score > api.store.get('best', 0)) { api.store.set('best', score); isBest = true; }
      if (secs > api.store.get('bestTime', 0)) api.store.set('bestTime', secs);
      api.vibrate([120, 60, 200]);
      const xpHtml = api.xpReport(score);
      api.overlay({
        title: 'GAME OVER',
        html:
          '<div class="score-table">' +
          `<span>버틴 시간</span><span>${secs}초</span>` +
          `<span>모은 코인</span><span>${coins}개</span>` +
          `<span class="total">최종 점수</span><span class="total">${score}</span>` +
          `<span>최고 점수</span><span>${api.store.get('best', 0)}</span>` +
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 달성! ★</div>' : '') + xpHtml,
        buttons: [
          { label: '다시 하기', primary: true, onClick: start },
          { label: '메뉴로', onClick: api.exit },
        ],
      });
    }

    // ----- 생성 -----
    function addMeteor(x, size, vy, vx) {
      objs.push({ kind: 'meteor', x, y: -size - rand(0, 0.5), size, vy, vx: vx || 0 });
    }
    function spawnMeteor() {
      const size = Math.random() < 0.22 ? 1.6 : 1;
      const vy = Math.min(12, rand(2.8, 4) + t * 0.05);
      const vx = t > 40 && Math.random() < 0.3 ? rand(-1.5, 1.5) : 0;
      addMeteor(rand(0, COLS - size), size, vy, vx);
    }
    function spawnWave() {        // 한 칸 틈만 남긴 운석 벽
      const gap = Math.floor(rand(0, COLS - 1));
      const vy = Math.min(7, 3.5 + t * 0.02);
      for (let i = 0; i < COLS; i++) if (i !== gap && i !== gap + 1) objs.push({ kind: 'meteor', x: i, y: -1.2, size: 1, vy, vx: 0 });
      api.toast('운석 벽이 몰려와요! 틈을 찾으세요', '#fb923c');
    }
    function spawnItem(kind) {
      objs.push({ kind, x: rand(0, COLS - 1), y: -1, size: 1, vy: kind === 'coin' ? 3 : 2.5, vx: 0, ph: Math.random() * 6 });
    }

    function burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        parts.push({ x, y, vx: rand(-3, 3), vy: rand(-5, -1), life: rand(0.3, 0.6), color });
      }
    }
    function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

    // ----- 충돌 -----
    function hit(o) {
      o.dead = true;
      const cx = o.x + o.size / 2, cy = o.y + o.size / 2;
      if (starPower > 0) { bonus += 30; burst(cx, cy, '#fde047', 8); addFloat(cx, cy, '쾅! +30', '#fde047'); return; }
      if (invuln > 0) { o.dead = false; return; }
      if (sword > 0) {
        sword--;
        bonus += 100;
        burst(cx, cy, '#e5e7eb', 10);
        addFloat(cx, cy, '베기! +100', '#e5e7eb');
        api.vibrate(30);
        return;
      }
      burst(cx, cy, '#a8a29e', 8);
      invuln = 1.2;
      if (shield > 0) {
        shield--;
        addFloat(p.x + 0.5, rows - GROUND - 1, '막았다!', '#94a3b8');
        api.vibrate(30);
        return;
      }
      hp--;
      shake = 0.3;
      api.vibrate(90);
      if (hp <= 0) gameOver();
      else api.toast('아야! 운석에 맞았어요', '#ef4444');
    }

    function collect(o) {
      o.dead = true;
      const cx = o.x + 0.5, cy = o.y + 0.5;
      if (o.kind === 'coin') {
        coins++;
        burst(cx, cy, '#facc15', 5);
        addFloat(cx, cy, '+50', '#facc15');
        api.vibrate(10);
      } else if (o.kind === 'heart') {
        if (hp < MAX_HP) { hp++; addFloat(cx, cy, '+HP', '#f472b6'); } else { bonus += 50; addFloat(cx, cy, '+50', '#f472b6'); }
      } else if (o.kind === 'star') {
        starPower = 3;
        addFloat(cx, cy, '무적!', '#fde047');
        api.toast('3초 동안 무적! 운석을 부숴요', '#fde047');
      }
    }

    // ----- HUD -----
    let hudKey = '';
    function updateHud() {
      const secs = Math.floor(t);
      const key = [secs, hp, coins, score, shield, sword].join();
      if (key === hudKey) return;
      hudKey = key;
      const charge = item === 'shield' ? `<span>🛡${shield}</span>` : item === 'sword' ? `<span>🗡${sword}</span>` : '';
      api.setHud(
        `<span class="stage">${secs}초</span>` +
        `<span class="hp">${'♥'.repeat(Math.max(0, hp))}<i>${'♥'.repeat(Math.max(0, MAX_HP - hp))}</i></span>` +
        `<span>${img('coin')} ${coins}</span>` + charge +
        `<span>${score}</span>`
      );
    }

    // ----- 그리기 -----
    function draw() {
      if (!cs || Math.abs(cs - cv.width / COLS) > 0.5) layout();
      const W = cv.width, Hpx = cv.height, now = performance.now() / 1000;
      g.imageSmoothingEnabled = false;

      // 밤하늘
      const sky = g.createLinearGradient(0, 0, 0, Hpx);
      sky.addColorStop(0, '#0b0a1f');
      sky.addColorStop(1, '#2a1f4a');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, Hpx);
      for (const s of skyStars) {
        g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 1.5 + s.ph));
        g.fillStyle = '#fff';
        const sz = Math.max(1, Math.round(cs / 16)) * s.s;
        g.fillRect(Math.round(s.x * W), Math.round(s.y * Hpx), sz, sz);
      }
      g.globalAlpha = 1;
      // 달
      g.fillStyle = '#fef9c3';
      g.beginPath();
      g.arc(W - cs * 1.3, cs * 1.3, cs * 0.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0f0d24';
      g.beginPath();
      g.arc(W - cs * 1.05, cs * 1.15, cs * 0.5, 0, Math.PI * 2);
      g.fill();

      g.save();
      const sk = shake > 0 ? cs * 0.3 * (shake / 0.3) : 0;
      g.translate((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk);

      // 바닥 (풀밭)
      const gy = (rows - GROUND) * cs;
      g.fillStyle = '#3f2a1e';
      g.fillRect(0, gy, W, Hpx - gy);
      g.fillStyle = '#4ade80';
      g.fillRect(0, gy, W, Math.ceil(cs * 0.18));
      g.fillStyle = '#22c55e';
      for (let i = 0; i < COLS * 4; i++) g.fillRect(Math.round(i * cs / 4), gy + Math.ceil(cs * 0.18), Math.ceil(cs / 8), Math.ceil(cs / 8));

      // 떨어지는 것들
      for (const o of objs) {
        const x = o.x * cs, y = o.y * cs, s = o.size * cs;
        if (o.kind === 'meteor') {
          const tail = g.createLinearGradient(0, y - s * 1.6, 0, y + s * 0.5);
          tail.addColorStop(0, 'rgba(251,146,60,0)');
          tail.addColorStop(1, 'rgba(251,146,60,0.75)');
          g.fillStyle = tail;
          g.beginPath();
          g.moveTo(x + s * 0.2 - o.vx * cs * 0.3, y - s * 1.6);
          g.lineTo(x + s * 0.8 - o.vx * cs * 0.3, y - s * 1.6);
          g.lineTo(x + s * 0.95, y + s * 0.5);
          g.lineTo(x + s * 0.05, y + s * 0.5);
          g.closePath();
          g.fill();
          g.drawImage(sprites.meteor, Math.round(x), Math.round(y), Math.round(s), Math.round(s));
        } else if (o.kind === 'coin') {
          const sx = Math.abs(Math.cos(now * 4 + o.ph));
          g.drawImage(sprites.coin, Math.round(x + s * (1 - sx) / 2), Math.round(y), Math.max(1, Math.round(s * sx)), Math.round(s));
        } else {
          if (o.kind === 'star') {
            g.fillStyle = `rgba(253,224,71,${0.25 + 0.15 * Math.sin(now * 8)})`;
            g.beginPath();
            g.arc(x + s / 2, y + s / 2, s * 0.7, 0, Math.PI * 2);
            g.fill();
          }
          g.drawImage(sprites[o.kind], Math.round(x), Math.round(y + Math.sin(now * 5 + o.ph) * cs * 0.06), Math.round(s), Math.round(s));
        }
      }

      // 캐릭터
      const px = p.x * cs, py = gy - cs;
      const bob = p.run ? Math.abs(Math.sin(p.run)) * cs * 0.12 : 0;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(px + cs / 2, gy, cs * 0.3, cs * 0.07, 0, 0, Math.PI * 2);
      g.fill();
      if (starPower > 0) {
        g.fillStyle = `hsla(${(now * 360) % 360},90%,60%,0.45)`;
        g.beginPath();
        g.arc(px + cs / 2, py + cs / 2 - bob, cs * 0.7, 0, Math.PI * 2);
        g.fill();
      }
      if (!(invuln > 0 && Math.floor(invuln * 10) % 2 === 0)) {
        const av = Avatar.render(prof.look, Math.round(cs));
        g.save();
        g.translate(Math.round(px + (p.face < 0 ? cs : 0)), Math.round(py - bob));
        if (p.face < 0) g.scale(-1, 1);
        g.drawImage(av, 0, 0);
        g.restore();
      }

      // 파편
      for (const q of parts) {
        g.globalAlpha = Math.max(0, q.life * 2);
        g.fillStyle = q.color;
        const sz = Math.ceil(cs / 10);
        g.fillRect(Math.round(q.x * cs), Math.round(q.y * cs), sz, sz);
      }
      g.globalAlpha = 1;

      // 떠오르는 글자
      g.font = `bold ${Math.round(cs * 0.4)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = Math.max(2, cs * 0.07);
      g.strokeStyle = O;
      for (const f of floats) {
        g.globalAlpha = Math.max(0, 1 - f.t);
        const fx = f.x * cs, fy = (f.y - f.t) * cs;
        g.strokeText(f.text, fx, fy);
        g.fillStyle = f.color;
        g.fillText(f.text, fx, fy);
      }
      g.globalAlpha = 1;
      g.restore();
    }

    // ----- 갱신 -----
    function update(dt) {
      for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 12 * dt; q.life -= dt; }
      parts = parts.filter((q) => q.life > 0);
      for (const f of floats) f.t += dt * 1.2;
      floats = floats.filter((f) => f.t < 1);
      if (shake > 0) shake = Math.max(0, shake - dt);
      updateHud();
      if (state !== 'play') { p.run = 0; return; }

      t += dt;
      if (invuln > 0) invuln -= dt;
      if (starPower > 0) starPower -= dt;

      // 이동: 손가락 위치 > 조이스틱(민 세기만큼) > 방향키
      let want = 0;
      const h = api.held(), st = api.stick();
      if (Math.abs(st.x) > 0.12) want = Math.max(-1, Math.min(1, st.x * 1.2));
      else if (h && h[0]) want = h[0];
      if (target !== null) {
        const diff = target - p.x;
        want = Math.abs(diff) < 0.05 ? 0 : Math.sign(diff) * Math.min(1, Math.abs(diff) * 3);
      }
      p.x = Math.max(0, Math.min(COLS - 1, p.x + want * SPEED * dt));
      if (Math.abs(want) > 0.1) { p.face = want > 0 ? 1 : -1; p.run += dt * 14; } else p.run = 0;

      // 생성
      timers.meteor -= dt;
      if (timers.meteor <= 0) { spawnMeteor(); timers.meteor = Math.max(0.16, 0.9 - t * 0.008) * rand(0.6, 1.4); }
      timers.coin -= dt;
      if (timers.coin <= 0) { spawnItem('coin'); timers.coin = rand(1.8, 3); }
      timers.heart -= dt;
      if (timers.heart <= 0) { if (hp < MAX_HP) spawnItem('heart'); timers.heart = rand(18, 26); }
      timers.star -= dt;
      if (timers.star <= 0) { spawnItem('star'); timers.star = rand(22, 32); }
      timers.wave -= dt;
      if (timers.wave <= 0) { spawnWave(); timers.wave = 15; }

      // 움직임과 충돌
      const slow = item === 'staff' ? 0.85 : 1;
      const pcx = p.x + 0.5, pcy = rows - GROUND - 0.45;
      for (const o of objs) {
        if (o.kind === 'meteor') {
          o.y += o.vy * slow * dt;
          o.x += o.vx * dt;
          if (o.x < 0 || o.x > COLS - o.size) { o.vx = -o.vx; o.x = Math.max(0, Math.min(COLS - o.size, o.x)); }
        } else {
          o.y += o.vy * dt;
          if (item === 'lantern' && o.kind === 'coin') {      // 랜턴: 코인 자석
            const dx = pcx - (o.x + 0.5), dy = pcy - (o.y + 0.5);
            const d = Math.hypot(dx, dy);
            if (d < 2.5) { o.x += (dx / d) * 6 * dt; o.y += (dy / d) * 6 * dt; }
          }
        }
        const r = o.kind === 'meteor' ? o.size * 0.36 : 0.45;
        const ocx = o.x + o.size / 2, ocy = o.y + o.size / 2;
        // 캐릭터 판정은 실제 그림보다 작게 (억울하지 않게)
        const nx = Math.max(pcx - 0.26, Math.min(ocx, pcx + 0.26));
        const ny = Math.max(pcy - 0.36, Math.min(ocy, pcy + 0.36));
        if ((ocx - nx) ** 2 + (ocy - ny) ** 2 < r * r) {
          if (o.kind === 'meteor') hit(o); else collect(o);
          if (state !== 'play') break;
        }
        if (o.kind === 'meteor' && !o.dead && o.y + o.size > rows - GROUND) {   // 땅에 떨어짐
          o.dead = true;
          burst(o.x + o.size / 2, rows - GROUND, '#fb923c', 4);
        }
        if (o.y > rows + 1) o.dead = true;
      }
      objs = objs.filter((o) => !o.dead);
      score = Math.floor(t * 10) + coins * 50 + bonus;
    }

    showReady();

    if (window.__TEST__) window.__TEST__.meteor = { get objs() { return objs; }, get p() { return p; }, get hp() { return hp; }, get t() { return t; }, get score() { return score; } };

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
    id: 'meteor',
    title: '별똥별 피하기',
    desc: '쏟아지는 운석을 피하고 코인을 모으자!',
    controls: 'lr',
    drawIcon(ctx, size) {
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, '#0b0a1f');
      sky.addColorStop(1, '#2a1f4a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(251,146,60,0.6)';
      ctx.beginPath();
      ctx.moveTo(size * 0.2, 0);
      ctx.lineTo(size * 0.45, 0);
      ctx.lineTo(size * 0.75, size * 0.6);
      ctx.lineTo(size * 0.35, size * 0.6);
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite('meteor', 32), size * 0.3, size * 0.3);
    },
    create,
  });
})();
