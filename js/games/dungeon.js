// 미니게임: 던전 탈출
// 열쇠를 모두 모아 출구로! 몬스터에 닿으면 HP 감소. 스테이지가 오를수록 몬스터가 늘고 빨라지며, 3스테이지부터는 어두워진다.
'use strict';

(() => {
  const W = 15, H = 21;          // 맵 크기 (세로 화면에 맞춤, 홀수)
  const TICK = 0.1;              // 게임 로직 간격(초)
  const MAX_HP = 5;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const rnd = (n) => Math.floor(Math.random() * n);
  const K = (x, y) => x + ',' + y;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- 맵 ----------
  // 미로를 판 뒤 벽을 일부 허물어 순환 경로를 만든다 (모든 칸 연결 보장)
  function makeMaze() {
    const map = Array.from({ length: H }, () => Array(W).fill('#'));
    const stack = [[1, 1]];
    map[1][1] = '.';
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const opts = shuffle(DIRS.slice()).filter(([dx, dy]) => {
        const nx = x + dx * 2, ny = y + dy * 2;
        return nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && map[ny][nx] === '#';
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[0];
      map[y + dy][x + dx] = '.';
      map[y + dy * 2][x + dx * 2] = '.';
      stack.push([x + dx * 2, y + dy * 2]);
    }
    for (let i = 0; i < W * H * 0.12; i++) {
      const x = 1 + rnd(W - 2), y = 1 + rnd(H - 2);
      if (map[y][x] !== '#') continue;
      const horiz = map[y][x - 1] === '.' && map[y][x + 1] === '.';
      const vert = map[y - 1][x] === '.' && map[y + 1][x] === '.';
      if (horiz || vert) map[y][x] = '.';
    }
    return map;
  }

  function bfs(map, sx, sy) {
    const d = Array.from({ length: H }, () => Array(W).fill(-1));
    const q = [[sx, sy]];
    d[sy][sx] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (map[ny][nx] !== '#' && d[ny][nx] < 0) {
          d[ny][nx] = d[y][x] + 1;
          q.push([nx, ny]);
        }
      }
    }
    return d;
  }

  function buildStage(stage) {
    const map = makeMaze();
    const d = bfs(map, 1, 1);
    const cells = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (d[y][x] > 0) cells.push({ x, y, d: d[y][x] });
    cells.sort((a, b) => b.d - a.d);

    const exit = { x: cells[0].x, y: cells[0].y };   // 가장 먼 곳이 출구
    const items = new Map();
    const pool = shuffle(cells.slice(1).filter((c) => c.d >= 6));
    const keysTotal = Math.min(2 + stage, 6);
    let pi = 0;
    for (let i = 0; i < keysTotal; i++) {
      const c = pool[pi++];
      items.set(K(c.x, c.y), 'key');
    }
    if (stage >= 2 && Math.random() < 0.7 && pool[pi]) {
      const c = pool[pi++];
      items.set(K(c.x, c.y), 'heart');
    }

    const monsters = shuffle(cells.filter((c) => c.d >= 10))
      .slice(0, Math.min(1 + stage, 7))
      .map((c) => ({ x: c.x, y: c.y, rx: c.x, ry: c.y }));

    return {
      map, exit, items, monsters, keysTotal,
      keysGot: 0,
      player: { x: 1, y: 1, rx: 1, ry: 1 },
      moveEvery: Math.max(2, 6 - Math.floor(stage / 2)), // 몬스터 이동 주기(틱)
      chase: Math.min(0.85, 0.35 + stage * 0.08),        // 추격 확률
      sight: 6 + stage,                                  // 추격 시작 거리
      dark: stage >= 3 ? Math.max(3.2, 7 - (stage - 3) * 0.6) : 0, // 시야 반경(칸)
      tick: 0,
      invuln: 0,
      startTime: Date.now(),
    };
  }

  // ---------- 도트 그림 (8x8) ----------
  const PAL = {
    h: '#8b5a2b', s: '#f2c79b', d: '#1b1b2a', b: '#3b82f6', B: '#1d4ed8',
    r: '#ef4444', R: '#b91c1c', w: '#ffffff', y: '#facc15', Y: '#ca8a04', p: '#ec4899',
  };
  const SPR = {
    player: [
      '..hhhh..',
      '.hhhhhh.',
      '.hsdsds.',
      '..ssss..',
      '.bbbbbb.',
      's.bBBb.s',
      '..bbbb..',
      '..d..d..',
    ],
    monster: [
      '..rrrr..',
      '.rrrrrr.',
      'rwwrrwwr',
      'rwdrrwdr',
      'rrrrrrrr',
      'rRrrrrRr',
      'rrrrrrrr',
      'r.rr.rr.',
    ],
    key: [
      '........',
      '.yyy....',
      'y...y...',
      'y...yyyy',
      'y...y.yY',
      '.yyy..Y.',
      '........',
      '........',
    ],
    heart: [
      '........',
      '.pp..pp.',
      'pppppppp',
      'pppppppp',
      '.pppppp.',
      '..pppp..',
      '...pp...',
      '........',
    ],
    door: [
      '..gggg..',
      '.gnnnng.',
      'gnnnnnng',
      'gnnnnnng',
      'gnnnnkng',
      'gnnnnnng',
      'gnnnnnng',
      'gggggggg',
    ],
  };
  const DOOR_LOCKED = { g: '#6b7280', n: '#1f2937', k: '#9ca3af' };
  const DOOR_OPEN = { g: '#22c55e', n: '#064e3b', k: '#facc15' };

  function makeSprite(rows, size, pal) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const p = size / 8;
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      x.fillStyle = pal[ch];
      x.fillRect(Math.floor(i * p), Math.floor(j * p), Math.ceil(p), Math.ceil(p));
    }));
    return c;
  }

  function makeSprites(size) {
    return {
      player: makeSprite(SPR.player, size, PAL),
      monster: makeSprite(SPR.monster, size, PAL),
      key: makeSprite(SPR.key, size, PAL),
      heart: makeSprite(SPR.heart, size, PAL),
      door: makeSprite(SPR.door, size, DOOR_LOCKED),
      doorOpen: makeSprite(SPR.door, size, DOOR_OPEN),
    };
  }

  // 오버레이/HUD 안에 넣을 작은 그림
  let imgCache = null;
  function img(name) {
    if (!imgCache) {
      const s = makeSprites(32);
      imgCache = {};
      for (const k in s) imgCache[k] = s[k].toDataURL();
    }
    return `<img class="spr" src="${imgCache[name]}" alt="">`;
  }

  // ---------- 게임 ----------
  function create(api) {
    const cv = api.canvas;
    const g2 = cv.getContext('2d');

    let state = 'ready';        // ready | play | clear | over
    let run = null;             // { stage, hp, score }
    let s = buildStage(1);      // 시작 화면 뒤에 보일 미리보기 맵
    let acc = 0, shake = 0, lastMove = 0, hudKey = '';
    let floats = [];
    let cs = 0, sprites = null, bg = null;

    // ----- 흐름 -----
    function showReady() {
      state = 'ready';
      const cont = api.store.get('continue', null);
      const buttons = [];
      if (cont) buttons.push({ label: `이어하기 (STAGE ${cont.stage})`, primary: true, onClick: () => startRun(cont) });
      buttons.push({ label: '새로 시작', primary: !cont, onClick: () => startRun({ stage: 1, hp: 3, score: 0 }) });
      buttons.push({ label: '메뉴로', onClick: api.exit });
      api.overlay({
        title: '던전 탈출',
        html:
          '<div class="rules">' +
          `<div>${img('player')} 당신이에요. 던전을 탈출하세요!</div>` +
          `<div>${img('key')} 열쇠를 모두 모으면</div>` +
          `<div>${img('doorOpen')} 출구가 열려요</div>` +
          `<div>${img('monster')} 몬스터에 닿으면 HP 감소</div>` +
          `<div>${img('heart')} 하트로 HP 회복</div>` +
          '</div>' +
          `최고 점수 <b>${api.store.get('best', 0)}</b> · 최고 스테이지 <b>${api.store.get('bestStage', 0)}</b>`,
        buttons,
      });
    }

    function startRun(r) {
      run = { stage: r.stage, hp: r.hp, score: r.score };
      s = buildStage(run.stage);
      bg = null;
      acc = 0;
      floats = [];
      hudKey = '';
      state = 'play';
      api.hideOverlay();
      api.toast(run.stage === 1 ? '열쇠를 모아 출구로!' :
        s.dark ? `STAGE ${run.stage} · 주변이 어두워졌어요` : `STAGE ${run.stage} · 몬스터가 늘었어요`, '#facc15');
    }

    function saveBest() {
      let isBest = false;
      if (run.score > api.store.get('best', 0)) { api.store.set('best', run.score); isBest = true; }
      if (run.stage > api.store.get('bestStage', 0)) api.store.set('bestStage', run.stage);
      return isBest;
    }

    function stageClear() {
      state = 'clear';
      const secs = Math.round((Date.now() - s.startTime) / 1000);
      const timeBonus = Math.max(0, 300 - secs * 5);
      const hpBonus = run.hp * 50;
      run.score += 500 + timeBonus + hpBonus;
      const isBest = saveBest();
      const next = { stage: run.stage + 1, hp: run.hp, score: run.score };
      api.store.set('continue', next);   // 여기서 앱을 꺼도 다음 스테이지부터 이어하기
      api.vibrate(40);
      api.overlay({
        title: `STAGE ${run.stage} 클리어!`,
        html:
          '<div class="score-table">' +
          `<span>클리어 시간</span><span>${secs}초</span>` +
          '<span>스테이지 보너스</span><span>+500</span>' +
          `<span>시간 보너스</span><span>+${timeBonus}</span>` +
          `<span>HP 보너스</span><span>+${hpBonus}</span>` +
          `<span class="total">현재 점수</span><span class="total">${run.score}</span>` +
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 갱신 ★</div>' : ''),
        buttons: [
          { label: '다음 스테이지', primary: true, onClick: () => startRun(next) },
          { label: '저장하고 메뉴로', onClick: api.exit },
        ],
      });
    }

    function gameOver() {
      state = 'over';
      api.store.del('continue');
      const isBest = saveBest();
      api.vibrate([120, 60, 200]);
      api.overlay({
        title: 'GAME OVER',
        html:
          '<div class="score-table">' +
          `<span>도달 스테이지</span><span>${run.stage}</span>` +
          `<span class="total">최종 점수</span><span class="total">${run.score}</span>` +
          `<span>최고 점수</span><span>${api.store.get('best', 0)}</span>` +
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 달성! ★</div>' : ''),
        buttons: [
          { label: '다시 하기', primary: true, onClick: () => startRun({ stage: 1, hp: 3, score: 0 }) },
          { label: '메뉴로', onClick: api.exit },
        ],
      });
    }

    // ----- 로직 -----
    function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

    function movePlayer(dx, dy) {
      const p = s.player;
      const nx = p.x + dx, ny = p.y + dy;
      if (s.map[ny][nx] === '#') return;
      p.x = nx;
      p.y = ny;

      const pos = K(nx, ny);
      const item = s.items.get(pos);
      if (item === 'key') {
        s.items.delete(pos);
        s.keysGot++;
        run.score += 100;
        addFloat(nx, ny, '+100', '#facc15');
        api.vibrate(15);
        if (s.keysGot === s.keysTotal) api.toast('출구가 열렸어요! 초록 문으로 가세요', '#22c55e');
      } else if (item === 'heart') {
        if (run.hp < MAX_HP) {
          s.items.delete(pos);
          run.hp++;
          addFloat(nx, ny, '+HP', '#ec4899');
        } else {
          api.toast('HP가 이미 가득해요');
        }
      }

      if (nx === s.exit.x && ny === s.exit.y) {
        if (s.keysGot === s.keysTotal) { stageClear(); return; }
        api.toast(`열쇠가 ${s.keysTotal - s.keysGot}개 더 필요해요`, '#facc15');
      }
      checkHit();
    }

    function moveMonsters() {
      const d = bfs(s.map, s.player.x, s.player.y);
      const occupied = new Set(s.monsters.map((m) => K(m.x, m.y)));
      for (const m of s.monsters) {
        const opts = DIRS
          .map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))
          .filter((p) => s.map[p.y][p.x] !== '#' && !occupied.has(K(p.x, p.y)));
        if (!opts.length) continue;
        let next = null;
        if (d[m.y][m.x] <= s.sight && Math.random() < s.chase) {
          opts.sort((a, b) => d[a.y][a.x] - d[b.y][b.x]);
          if (d[opts[0].y][opts[0].x] < d[m.y][m.x]) next = opts[0];
        } else {
          next = opts[rnd(opts.length)];
        }
        if (!next) continue;
        occupied.delete(K(m.x, m.y));
        m.x = next.x;
        m.y = next.y;
        occupied.add(K(m.x, m.y));
      }
    }

    function checkHit() {
      if (state !== 'play' || s.invuln > 0) return;
      if (s.monsters.some((m) => m.x === s.player.x && m.y === s.player.y)) {
        run.hp--;
        s.invuln = 15;       // 1.5초 무적
        shake = 0.3;
        api.vibrate(90);
        if (run.hp <= 0) gameOver();
        else api.toast('아야! 몬스터에게 맞았어요', '#ef4444');
      }
    }

    function updateHud() {
      if (!run) return;
      const key = [run.stage, run.hp, s.keysGot, s.keysTotal, run.score].join();
      if (key === hudKey) return;
      hudKey = key;
      api.setHud(
        `<span class="stage">STAGE ${run.stage}</span>` +
        `<span class="hp">${'♥'.repeat(run.hp)}<i>${'♥'.repeat(Math.max(0, MAX_HP - run.hp))}</i></span>` +
        `<span>${img('key')} ${s.keysGot}/${s.keysTotal}</span>` +
        `<span>${run.score}</span>`
      );
    }

    function tween(e, dt) {
      const f = Math.min(1, dt * 20);
      e.rx += (e.x - e.rx) * f;
      e.ry += (e.y - e.ry) * f;
    }

    // ----- 그리기 -----
    function buildBg() {
      const c = document.createElement('canvas');
      c.width = W * cs;
      c.height = H * cs;
      const x = c.getContext('2d');
      const p = cs / 8;
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const px = tx * cs, py = ty * cs;
          if (s.map[ty][tx] === '#') {
            x.fillStyle = '#4a4266';
            x.fillRect(px, py, cs, cs);
            x.fillStyle = '#3a3352';                // 벽돌 줄눈
            x.fillRect(px, py + Math.floor(4 * p), cs, Math.ceil(p * 0.6));
            x.fillRect(px + Math.floor((ty % 2 ? 2 : 6) * p), py, Math.ceil(p * 0.6), Math.floor(4 * p));
            x.fillRect(px + Math.floor((ty % 2 ? 6 : 2) * p), py + Math.floor(4 * p), Math.ceil(p * 0.6), Math.ceil(4 * p));
            x.fillStyle = '#5d5480';                // 윗면 하이라이트
            x.fillRect(px, py, cs, Math.ceil(p));
            if (ty + 1 < H && s.map[ty + 1][tx] !== '#') {
              x.fillStyle = '#2a2440';              // 아래쪽 그림자면 (입체감)
              x.fillRect(px, py + cs - Math.ceil(2 * p), cs, Math.ceil(2 * p));
            }
          } else {
            x.fillStyle = (tx + ty) % 2 ? '#17141f' : '#1a1724';
            x.fillRect(px, py, cs, cs);
            if ((tx * 7 + ty * 13) % 11 === 0) {   // 바닥 얼룩
              x.fillStyle = '#221e30';
              x.fillRect(px + Math.floor(2 * p), py + Math.floor(5 * p), Math.ceil(p), Math.ceil(p));
            }
          }
        }
      }
      return c;
    }

    function draw() {
      const ncs = Math.max(4, Math.floor(Math.min(cv.width / W, cv.height / H)));
      if (ncs !== cs) { cs = ncs; sprites = makeSprites(cs); bg = null; }
      if (!bg) bg = buildBg();

      const ox = Math.floor((cv.width - cs * W) / 2);
      const oy = Math.floor((cv.height - cs * H) / 2);
      const t = performance.now() / 1000;

      g2.fillStyle = '#0d0b14';
      g2.fillRect(0, 0, cv.width, cv.height);
      g2.save();
      const sk = shake > 0 ? cs * 0.35 * (shake / 0.3) : 0;
      g2.translate(ox + (Math.random() - 0.5) * sk, oy + (Math.random() - 0.5) * sk);
      g2.imageSmoothingEnabled = false;
      g2.drawImage(bg, 0, 0);

      // 출구
      const open = s.keysGot === s.keysTotal;
      if (open) {
        g2.fillStyle = `rgba(34,197,94,${0.25 + 0.2 * Math.sin(t * 5)})`;
        g2.fillRect(s.exit.x * cs - cs * 0.15, s.exit.y * cs - cs * 0.15, cs * 1.3, cs * 1.3);
      }
      g2.drawImage(open ? sprites.doorOpen : sprites.door, s.exit.x * cs, s.exit.y * cs);

      // 아이템
      for (const [pos, type] of s.items) {
        const [x, y] = pos.split(',').map(Number);
        g2.drawImage(sprites[type], x * cs, Math.round(y * cs + Math.sin(t * 4 + x + y) * cs * 0.07));
      }

      // 몬스터
      for (const m of s.monsters) {
        g2.drawImage(sprites.monster, Math.round(m.rx * cs), Math.round(m.ry * cs + Math.sin(t * 6 + m.x) * cs * 0.04));
      }

      // 플레이어 (피격 무적 중에는 깜빡임)
      const p = s.player;
      if (!(s.invuln > 0 && Math.floor(s.invuln / 2) % 2 === 0)) {
        g2.drawImage(sprites.player, Math.round(p.rx * cs), Math.round(p.ry * cs));
      }

      // 어둠 (3스테이지부터)
      if (s.dark && state !== 'ready') {
        const cx = (p.rx + 0.5) * cs, cy = (p.ry + 0.5) * cs, r = s.dark * cs;
        const grad = g2.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
        grad.addColorStop(0, 'rgba(5,4,10,0)');
        grad.addColorStop(1, 'rgba(5,4,10,0.93)');
        g2.fillStyle = grad;
        g2.fillRect(0, 0, W * cs, H * cs);
        if (open) {   // 열린 출구는 어둠 속에서도 살짝 보인다
          g2.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
          g2.drawImage(sprites.doorOpen, s.exit.x * cs, s.exit.y * cs);
          g2.globalAlpha = 1;
        }
      }

      // 떠오르는 점수 글자
      g2.font = `bold ${Math.round(cs * 0.55)}px system-ui, sans-serif`;
      g2.textAlign = 'center';
      for (const f of floats) {
        g2.globalAlpha = Math.max(0, 1 - f.t);
        g2.fillStyle = f.color;
        g2.fillText(f.text, (f.x + 0.5) * cs, (f.y - f.t * 0.8) * cs);
      }
      g2.globalAlpha = 1;
      g2.restore();
    }

    showReady();

    return {
      isPlaying: () => state === 'play',
      onDir(dx, dy) {
        if (state !== 'play') return;
        const now = performance.now();
        if (now - lastMove < 70) return;
        lastMove = now;
        movePlayer(dx, dy);
      },
      update(dt) {
        tween(s.player, dt);
        for (const m of s.monsters) tween(m, dt);
        for (const f of floats) f.t += dt * 1.2;
        floats = floats.filter((f) => f.t < 1);
        if (shake > 0) shake = Math.max(0, shake - dt);
        updateHud();
        if (state !== 'play') return;
        acc += dt;
        while (acc >= TICK && state === 'play') {
          acc -= TICK;
          s.tick++;
          if (s.invuln > 0) s.invuln--;
          if (s.tick % s.moveEvery === 0) moveMonsters();
          checkHit();
        }
        updateHud();
      },
      draw,
      resize() { cs = 0; },
    };
  }

  Arcade.register({
    id: 'dungeon',
    title: '던전 탈출',
    desc: '열쇠를 모아 몬스터를 피해 탈출!',
    drawIcon(ctx, size) {
      ctx.fillStyle = '#1a1724';
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(makeSprite(SPR.player, 48, PAL), (size - 48) / 2, (size - 48) / 2);
    },
    create,
  });
})();
