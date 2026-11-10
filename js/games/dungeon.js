// 미니게임: 던전 탈출
// 열쇠를 모두 모아 출구로! 몬스터에 닿으면 HP 감소. 스테이지가 오를수록 몬스터가 늘고 빨라지며, 3스테이지부터는 어두워진다.
// 플레이어는 허브에서 만든 내 캐릭터이고, 들고 있는 아이템에 따라 효과가 있다.
'use strict';

(() => {
  const W = 15, H = 21;          // 맵 크기 (세로 화면에 맞춤, 홀수)
  const TICK = 0.1;              // 게임 로직 간격(초)
  const MAX_HP = 5;
  const MOVE_GAP = 60;           // 연속 이동 최소 간격(ms)
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const rnd = (n) => Math.floor(Math.random() * n);
  const K = (x, y) => x + ',' + y;
  const O = '#1b1626';

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

  // ---------- 몬스터 도트 (16x16) ----------
  const MON_ART = {
    slime: [
      '', '', '', '',
      '......oooo......',
      '....oogggwoo....',
      '...ogggggwwgo...',
      '..oggggggggggo..',
      '..ogkkggggkkgo..',
      '.oggkWggggkWggo.',
      '.oggkkggggkkggo.',
      '.ogppggmmggppgo.',
      '.oggggggggggggo.',
      'oGggggggggggggGo',
      'oGGggggggggggGGo',
      '.oooooooooooooo.',
    ],
    shroom: [
      '',
      '',
      '.....oooooo.....',
      '...oorrwwrroo...',
      '..orrwwrrrrrro..',
      '.orrrrrrrwwrrro.',
      '.orwwrrrrwwrrro.',
      'orrwwrrrrrrrrrro',
      'oooooooooooooooo',
      '...osskssksso...',
      '...osskssksso...',
      '...opssmmsspo...',
      '...osssssssso...',
      '....oossssoo....',
      '......oooo......',
    ],
    bat: [
      '', '', '', '', '',
      '.o....oooo....o.',
      '.oo..ovvvvo..oo.',
      '.ovooovvvvooovo.',
      '.ovvvvkvvkvvvvo.',
      '.ovvvvkvvkvvvvo.',
      '.oovvpvmmvpvvoo.',
      '.....ovvvvo.....',
      '......oooo......',
    ],
  };
  const MON_PAL = {
    slime: [
      { o: O, g: '#86efac', G: '#4ade80', w: '#ecfdf5', k: O, W: '#ffffff', p: '#fda4af', m: O },
      { o: O, g: '#93c5fd', G: '#60a5fa', w: '#eff6ff', k: O, W: '#ffffff', p: '#fda4af', m: O },
      { o: O, g: '#f9a8d4', G: '#f472b6', w: '#fdf2f8', k: O, W: '#ffffff', p: '#fb7185', m: O },
    ],
    shroom: [
      { o: O, r: '#fb923c', w: '#fef08a', s: '#fde7c8', k: O, p: '#fda4af', m: O },
      { o: O, r: '#a78bfa', w: '#bbf7d0', s: '#fde7c8', k: O, p: '#fda4af', m: O },
    ],
    bat: [
      { o: O, v: '#a78bfa', k: O, p: '#fda4af', m: O },
      { o: O, v: '#94a3b8', k: O, p: '#fda4af', m: O },
    ],
  };

  // ---------- 아이템/문 도트 (8x8) ----------
  const PAL8 = { y: '#facc15', Y: '#ca8a04', p: '#ec4899', P: '#be185d', w: '#fff' };
  const SPR8 = {
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
      'pwppppPp',
      'pppppppp',
      '.ppppPp.',
      '..ppPp..',
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

  function sprite(rows, grid, size, pal) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    Avatar.paint(c.getContext('2d'), rows, pal, size / grid);
    return c;
  }

  function makeSprites(size, look) {
    const s = {
      player: Avatar.render(look, size),
      key: sprite(SPR8.key, 8, size, PAL8),
      heart: sprite(SPR8.heart, 8, size, PAL8),
      door: sprite(SPR8.door, 8, size, DOOR_LOCKED),
      doorOpen: sprite(SPR8.door, 8, size, DOOR_OPEN),
    };
    for (const type in MON_ART) MON_PAL[type].forEach((pal, i) => { s[type + i] = sprite(MON_ART[type], 16, size, pal); });
    return s;
  }

  let imgCache = {};
  function img(name, look) {
    const key = name + (look ? JSON.stringify(look) : '');
    if (!imgCache[key]) {
      const c = name === 'player' ? Avatar.render(look, 48) : makeSprites(48, Avatar.DEFAULT)[name];
      imgCache[key] = c.toDataURL();
    }
    return `<img class="spr" src="${imgCache[key]}" alt="">`;
  }

  // ---------- 스테이지 ----------
  function buildStage(stage, item) {
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

    const types = stage >= 3 ? ['slime', 'shroom', 'bat'] : stage >= 2 ? ['slime', 'shroom'] : ['slime'];
    const monsters = shuffle(cells.filter((c) => c.d >= 10))
      .slice(0, Math.min(1 + stage, 7))
      .map((c) => {
        const type = types[rnd(types.length)];
        return { x: c.x, y: c.y, rx: c.x, ry: c.y, type, pal: rnd(MON_PAL[type].length), phase: Math.random() * 6 };
      });

    const baseDark = stage >= 3 ? Math.max(3.2, 7 - (stage - 3) * 0.6) : 0;
    return {
      map, exit, items, monsters, keysTotal,
      keysGot: 0,
      player: { x: 1, y: 1, rx: 1, ry: 1, face: 1 },
      monsterEvery: Math.max(0.2, 0.6 - Math.floor(stage / 2) * 0.1) * (item === 'staff' ? 1.25 : 1), // 몬스터 이동 간격(초)
      mAcc: 0,
      chase: Math.min(0.85, 0.35 + stage * 0.08),   // 추격 확률
      sight: 6 + stage,                             // 추격 시작 거리
      dark: baseDark ? baseDark + (item === 'lantern' ? 2 : 0) : 0,  // 시야 반경(칸)
      shield: item === 'shield' ? 1 : 0,
      sword: item === 'sword' ? 1 : 0,
      invuln: 0,
      startTime: Date.now(),
    };
  }

  // ---------- 게임 ----------
  function create(api) {
    const cv = api.canvas;
    const g2 = cv.getContext('2d');
    const prof = api.profile();
    const item = prof.look.item;
    const itemInfo = Avatar.find('item', item);

    let state = 'ready';        // ready | play | clear | over
    let run = null;             // { stage, hp, score, awarded }
    let s = buildStage(1, item);
    let acc = 0, shake = 0, lastMove = 0, hudKey = '';
    let floats = [];
    let cs = 0, sprites = null, bg = null;

    // ----- 흐름 -----
    function showReady() {
      state = 'ready';
      const cont = api.store.get('continue', null);
      const fresh = { stage: 1, hp: api.startHp(), score: 0 };
      const buttons = [];
      if (cont) buttons.push({ label: `이어하기 (STAGE ${cont.stage})`, primary: true, onClick: () => startRun(cont) });
      buttons.push({ label: '새로 시작', primary: !cont, onClick: () => startRun(fresh) });
      buttons.push({ label: '메뉴로', onClick: api.exit });
      api.overlay({
        title: '던전 탈출',
        html:
          '<div class="rules">' +
          `<div>${img('player', prof.look)} <span><b>${Arcade.escapeHtml(prof.name)}</b> Lv.${prof.level} · 시작 HP ${fresh.hp}</span></div>` +
          `<div>${img('key')} 열쇠를 모두 모으면 ${img('doorOpen')} 출구가 열려요</div>` +
          `<div>${img('slime0')} 몬스터에 닿으면 HP 감소</div>` +
          `<div>${img('heart')} 하트로 HP 회복</div>` +
          '</div>' +
          `<div class="opt-desc">장착: ${itemInfo.label} — ${itemInfo.desc}</div>` +
          `<p style="margin:10px 0 0">최고 점수 <b>${api.store.get('best', 0)}</b> · 최고 스테이지 <b>${api.store.get('bestStage', 0)}</b></p>`,
        buttons,
      });
    }

    function startRun(r) {
      run = { stage: r.stage, hp: r.hp, score: r.score, awarded: r.score };
      s = buildStage(run.stage, item);
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

    // 점수 10점 = 경험치 1
    function awardXp() {
      const r = api.addXp((run.score - run.awarded) / 10);
      run.awarded = run.score;
      let html = `<div class="level-up">경험치 <b>+${r.gained} EXP</b>`;
      if (r.leveledUp) {
        html += `<br>🎉 <b>레벨 업! Lv.${r.level}</b>`;
        if (r.unlocked.length) html += `<small>새로 열림: ${r.unlocked.join(', ')}</small>`;
      }
      return html + '</div>';
    }

    function stageClear() {
      state = 'clear';
      const secs = Math.round((Date.now() - s.startTime) / 1000);
      const timeBonus = Math.max(0, 300 - secs * 5);
      const hpBonus = run.hp * 50;
      run.score += 500 + timeBonus + hpBonus;
      const isBest = saveBest();
      const xpHtml = awardXp();
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
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 갱신 ★</div>' : '') + xpHtml,
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
      const xpHtml = awardXp();
      api.vibrate([120, 60, 200]);
      api.overlay({
        title: 'GAME OVER',
        html:
          '<div class="score-table">' +
          `<span>도달 스테이지</span><span>${run.stage}</span>` +
          `<span class="total">최종 점수</span><span class="total">${run.score}</span>` +
          `<span>최고 점수</span><span>${api.store.get('best', 0)}</span>` +
          '</div>' + (isBest ? '<div class="new-best">★ 최고 기록 달성! ★</div>' : '') + xpHtml,
        buttons: [
          { label: '다시 하기', primary: true, onClick: () => startRun({ stage: 1, hp: api.startHp(), score: 0 }) },
          { label: '메뉴로', onClick: api.exit },
        ],
      });
    }

    // ----- 로직 -----
    function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

    function movePlayer(dx, dy) {
      const p = s.player;
      if (dx) p.face = dx;
      const nx = p.x + dx, ny = p.y + dy;
      if (s.map[ny][nx] === '#') return;
      p.x = nx;
      p.y = ny;

      const pos = K(nx, ny);
      const it = s.items.get(pos);
      if (it === 'key') {
        s.items.delete(pos);
        s.keysGot++;
        run.score += 100;
        addFloat(nx, ny, '+100', '#facc15');
        api.vibrate(15);
        if (s.keysGot === s.keysTotal) api.toast('출구가 열렸어요! 초록 문으로 가세요', '#22c55e');
      } else if (it === 'heart') {
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
      const idx = s.monsters.findIndex((m) => m.x === s.player.x && m.y === s.player.y);
      if (idx < 0) return;
      const p = s.player;
      if (s.sword > 0) {                 // 검: 몬스터 퇴치
        s.sword--;
        s.monsters.splice(idx, 1);
        run.score += 200;
        addFloat(p.x, p.y, '퇴치! +200', '#e5e7eb');
        shake = 0.15;
        api.vibrate(30);
        return;
      }
      s.invuln = 15;                     // 1.5초 무적
      if (s.shield > 0) {                // 방패: 1회 막기
        s.shield--;
        addFloat(p.x, p.y, '막았다!', '#94a3b8');
        api.vibrate(30);
        return;
      }
      run.hp--;
      shake = 0.3;
      api.vibrate(90);
      if (run.hp <= 0) gameOver();
      else api.toast('아야! 몬스터에게 맞았어요', '#ef4444');
    }

    function updateHud() {
      if (!run) return;
      const key = [run.stage, run.hp, s.keysGot, s.keysTotal, run.score, s.shield, s.sword].join();
      if (key === hudKey) return;
      hudKey = key;
      const charge = item === 'shield' ? `<span title="방패">🛡${s.shield}</span>` :
        item === 'sword' ? `<span title="검">🗡${s.sword}</span>` : '';
      api.setHud(
        `<span class="stage">STAGE ${run.stage}</span>` +
        `<span class="hp">${'♥'.repeat(run.hp)}<i>${'♥'.repeat(Math.max(0, MAX_HP - run.hp))}</i></span>` +
        `<span>${img('key')} ${s.keysGot}/${s.keysTotal}</span>` + charge +
        `<span>${run.score}</span>`
      );
    }

    function tween(e, dt) {
      const f = Math.min(1, dt * 30);
      e.rx += (e.x - e.rx) * f;
      e.ry += (e.y - e.ry) * f;
      if (Math.abs(e.x - e.rx) < 0.01) e.rx = e.x;
      if (Math.abs(e.y - e.ry) < 0.01) e.ry = e.y;
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

    function drawShadow(x, y, w) {
      g2.fillStyle = 'rgba(0,0,0,0.35)';
      g2.beginPath();
      g2.ellipse(x + cs / 2, y + cs * 0.92, w * cs * 0.32, cs * 0.08, 0, 0, Math.PI * 2);
      g2.fill();
    }

    function draw() {
      const ncs = Math.max(8, Math.floor(Math.min(cv.width / W, cv.height / H)));
      if (ncs !== cs) { cs = ncs; sprites = makeSprites(cs, prof.look); bg = null; }
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

      // 몬스터 (종류별로 다른 움직임)
      for (const m of s.monsters) {
        const x = Math.round(m.rx * cs), y = Math.round(m.ry * cs);
        const spr = sprites[m.type + m.pal];
        const ph = t * 6 + m.phase;
        if (m.type === 'slime') {        // 말랑말랑 찌그러짐
          const sq = Math.sin(ph) * 0.08;
          drawShadow(x, y, 1 + sq);
          const w = cs * (1 + sq), h = cs * (1 - sq);
          g2.drawImage(spr, x + (cs - w) / 2, y + (cs - h), w, h);
        } else if (m.type === 'bat') {   // 파닥파닥 떠다님
          drawShadow(x, y, 0.7);
          g2.drawImage(spr, x, Math.round(y - cs * 0.12 + Math.sin(ph * 1.5) * cs * 0.1));
        } else {                          // 버섯: 뒤뚱뒤뚱
          drawShadow(x, y, 0.9);
          g2.save();
          g2.translate(x + cs / 2, y + cs);
          g2.rotate(Math.sin(ph * 0.8) * 0.12);
          g2.drawImage(spr, -cs / 2, -cs);
          g2.restore();
        }
      }

      // 플레이어: 이동할 때 깡총, 바라보는 방향으로 뒤집기, 피격 무적 중에는 깜빡임
      const p = s.player;
      const remain = Math.min(1, Math.abs(p.x - p.rx) + Math.abs(p.y - p.ry));
      const hop = Math.sin(remain * Math.PI) * cs * 0.18;
      const px = Math.round(p.rx * cs), py = Math.round(p.ry * cs - hop);
      drawShadow(Math.round(p.rx * cs), Math.round(p.ry * cs), 0.9);
      if (!(s.invuln > 0 && Math.floor(s.invuln / 2) % 2 === 0)) {
        if (p.face < 0) {
          g2.save();
          g2.translate(px + cs, py);
          g2.scale(-1, 1);
          g2.drawImage(sprites.player, 0, 0);
          g2.restore();
        } else {
          g2.drawImage(sprites.player, px, py);
        }
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

      // 떠오르는 글자
      g2.font = `bold ${Math.round(cs * 0.5)}px system-ui, sans-serif`;
      g2.textAlign = 'center';
      g2.lineWidth = Math.max(2, cs * 0.08);
      g2.strokeStyle = O;
      for (const f of floats) {
        g2.globalAlpha = Math.max(0, 1 - f.t);
        const fx = (f.x + 0.5) * cs, fy = (f.y - f.t * 0.8) * cs;
        g2.strokeText(f.text, fx, fy);
        g2.fillStyle = f.color;
        g2.fillText(f.text, fx, fy);
      }
      g2.globalAlpha = 1;
      g2.restore();
    }

    showReady();

    // 자동 테스트용 연결 고리 (window.__TEST__ 가 있을 때만)
    if (window.__TEST__) window.__TEST__.dungeon = { get s() { return s; }, get run() { return run; }, movePlayer };

    return {
      isPlaying: () => state === 'play',
      onDir(dx, dy) {
        if (state !== 'play') return;
        const now = performance.now();
        if (now - lastMove < MOVE_GAP) return;
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
        s.mAcc += dt;
        while (s.mAcc >= s.monsterEvery && state === 'play') {
          s.mAcc -= s.monsterEvery;
          moveMonsters();
          checkHit();
        }
        acc += dt;
        while (acc >= TICK && state === 'play') {
          acc -= TICK;
          if (s.invuln > 0) s.invuln--;
          checkHit();
        }
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
      ctx.drawImage(sprite(MON_ART.slime, 16, 48, MON_PAL.slime[0]), (size - 48) / 2, (size - 48) / 2 + 4);
    },
    create,
  });
})();
