// 미니게임: 농장 키우기 (마을형)
// 캐릭터가 직접 돌아다니며 밭을 일구고, 나무를 심고, 닭을 키우고, 집을 짓고, 마을을 꾸민다.
// 모든 성장은 실제 시간 기준 (앱을 꺼 둬도 자람). 실제 시계에 따라 낮/노을/밤이 바뀐다.
'use strict';

(() => {
  const COLS = 10, ROWS = 14;
  const O = '#1b1626';
  const HOUSE = { x: 1, y: 1, w: 2, h: 2 };          // 집터 (고정)
  const POND = { x: 7, y: 11, w: 2, h: 2 };          // 연못 (고정)
  const START_SOILS = [[4, 5], [5, 5], [6, 5], [4, 6], [5, 6], [6, 6]];
  const START_POS = [5, 8];
  const START_COINS = 30;
  const WATER = 0.7;                                 // 물 주면 자라는 시간 70%
  const MAX_HENS = 4, EGG_TIME = 120000, MAX_EGGS = 8;
  const STEP_TIME = 0.1;                             // 자동 걷기 한 칸 시간(초)
  const MOVE_GAP = 90;                               // 직접 이동 최소 간격(ms)
  const rand = (a, b) => a + Math.random() * (b - a);

  const CROPS = [
    { id: 1, name: '무', time: 30, cost: 5, sell: 12, art: 'radish' },
    { id: 2, name: '당근', time: 120, cost: 15, sell: 40, art: 'carrot' },
    { id: 3, name: '토마토', time: 300, cost: 30, sell: 90, art: 'tomato', lv: 2 },
    { id: 4, name: '옥수수', time: 900, cost: 60, sell: 220, art: 'corn', lv: 3 },
    { id: 5, name: '딸기', time: 1800, cost: 100, sell: 400, art: 'strawberry', lv: 5 },
    { id: 6, name: '호박', time: 3600, cost: 200, sell: 900, art: 'pumpkin', lv: 7 },
  ];
  const TREES = {
    2: { name: '사과나무', grow: 180, period: 180, value: 15, fruit: '#ef4444', leaf: '#16a34a', leaf2: '#22c55e' },
    3: { name: '오렌지나무', grow: 240, period: 240, value: 40, fruit: '#f97316', leaf: '#15803d', leaf2: '#16a34a' },
    4: { name: '벚꽃나무', grow: 120, period: 0, leaf: '#f472b6', leaf2: '#fbcfe8' },
  };
  const HOUSES = [
    { name: '집터' },
    { name: '오두막', cost: 200, xp: 100 },
    { name: '아늑한 집', cost: 600, lv: 3, xp: 200 },
    { name: '큰 집', cost: 1500, lv: 6, xp: 400 },
  ];
  // 만들기 메뉴. k: 저장용 종류 번호
  const BUILD = [
    { id: 'soil', k: 1, name: '밭', icon: '🟫', cost: 10, desc: '씨앗을 심어요' },
    { id: 'apple', k: 2, name: '사과나무', icon: '🍎', cost: 50, desc: '3분마다 사과 3개' },
    { id: 'cherry', k: 4, name: '벚꽃나무', icon: '🌸', cost: 80, lv: 3, desc: '꾸미기용' },
    { id: 'orange', k: 3, name: '오렌지나무', icon: '🍊', cost: 150, lv: 4, desc: '4분마다 오렌지 3개' },
    { id: 'flowerR', k: 10, name: '빨간 꽃', icon: '🌹', cost: 5 },
    { id: 'flowerY', k: 11, name: '노란 꽃', icon: '🌼', cost: 5 },
    { id: 'flowerB', k: 12, name: '파란 꽃', icon: '💠', cost: 5 },
    { id: 'path', k: 21, name: '돌길', icon: '🪨', cost: 2 },
    { id: 'fence', k: 20, name: '울타리', icon: '🪵', cost: 3 },
    { id: 'bench', k: 23, name: '벤치', icon: '🪑', cost: 20 },
    { id: 'lamp', k: 22, name: '가로등', icon: '💡', cost: 30, lv: 2, desc: '밤에 불이 켜져요' },
    { id: 'hen', name: '닭', icon: '🐔', cost: 60, desc: '2분마다 달걀 (최대 4마리)' },
  ];
  const KIND = {};
  BUILD.forEach((b) => { if (b.k) KIND[b.k] = b; });
  const SOLID = new Set([2, 3, 4, 20, 22, 23]);
  const FLOWER = { 10: '#ef4444', 11: '#facc15', 12: '#60a5fa' };

  const ART = {
    sprout: ['........', '........', '........', '........', '..g..g..', '..gggg..', '...gg...', '...gg...'],
    growing: ['........', '.g....g.', '.gg..gg.', '..gggg..', '.ggGGgg.', '...gg...', '...gg...', '...gg...'],
    radish: ['.g.gg.g.', '..gGGg..', '...gg...', '..wwww..', '.wwwwww.', '.wwwwWw.', '..wwWw..', '...ww...'],
    carrot: ['..g.g...', '...gg...', '..aaaa..', '..aAaa..', '...aaa..', '...aA...', '....a...', '........'],
    tomato: ['...gg...', '..gggg..', '.rrrrrr.', 'rrwrrrrr', 'rrrrrrRr', 'rrrrrRRr', '.rrRRRr.', '..rrrr..'],
    corn: ['...gg...', '..gyyg..', '..yYyy..', '.gyyYyg.', '.gyYyyg.', '.gyyYyg.', '..gyyg..', '...gg...'],
    strawberry: ['..gggg..', '...gg...', '.rrrrrr.', '.ryrryr.', '.rrrrrr.', '..ryrr..', '..rrrr..', '...rr...'],
    pumpkin: ['...gG...', '....G...', '.aaaaaa.', 'aaAaaAaa', 'aaAaaAaa', 'aaAaaAaa', '.aaaaaa.', '........'],
    hen: ['....rr..', '...owwo.', '..owkwyo', '.owwwwo.', 'owwwwwwo', 'owWwwWwo', '.owwwwo.', '..y..y..'],
    flower: ['........', '..P..P..', '.PPPPPP.', '..PyyP..', '.PPPPPP.', '..P..P..', '...gg...', '...g....'],
  };
  const PAL = {
    g: '#22c55e', G: '#15803d', w: '#f8fafc', W: '#cbd5e1', a: '#f97316', A: '#c2410c',
    r: '#ef4444', R: '#b91c1c', y: '#facc15', Y: '#ca8a04', o: O, k: O,
  };

  function sprite(name, size, extra) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    Avatar.paint(c.getContext('2d'), ART[name], Object.assign({}, PAL, extra || {}), size / 8);
    return c;
  }
  const imgCache = {};
  function img(name) {
    if (!imgCache[name]) imgCache[name] = sprite(name, 32, name === 'flower' ? { P: '#f472b6' } : null).toDataURL();
    return `<img class="spr" src="${imgCache[name]}" alt="">`;
  }

  function fmt(sec) {
    sec = Math.ceil(sec);
    if (sec >= 3600) return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
    if (sec >= 60) return `${Math.floor(sec / 60)}분 ${sec % 60 ? (sec % 60) + '초' : ''}`.trim();
    return `${sec}초`;
  }
  const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  // 실제 시각 → 어둠 정도 (0 낮 ~ 0.55 밤)
  function darkness(h) {
    if (h >= 7 && h < 17) return 0;
    if (h >= 17 && h < 19) return ((h - 17) / 2) * 0.55;
    if (h >= 5 && h < 7) return 0.55 * (1 - (h - 5) / 2);
    return 0.55;
  }

  function create(api) {
    const cv = api.canvas;
    const g = cv.getContext('2d');
    const prof = api.profile();
    const S = api.store;
    const I = (x, y) => y * COLS + x;
    const tiles = new Array(COLS * ROWS).fill(null);

    let coins = S.get('coins', START_COINS);
    let earned = S.get('best', 0);
    let house = Math.max(0, Math.min(3, S.get('house', 0)));

    function saveTile(i) { if (tiles[i]) S.set('t' + i, tiles[i]); else S.del('t' + i); }
    function saveCoins() { S.set('coins', coins); }

    // ----- 불러오기 (이전 버전 농장은 새 마을로 옮김) -----
    if (!S.get('v2', 0)) {
      const old = [];
      for (let i = 0; i < 16; i++) { const d = S.get('plot' + i, null); if (d) old.push(d); S.del('plot' + i); }
      const extra = Math.max(0, S.get('open', 6) - 6);
      S.del('open');
      const spots = START_SOILS.concat([[3, 5], [7, 5], [3, 6], [7, 6], [4, 7], [5, 7], [6, 7], [3, 7], [7, 7], [4, 4]]);
      const n = Math.min(spots.length, Math.max(START_SOILS.length + extra, old.length));
      for (let i = 0; i < n; i++) {
        const [x, y] = spots[i], d = old[i];
        const crop = d && CROPS.find((c) => c.id === d.c);
        tiles[I(x, y)] = crop ? { k: 1, c: crop.id, t: Math.min(d.t, Date.now()), w: d.w ? 1 : 0 } : { k: 1 };
        saveTile(I(x, y));
      }
      saveCoins();
      S.set('v2', 1);
    } else {
      for (let i = 0; i < tiles.length; i++) {
        const d = S.get('t' + i, null);
        if (!d || !(d.k === 1 || d.k === 30 || KIND[d.k])) continue;
        const t = Object.assign({}, d);
        if (t.k === 1 && t.c && !CROPS.find((c) => c.id === t.c)) delete t.c;
        if (t.t) t.t = Math.min(t.t, Date.now());
        tiles[i] = t;
      }
    }

    const fixed = (x, y) => inRect(HOUSE, x, y) || inRect(POND, x, y);
    const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
    const walkable = (x, y) => inside(x, y) && !fixed(x, y) && !(tiles[I(x, y)] && SOLID.has(tiles[I(x, y)].k));

    // 플레이어
    let px = S.get('px', START_POS[0]), py = S.get('py', START_POS[1]);
    if (!walkable(px, py)) [px, py] = START_POS;
    const P = { x: px, y: py, rx: px, ry: py, fx: 0, fy: 1, flip: 1 };
    let path = [], pending = null, walkT = 0, lastMove = 0;

    // 닭
    const hens = [];
    function emptyGrass(nearX, nearY) {
      const list = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (walkable(x, y) && !tiles[I(x, y)] && !(x === P.x && y === P.y)) list.push([x, y, Math.abs(x - nearX) + Math.abs(y - nearY)]);
      }
      list.sort((a, b) => a[2] - b[2]);
      return list.length ? list[Math.floor(rand(0, Math.min(6, list.length)))] : null;
    }
    function addHen(x, y) { hens.push({ x, y, rx: x, ry: y, flip: 1, next: rand(0.5, 2) }); }
    const henCount = Math.min(MAX_HENS, S.get('hens', 0));
    for (let i = 0; i < henCount; i++) { const e = emptyGrass(5, 9); if (e) addHen(e[0], e[1]); }

    // ----- 효과 -----
    let floats = [], parts = [], flies = [];
    let T = 0, ox = 0, oy = 0, spr = null, lastW = 0, lastH = 0;
    const center = (x, y) => ({ x: ox + x * T + T / 2, y: oy + y * T + T / 2 });
    function addFloat(x, y, text, color) { const c = center(x, y); floats.push({ x: c.x, y: c.y - T * 0.3, text, color, t: 0 }); }
    function burst(x, y, color, n) {
      const c = center(x, y);
      for (let k = 0; k < n; k++) parts.push({ x: c.x, y: c.y, vx: rand(-1.5, 1.5) * T, vy: -rand(0.5, 3) * T, life: rand(0.4, 0.8), color });
    }

    // ----- 작물 / 나무 / 달걀 -----
    const cropOf = (t) => CROPS.find((c) => c.id === t.c);
    const need = (t) => cropOf(t).time * (t.w ? WATER : 1) * 1000;
    const progress = (t) => Math.min(1, (Date.now() - t.t) / need(t));
    const remain = (t) => Math.max(0, need(t) - (Date.now() - t.t)) / 1000;
    const sellOf = (crop) => Math.round(crop.sell * (1 + 0.1 * house));
    const treeGrown = (t) => Date.now() - t.t >= TREES[t.k].grow * 1000;
    const fruitAt = (t) => Math.max(t.f || 0, t.t + TREES[t.k].grow * 1000) + TREES[t.k].period * 1000;
    const fruitReady = (t) => TREES[t.k].period > 0 && treeGrown(t) && Date.now() >= fruitAt(t);

    function reward(coinsGot, xp, x, y, text) {
      coins += coinsGot;
      earned += coinsGot;
      saveCoins();
      S.set('best', earned);
      const r = api.addXp(xp);
      addFloat(x, y, `${text} +${coinsGot}코인`, '#facc15');
      if (r.leveledUp) api.toast(`🎉 레벨 업! Lv.${r.level}` + (r.unlocked.length ? ` · ${r.unlocked.join(', ')} 열림` : ''), '#facc15');
    }

    function layEgg(henIndex, x, y) {
      let eggs = 0;
      for (const t of tiles) if (t && t.k === 30) eggs++;
      if (eggs >= MAX_EGGS || !inside(x, y) || tiles[I(x, y)] || fixed(x, y)) return false;
      tiles[I(x, y)] = { k: 30, t: Date.now() };
      saveTile(I(x, y));
      S.set('h' + henIndex, { t: Date.now() });
      return true;
    }
    // 꺼져 있는 동안 지난 시간만큼 닭마다 달걀 1개
    hens.forEach((h, i) => {
      const last = S.get('h' + i, null);
      if (!last) S.set('h' + i, { t: Date.now() });
      else if (Date.now() - last.t >= EGG_TIME) { const e = emptyGrass(h.x, h.y); if (e) layEgg(i, e[0], e[1]); }
    });

    // ----- 모드 (만들기 / 치우기) -----
    let mode = null;   // { type: 'build', item } | { type: 'remove' }
    function setMode(m) {
      mode = m;
      if (!m) api.setButton('build', '🔨 만들기', false);
      else api.setButton('build', '✖ 그만', true);
    }

    function buildMenu() {
      const level = api.profile().level;
      const buttons = BUILD.map((b) => {
        const locked = b.lv && b.lv > level;
        return {
          label: locked ? `🔒 Lv.${b.lv} ${b.name}` : `${b.icon} ${b.name} · ${b.cost}코인${b.desc ? ' · ' + b.desc : ''}`,
          onClick: () => {
            if (locked) { api.toast(`Lv.${b.lv}부터 만들 수 있어요`, '#facc15'); return; }
            api.hideOverlay();
            setMode({ type: 'build', item: b });
            api.toast(`${b.icon} ${b.name}: 놓을 곳을 탭하거나 A`, '#bbf7d0');
          },
        };
      });
      buttons.push({ label: '🧹 치우기 (절반 환불)', onClick: () => { api.hideOverlay(); setMode({ type: 'remove' }); api.toast('🧹 치울 물건을 탭하거나 A', '#fca5a5'); } });
      buttons.push({ label: '닫기', onClick: api.hideOverlay });
      api.overlay({ title: '🔨 만들기', html: `보유 코인 <b>${coins}</b> · 고른 뒤 놓을 곳을 탭하세요. 여러 개 연속으로 놓을 수 있어요.`, buttons });
    }

    function canPlace(x, y, item) {
      if (!inside(x, y) || fixed(x, y) || tiles[I(x, y)]) return false;
      if (x === P.x && y === P.y && SOLID.has(item.k)) return false;
      if (hens.some((h) => h.x === x && h.y === y)) return false;
      return true;
    }

    function place(x, y) {
      const item = mode.item;
      if (!canPlace(x, y, item)) { api.toast('여기에는 놓을 수 없어요'); return; }
      if (coins < item.cost) { api.toast('코인이 부족해요', '#ef4444'); return; }
      if (item.id === 'hen') {
        if (hens.length >= MAX_HENS) { api.toast(`닭은 최대 ${MAX_HENS}마리예요`); return; }
        coins -= item.cost;
        addHen(x, y);
        S.set('hens', hens.length);
        S.set('h' + (hens.length - 1), { t: Date.now() });
      } else {
        coins -= item.cost;
        tiles[I(x, y)] = TREES[item.k] ? { k: item.k, t: Date.now() } : { k: item.k };
        saveTile(I(x, y));
      }
      saveCoins();
      burst(x, y, '#bbf7d0', 8);
      addFloat(x, y, `${item.icon} -${item.cost}`, '#bbf7d0');
      api.vibrate(10);
    }

    function removeAt(x, y) {
      const hi = hens.findIndex((h) => h.x === x && h.y === y);
      if (hi >= 0) {
        hens.splice(hi, 1);
        S.set('hens', hens.length);
        coins += 30;
        saveCoins();
        addFloat(x, y, '🐔 +30', '#fca5a5');
        return;
      }
      const t = inside(x, y) && tiles[I(x, y)];
      if (!t || t.k === 30) { api.toast('치울 물건이 없어요'); return; }
      const refund = Math.floor((KIND[t.k] ? KIND[t.k].cost : 0) / 2);
      tiles[I(x, y)] = null;
      saveTile(I(x, y));
      coins += refund;
      saveCoins();
      burst(x, y, '#a8a29e', 8);
      addFloat(x, y, `🧹 +${refund}`, '#fca5a5');
    }

    // ----- 집 -----
    function houseMenu() {
      const next = HOUSES[house + 1];
      const level = api.profile().level;
      const bonus = house ? `<br>지금 혜택: 작물 수확 코인 <b>+${house * 10}%</b>` : '';
      if (!next) {
        api.overlay({ title: `🏠 ${HOUSES[house].name}`, html: `최고 단계의 집이에요! 멋져요 ✨${bonus}`, buttons: [{ label: '닫기', primary: true, onClick: api.hideOverlay }] });
        return;
      }
      const locked = next.lv && next.lv > level;
      api.overlay({
        title: house ? `🏠 ${HOUSES[house].name}` : '🏗 집터',
        html: (house ? '집을 더 멋지게 고칠까요?' : '여기에 집을 지을 수 있어요!') +
          `<br>${house ? '업그레이드' : '짓기'}: <b>${next.name}</b> · ${next.cost}코인 (보유 ${coins})` +
          `<br>완성하면 경험치 +${next.xp}, 작물 수확 코인 +${(house + 1) * 10}%` + bonus,
        buttons: [
          {
            label: locked ? `🔒 Lv.${next.lv}부터 가능` : `${next.cost}코인으로 ${house ? '업그레이드' : '짓기'}`,
            primary: true,
            onClick: () => {
              if (locked) { api.toast(`Lv.${next.lv}부터 할 수 있어요`, '#facc15'); return; }
              if (coins < next.cost) { api.toast('코인이 부족해요', '#ef4444'); return; }
              coins -= next.cost;
              house++;
              saveCoins();
              S.set('house', house);
              api.hideOverlay();
              const r = api.addXp(next.xp);
              for (let k = 0; k < 4; k++) burst(HOUSE.x + (k % 2), HOUSE.y + (k >> 1), '#facc15', 8);
              api.toast(`🏠 ${next.name} 완성! EXP +${next.xp}` + (r.leveledUp ? ` · 레벨 업 Lv.${r.level}` : ''), '#facc15');
              api.vibrate([30, 40, 60]);
            },
          },
          { label: '닫기', onClick: api.hideOverlay },
        ],
      });
    }

    // ----- 씨앗 -----
    function seedMenu(x, y) {
      const level = api.profile().level;
      const buttons = CROPS.map((c) => {
        const locked = c.lv && c.lv > level;
        return {
          label: locked ? `🔒 Lv.${c.lv} ${c.name}` : `${c.name} · ${fmt(c.time)} · 씨앗 ${c.cost} → ${sellOf(c)}코인`,
          onClick: () => {
            if (locked) { api.toast(`Lv.${c.lv}부터 심을 수 있어요`, '#facc15'); return; }
            if (coins < c.cost) { api.toast('코인이 부족해요', '#ef4444'); return; }
            coins -= c.cost;
            tiles[I(x, y)] = { k: 1, c: c.id, t: Date.now(), w: 0 };
            saveTile(I(x, y));
            saveCoins();
            api.hideOverlay();
            burst(x, y, '#a16207', 6);
            addFloat(x, y, `${c.name} 심기!`, '#bbf7d0');
          },
        };
      });
      buttons.push({ label: '취소', onClick: api.hideOverlay });
      api.overlay({ title: '🌱 씨앗 심기', html: `보유 코인 <b>${coins}</b><br>심은 뒤 한 번 더 하면 <b>물을 줘서 30% 빨리</b> 자라요.`, buttons });
    }

    // ----- 행동 (바라보는 칸 또는 탭한 칸) -----
    function act(x, y) {
      if (!inside(x, y)) return;
      if (mode && mode.type === 'build') return place(x, y);
      if (mode && mode.type === 'remove') return removeAt(x, y);
      if (inRect(HOUSE, x, y)) return houseMenu();
      if (inRect(POND, x, y)) { api.toast('물고기가 헤엄치고 있어요 🐟'); return; }
      if (hens.some((h) => h.x === x && h.y === y)) { api.toast('꼬꼬댁! 🐔'); return; }
      const t = tiles[I(x, y)];
      if (!t) { api.toast('🔨 만들기로 밭·나무·꾸미기를 놓을 수 있어요'); return; }
      if (t.k === 1) {
        if (!t.c) return seedMenu(x, y);
        const crop = cropOf(t);
        if (progress(t) >= 1) {
          tiles[I(x, y)] = { k: 1 };
          saveTile(I(x, y));
          burst(x, y, '#facc15', 12);
          api.vibrate(25);
          return reward(sellOf(crop), Math.ceil(crop.sell / 4), x, y, crop.name);
        }
        if (!t.w) {
          const ratio = progress(t);
          t.w = 1;
          t.t = Date.now() - ratio * need(t);
          saveTile(I(x, y));
          burst(x, y, '#38bdf8', 10);
          addFloat(x, y, '💧 물 주기!', '#38bdf8');
          api.vibrate(15);
          return;
        }
        api.toast(`${crop.name}: ${fmt(remain(t))} 남았어요`, '#a3e635');
        return;
      }
      if (TREES[t.k]) {
        const tr = TREES[t.k];
        if (!treeGrown(t)) { api.toast(`${tr.name}가 자라는 중: ${fmt((t.t + tr.grow * 1000 - Date.now()) / 1000)} 남았어요`, '#a3e635'); return; }
        if (!tr.period) { api.toast('벚꽃이 활짝 피었어요 🌸'); burst(x, y, '#fbcfe8', 10); return; }
        if (fruitReady(t)) {
          t.f = Date.now();
          saveTile(I(x, y));
          burst(x, y, tr.fruit, 12);
          api.vibrate(20);
          return reward(tr.value * 3, Math.ceil((tr.value * 3) / 5), x, y, tr.name === '사과나무' ? '🍎×3' : '🍊×3');
        }
        api.toast(`다음 열매까지 ${fmt((fruitAt(t) - Date.now()) / 1000)}`, '#a3e635');
        return;
      }
      if (t.k === 30) return collectEgg(x, y);
      if (FLOWER[t.k]) { api.toast('꽃이 예쁘게 피었어요 🌼'); return; }
      if (t.k === 23) { api.toast('벤치에 앉아 잠깐 쉬어요… 😌'); return; }
      if (t.k === 22) { api.toast('밤이 되면 불이 켜져요 💡'); return; }
    }

    function collectEgg(x, y) {
      tiles[I(x, y)] = null;
      saveTile(I(x, y));
      burst(x, y, '#fef3c7', 8);
      api.vibrate(15);
      reward(20, 3, x, y, '🥚');
    }

    // ----- 이동 -----
    function stepTo(nx, ny) {
      P.fx = nx - P.x; P.fy = ny - P.y;
      if (P.fx) P.flip = P.fx;
      if (!walkable(nx, ny)) return false;
      P.x = nx; P.y = ny;
      S.set('px', nx); S.set('py', ny);
      const t = tiles[I(nx, ny)];
      if (t && t.k === 30) collectEgg(nx, ny);   // 달걀은 밟으면 줍기
      return true;
    }

    function findPath(tx, ty) {
      const prev = new Map(), q = [[P.x, P.y]];
      prev.set(I(P.x, P.y), null);
      while (q.length) {
        const [x, y] = q.shift();
        if (x === tx && y === ty) break;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = x + dx, ny = y + dy;
          if (walkable(nx, ny) && !prev.has(I(nx, ny))) { prev.set(I(nx, ny), [x, y]); q.push([nx, ny]); }
        }
      }
      if (!prev.has(I(tx, ty))) return null;
      const out = [];
      let cur = [tx, ty];
      while (cur && !(cur[0] === P.x && cur[1] === P.y)) { out.unshift(cur); cur = prev.get(I(cur[0], cur[1])); }
      return out;
    }

    // 탭한 칸으로 걸어가서 (필요하면 옆 칸에서) 행동
    function goAndAct(x, y) {
      const hasThing = !walkable(x, y) || tiles[I(x, y)] || hens.some((h) => h.x === x && h.y === y);
      if (!hasThing) {                                     // 빈 풀밭: 그냥 걸어가기
        path = findPath(x, y) || [];
        pending = null;
        if (!path.length && !(P.x === x && P.y === y)) api.toast('거기까지 갈 길이 없어요');
        return;
      }
      if (Math.abs(P.x - x) + Math.abs(P.y - y) === 1) {   // 바로 옆이면 바라보고 행동
        P.fx = x - P.x; P.fy = y - P.y;
        if (P.fx) P.flip = P.fx;
        act(x, y);
        return;
      }
      if (P.x === x && P.y === y) { act(x, y); return; }
      // 가장 가까운 옆 칸까지 걸어가서 바라보고 행동
      let best = null;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const cx = x + dx, cy = y + dy;
        if (!walkable(cx, cy)) continue;
        const p = findPath(cx, cy);
        if (p && (!best || p.length < best.length)) best = p;
      }
      if (best) { path = best; pending = { x, y, face: true }; return; }
      if (walkable(x, y)) { const p = findPath(x, y); if (p) { path = p; pending = { x, y, face: false }; return; } }
      api.toast('거기까지 갈 길이 없어요');
    }

    // ----- HUD -----
    let hudKey = '';
    const getHour = () => ((window.__TEST__ && window.__TEST__.hour !== undefined) ? window.__TEST__.hour : new Date().getHours() + new Date().getMinutes() / 60);
    function timeLabel() {
      const h = getHour();
      return h >= 7 && h < 17 ? '☀️ 낮' : h >= 17 && h < 19 ? '🌇 노을' : h >= 5 && h < 7 ? '🌅 새벽' : '🌙 밤';
    }
    function updateHud() {
      let ripe = 0;
      for (const t of tiles) if (t && ((t.k === 1 && t.c && progress(t) >= 1) || (TREES[t.k] && fruitReady(t)) || t.k === 30)) ripe++;
      const key = [coins, ripe, house, hens.length, timeLabel()].join();
      if (key === hudKey) return;
      hudKey = key;
      api.setHud(
        `<span class="stage">💰 ${coins}</span>` +
        `<span style="color:#facc15">✨ 수확 ${ripe}</span>` +
        `<span>🏠 ${HOUSES[house].name}</span>` +
        `<span>🐔 ${hens.length}</span>` +
        `<span>${timeLabel()}</span>`
      );
    }

    // ----- 그리기 -----
    let nightC = null;
    function layout() {
      lastW = cv.width; lastH = cv.height;
      T = Math.floor(Math.min(cv.width / COLS, cv.height / ROWS));
      ox = Math.floor((cv.width - T * COLS) / 2);
      oy = Math.floor((cv.height - T * ROWS) / 2);
      const s = Math.max(8, Math.round(T * 0.75));
      spr = {};
      for (const k of ['sprout', 'growing', 'radish', 'carrot', 'tomato', 'corn', 'strawberry', 'pumpkin']) spr[k] = sprite(k, s);
      spr.hen = sprite('hen', Math.max(8, Math.round(T * 0.8)));
      for (const k in FLOWER) spr['f' + k] = sprite('flower', Math.max(8, Math.round(T * 0.8)), { P: FLOWER[k] });
      nightC = document.createElement('canvas');
      nightC.width = cv.width; nightC.height = cv.height;
    }

    function rr(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    function drawGround(now) {
      const u = T / 16;
      g.fillStyle = '#65a30d';
      g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const X = ox + x * T, Y = oy + y * T;
        g.fillStyle = (x + y) % 2 ? '#86efac' : '#7ee2a0';
        g.fillRect(X, Y, T, T);
        if ((x * 7 + y * 3) % 5 === 0) { g.fillStyle = '#4ade80'; g.fillRect(X + u * 4, Y + u * 9, u * 2, u * 3); g.fillRect(X + u * 7, Y + u * 8, u * 2, u * 4); }
      }
      // 연못
      const px0 = ox + POND.x * T, py0 = oy + POND.y * T;
      g.fillStyle = '#0284c7';
      rr(px0 + u * 2, py0 + u * 2, POND.w * T - u * 4, POND.h * T - u * 4, T * 0.5);
      g.fill();
      g.fillStyle = '#38bdf8';
      rr(px0 + u * 4, py0 + u * 4, POND.w * T - u * 8, POND.h * T - u * 8, T * 0.4);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = u;
      const rip = (now * 0.6) % 1;
      g.beginPath(); g.ellipse(px0 + T, py0 + T, T * 0.3 * (0.5 + rip), T * 0.15 * (0.5 + rip), 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#22c55e';
      g.beginPath(); g.arc(px0 + T * 1.45, py0 + T * 0.7, T * 0.18, 0.4, Math.PI * 2 - 0.4); g.fill();
      // 물고기
      g.fillStyle = '#fb923c';
      const fxp = px0 + T + Math.cos(now * 0.8) * T * 0.5, fyp = py0 + T * 1.1 + Math.sin(now * 0.8) * T * 0.3;
      g.beginPath(); g.ellipse(fxp, fyp, T * 0.12, T * 0.06, Math.cos(now * 0.8 + Math.PI / 2), 0, Math.PI * 2); g.fill();
    }

    function drawFlat(x, y, t, now) {
      const X = ox + x * T, Y = oy + y * T, u = T / 16;
      if (t.k === 21) {                                    // 돌길
        g.fillStyle = '#d6d3d1';
        rr(X + u, Y + u, T * 0.45, T * 0.42, u * 2); g.fill();
        rr(X + T * 0.5, Y + u * 2, T * 0.45, T * 0.4, u * 2); g.fill();
        rr(X + u * 3, Y + T * 0.52, T * 0.42, T * 0.42, u * 2); g.fill();
        rr(X + T * 0.52, Y + T * 0.55, T * 0.42, T * 0.38, u * 2); g.fill();
        return;
      }
      if (t.k === 1) {                                     // 밭
        const watered = t.c && t.w && progress(t) < 1;
        g.fillStyle = watered ? '#5b3a1e' : '#8b5a2b';
        rr(X + u, Y + u, T - u * 2, T - u * 2, u * 3); g.fill();
        g.fillStyle = watered ? '#4a2f18' : '#7a4b22';
        for (let k = 1; k < 4; k++) g.fillRect(X + u * 3, Y + (T * k) / 4, T - u * 6, u);
        if (!t.c) return;
        const crop = cropOf(t), pr = progress(t), s = spr.sprout.width;
        const cx = X + (T - s) / 2, cy = Y + (T - s) / 2 - u;
        if (pr >= 1) {
          g.fillStyle = `rgba(253,224,71,${0.25 + 0.15 * Math.sin(now * 5 + x + y)})`;
          g.beginPath(); g.arc(X + T / 2, Y + T / 2, T * 0.42, 0, Math.PI * 2); g.fill();
          g.drawImage(spr[crop.art], cx, cy + Math.sin(now * 4 + x) * u * 1.2);
        } else {
          g.drawImage(pr < 0.4 ? spr.sprout : spr.growing, cx, cy);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X + u * 2, Y + T - u * 4, T - u * 4, u * 2);
          g.fillStyle = t.w ? '#38bdf8' : '#a3e635'; g.fillRect(X + u * 2, Y + T - u * 4, (T - u * 4) * pr, u * 2);
          if (!t.w) {                                      // 물방울: 물 주세요
            const dx = X + T - u * 6, dy = Y + u * 2 + Math.sin(now * 3 + x) * u;
            g.fillStyle = '#38bdf8';
            g.beginPath();
            g.moveTo(dx + u * 2, dy);
            g.quadraticCurveTo(dx + u * 4.5, dy + u * 4, dx + u * 2, dy + u * 5);
            g.quadraticCurveTo(dx - u * 0.5, dy + u * 4, dx + u * 2, dy);
            g.fill();
          }
        }
        return;
      }
      if (FLOWER[t.k]) {                                   // 꽃 (살랑살랑)
        const s = spr['f' + t.k];
        g.save();
        g.translate(X + T / 2, Y + T * 0.9);
        g.rotate(Math.sin(now * 2 + x * 1.3 + y) * 0.08);
        g.drawImage(s, -s.width / 2, -s.height);
        g.restore();
        return;
      }
      if (t.k === 30) {                                    // 달걀
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(X + T / 2, Y + T * 0.72, T * 0.18, T * 0.05, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fef9c3';
        g.beginPath(); g.ellipse(X + T / 2, Y + T * 0.55, T * 0.15, T * 0.19, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(X + T * 0.45, Y + T * 0.48, T * 0.04, T * 0.06, 0, 0, Math.PI * 2); g.fill();
      }
    }

    // 키가 있는 물건 (깊이 정렬해서 그림)
    function drawTall(item, now) {
      const u = T / 16;
      if (item.type === 'tree') {
        const { x, y, t } = item, tr = TREES[t.k];
        const X = ox + x * T, Y = oy + y * T;
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(X + T / 2, Y + T * 0.88, T * 0.38, T * 0.1, 0, 0, Math.PI * 2); g.fill();
        if (!treeGrown(t)) {                               // 묘목
          g.fillStyle = '#7c4a2a'; g.fillRect(X + T * 0.46, Y + T * 0.45, u * 2, T * 0.42);
          g.fillStyle = tr.leaf;
          g.beginPath(); g.arc(X + T * 0.5, Y + T * 0.42, T * 0.22, 0, Math.PI * 2); g.fill();
          return;
        }
        const sway = Math.sin(now * 1.2 + x) * u * 0.6;
        g.fillStyle = '#7c4a2a'; g.fillRect(X + T * 0.4, Y + T * 0.2, T * 0.2, T * 0.68);
        g.fillStyle = tr.leaf;
        g.beginPath();
        g.arc(X + T * 0.5 + sway, Y - T * 0.05, T * 0.48, 0, Math.PI * 2);
        g.arc(X + T * 0.2 + sway, Y + T * 0.2, T * 0.3, 0, Math.PI * 2);
        g.arc(X + T * 0.8 + sway, Y + T * 0.2, T * 0.3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = tr.leaf2;
        g.beginPath(); g.arc(X + T * 0.38 + sway, Y - T * 0.18, T * 0.18, 0, Math.PI * 2); g.fill();
        if (tr.period && fruitReady(t)) {
          g.fillStyle = tr.fruit;
          for (const [fx, fy] of [[0.3, 0.05], [0.62, -0.12], [0.72, 0.22]]) {
            g.beginPath(); g.arc(X + T * fx + sway, Y + T * fy + Math.sin(now * 3 + fx * 9) * u * 0.6, T * 0.1, 0, Math.PI * 2); g.fill();
          }
        }
        if (!tr.period) {                                  // 벚꽃 꽃잎 흩날림
          g.fillStyle = '#fbcfe8';
          for (let k = 0; k < 3; k++) {
            const ph = (now * 0.4 + k * 0.33 + x * 0.1) % 1;
            g.fillRect(X + T * (0.1 + k * 0.35) + Math.sin(ph * 6) * T * 0.15, Y + T * (ph * 1.1 - 0.2), u * 1.5, u * 1.5);
          }
        }
        return;
      }
      if (item.type === 'obj') {
        const { x, y, t } = item, X = ox + x * T, Y = oy + y * T;
        if (t.k === 20) {                                  // 울타리 (이웃과 이어짐)
          const L = x > 0 && tiles[I(x - 1, y)] && tiles[I(x - 1, y)].k === 20;
          const R = x < COLS - 1 && tiles[I(x + 1, y)] && tiles[I(x + 1, y)].k === 20;
          g.fillStyle = '#d6a76b';
          g.fillRect(X + (L ? 0 : T * 0.2), Y + T * 0.45, T * (L ? 0.5 : 0.3) + (R ? T * 0.5 : T * 0.3), u * 2);
          g.fillRect(X + (L ? 0 : T * 0.2), Y + T * 0.68, T * (L ? 0.5 : 0.3) + (R ? T * 0.5 : T * 0.3), u * 2);
          g.fillStyle = '#b07d45';
          g.fillRect(X + T * 0.42, Y + T * 0.3, u * 3, T * 0.6);
          return;
        }
        if (t.k === 22) {                                  // 가로등
          g.fillStyle = '#334155'; g.fillRect(X + T * 0.45, Y - T * 0.3, u * 2, T * 1.15);
          g.fillStyle = '#1e293b'; g.fillRect(X + T * 0.32, Y - T * 0.42, T * 0.36, u * 2);
          g.fillStyle = darkNow > 0.1 ? '#fde047' : '#fef9c3';
          g.fillRect(X + T * 0.36, Y - T * 0.34, T * 0.28, T * 0.22);
          return;
        }
        if (t.k === 23) {                                  // 벤치
          g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X + u * 2, Y + T * 0.8, T - u * 4, u * 2);
          g.fillStyle = '#92400e'; g.fillRect(X + u * 2, Y + T * 0.32, T - u * 4, u * 3);
          g.fillStyle = '#b45309'; g.fillRect(X + u * 2, Y + T * 0.52, T - u * 4, u * 3);
          g.fillStyle = '#44403c'; g.fillRect(X + u * 3, Y + T * 0.6, u * 2, T * 0.25); g.fillRect(X + T - u * 5, Y + T * 0.6, u * 2, T * 0.25);
        }
        return;
      }
      if (item.type === 'house') return drawHouse(now);
      if (item.type === 'hen') {
        const h = item.h;
        const X = ox + h.rx * T, Y = oy + h.ry * T, s = spr.hen;
        const peck = h.peck > 0 ? Math.sin(h.peck * 20) * u : 0;
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(X + T / 2, Y + T * 0.86, T * 0.25, T * 0.06, 0, 0, Math.PI * 2); g.fill();
        g.save();
        g.translate(X + T / 2, Y + T * 0.9 + peck);
        g.scale(h.flip, 1);
        g.drawImage(s, -s.width / 2, -s.height);
        g.restore();
        return;
      }
      if (item.type === 'player') {
        const hs = Math.round(T * 0.95);
        const av = Avatar.render(prof.look, hs);
        const rem = Math.min(1, Math.abs(P.x - P.rx) + Math.abs(P.y - P.ry));
        const hop = Math.sin(rem * Math.PI) * T * 0.15;
        const X = ox + P.rx * T + T / 2, Y = oy + P.ry * T + T * 0.92;
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath(); g.ellipse(X, Y, T * 0.28, T * 0.07, 0, 0, Math.PI * 2); g.fill();
        g.save();
        g.translate(Math.round(X), Math.round(Y - hop));
        g.scale(P.flip < 0 ? -1 : 1, 1);
        g.drawImage(av, -hs / 2, -hs);
        g.restore();
      }
    }

    function drawHouse(now) {
      const X = ox + HOUSE.x * T, Y = oy + HOUSE.y * T, W2 = HOUSE.w * T, H2 = HOUSE.h * T, u = T / 16;
      if (house === 0) {                                   // 집터 + 표지판
        g.fillStyle = '#d9b382';
        rr(X + u * 3, Y + u * 3, W2 - u * 6, H2 - u * 6, u * 4); g.fill();
        g.strokeStyle = '#a16207'; g.setLineDash([u * 3, u * 2]); g.lineWidth = u;
        rr(X + u * 3, Y + u * 3, W2 - u * 6, H2 - u * 6, u * 4); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#7c4a2a'; g.fillRect(X + W2 / 2 - u, Y + H2 * 0.45, u * 2, H2 * 0.35);
        g.fillStyle = '#fef3c7'; g.fillRect(X + W2 * 0.22, Y + H2 * 0.25, W2 * 0.56, H2 * 0.24);
        g.fillStyle = '#7c4a2a'; g.font = `bold ${Math.round(T * 0.3)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText('집터', X + W2 / 2, Y + H2 * 0.43);
        return;
      }
      const wall = ['', '#d6a76b', '#f5f5f4', '#fde68a'][house];
      const roof = ['', '#b91c1c', '#2563eb', '#7c3aed'][house];
      const lit = darkNow > 0.1;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(X + u * 2, Y + H2 - u * 3, W2 - u * 2, u * 3);
      // 벽
      const wallTop = house === 3 ? Y - T * 0.3 : Y + T * 0.45;
      g.fillStyle = wall; g.fillRect(X + u * 2, wallTop, W2 - u * 4, Y + H2 - u * 2 - wallTop);
      if (house === 1) { g.fillStyle = '#b07d45'; for (let k = 1; k < 5; k++) g.fillRect(X + u * 2, wallTop + k * T * 0.25, W2 - u * 4, u); }
      // 지붕
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(X - u, wallTop + u);
      g.lineTo(X + W2 / 2, wallTop - T * 0.75);
      g.lineTo(X + W2 + u, wallTop + u);
      g.fill();
      // 굴뚝과 연기
      if (house >= 2) {
        g.fillStyle = '#78716c'; g.fillRect(X + W2 * 0.7, wallTop - T * 0.65, u * 4, T * 0.4);
        g.fillStyle = 'rgba(241,245,249,0.7)';
        for (let k = 0; k < 3; k++) {
          const ph = (now * 0.5 + k / 3) % 1;
          g.beginPath(); g.arc(X + W2 * 0.7 + u * 2 + Math.sin(ph * 5) * u * 2, wallTop - T * 0.7 - ph * T * 0.8, u * (1.5 + ph * 2.5), 0, Math.PI * 2); g.fill();
        }
      }
      // 문
      g.fillStyle = '#7c2d12'; rr(X + W2 / 2 - T * 0.2, Y + H2 - T * 0.65, T * 0.4, T * 0.63, u * 2); g.fill();
      g.fillStyle = '#facc15'; g.fillRect(X + W2 / 2 + T * 0.1, Y + H2 - T * 0.35, u * 1.5, u * 1.5);
      // 창문 (밤에는 불빛)
      g.fillStyle = lit ? '#fde047' : '#bae6fd';
      const wins = house === 3 ? [[0.15, -0.1], [0.65, -0.1], [0.15, 0.45], [0.65, 0.45]] : [[0.15, 0.5], [0.65, 0.5]];
      for (const [wx, wy] of wins) {
        g.fillRect(X + W2 * wx, Y + T * wy + T * 0.25, T * 0.4, T * 0.32);
        g.fillStyle = '#7c4a2a'; g.fillRect(X + W2 * wx + T * 0.19, Y + T * wy + T * 0.25, u, T * 0.32);
        g.fillStyle = lit ? '#fde047' : '#bae6fd';
      }
      if (house === 3) {                                   // 큰 집: 화단
        for (let k = 0; k < 4; k++) { g.fillStyle = ['#f472b6', '#facc15', '#f472b6', '#facc15'][k]; g.beginPath(); g.arc(X + u * 5 + k * u * 3.5, Y + H2 - u * 4, u * 1.5, 0, Math.PI * 2); g.fill(); }
      }
    }

    let darkNow = 0;
    function draw() {
      if (cv.width !== lastW || cv.height !== lastH || !spr) layout();
      const now = performance.now() / 1000;
      g.imageSmoothingEnabled = false;
      const hour = getHour();
      darkNow = darkness(hour);

      drawGround(now);
      const talls = [{ type: 'house', y: HOUSE.y + HOUSE.h - 1 + 0.9 }];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const t = tiles[I(x, y)];
        if (!t) continue;
        if (TREES[t.k]) talls.push({ type: 'tree', x, y, t });
        else if (t.k === 20 || t.k === 22 || t.k === 23) talls.push({ type: 'obj', x, y, t });
        else drawFlat(x, y, t, now);
      }

      // 바라보는 칸 / 놓을 자리 표시
      const fx = P.x + P.fx, fy = P.y + P.fy, u = T / 16;
      if (inside(fx, fy) && !path.length) {
        let color = '#facc15';
        if (mode && mode.type === 'build') color = canPlace(fx, fy, mode.item) ? '#22c55e' : '#ef4444';
        if (mode && mode.type === 'remove') color = '#f87171';
        g.strokeStyle = color;
        g.lineWidth = u * 1.5;
        g.globalAlpha = 0.6 + 0.4 * Math.sin(now * 6);
        rr(ox + fx * T + u, oy + fy * T + u, T - u * 2, T - u * 2, u * 3);
        g.stroke();
        g.globalAlpha = 1;
      }

      for (const h of hens) talls.push({ type: 'hen', h, y: h.ry + 0.5 });
      talls.push({ type: 'player', y: P.ry + 0.6 });
      talls.sort((a, b) => (a.y !== undefined ? a.y : 0) - (b.y !== undefined ? b.y : 0));
      for (const it of talls) drawTall(it, now);

      // 나비 (꽃이 있으면)
      for (const b of flies) {
        const X = ox + b.x * T, Y = oy + b.y * T, flap = Math.abs(Math.sin(now * 14 + b.ph));
        g.fillStyle = b.color;
        g.fillRect(X - u * 2 * flap - u, Y - u, u * 2 * flap, u * 2);
        g.fillRect(X + u, Y - u, u * 2 * flap, u * 2);
        g.fillStyle = O; g.fillRect(X - u * 0.5, Y - u * 1.5, u, u * 3);
      }

      // 밤 (가로등·창문·캐릭터 주변은 밝게)
      if (darkNow > 0.01) {
        const n = nightC.getContext('2d');
        n.globalCompositeOperation = 'source-over';
        n.clearRect(0, 0, nightC.width, nightC.height);
        n.fillStyle = `rgba(12,14,48,${darkNow})`;
        n.fillRect(0, 0, nightC.width, nightC.height);
        n.globalCompositeOperation = 'destination-out';
        const light = (x, y, r) => {
          const gr = n.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(0,0,0,1)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          n.fillStyle = gr;
          n.beginPath(); n.arc(x, y, r, 0, Math.PI * 2); n.fill();
        };
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const t = tiles[I(x, y)];
          if (t && t.k === 22) light(ox + x * T + T / 2, oy + y * T - T * 0.2, T * 2.6);
        }
        if (house) light(ox + (HOUSE.x + 1) * T, oy + (HOUSE.y + 1.4) * T, T * 1.8);
        light(ox + P.rx * T + T / 2, oy + P.ry * T + T / 2, T * 1.4);
        g.drawImage(nightC, 0, 0);
        // 가로등의 따뜻한 불빛
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const t = tiles[I(x, y)];
          if (!t || t.k !== 22) continue;
          const lx = ox + x * T + T / 2, ly = oy + y * T - T * 0.2;
          const gr = g.createRadialGradient(lx, ly, 0, lx, ly, T * 2.2);
          gr.addColorStop(0, `rgba(253,224,71,${0.35 * darkNow})`);
          gr.addColorStop(1, 'rgba(253,224,71,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(lx, ly, T * 2.2, 0, Math.PI * 2); g.fill();
        }
      } else if (hour >= 16 && hour < 19) {
        g.fillStyle = 'rgba(251,146,60,0.12)';
        g.fillRect(0, 0, cv.width, cv.height);
      }

      for (const q of parts) {
        g.globalAlpha = Math.max(0, q.life * 1.6);
        g.fillStyle = q.color;
        g.fillRect(Math.round(q.x), Math.round(q.y), u * 2, u * 2);
      }
      g.globalAlpha = 1;
      g.font = `bold ${Math.round(T * 0.32)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = u * 2;
      g.strokeStyle = O;
      for (const f of floats) {
        g.globalAlpha = Math.max(0, 1 - f.t);
        const fy2 = f.y - f.t * T * 0.8;
        g.strokeText(f.text, f.x, fy2);
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, fy2);
      }
      g.globalAlpha = 1;
    }

    // ----- 갱신 -----
    function update(dt) {
      for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += T * 8 * dt; q.life -= dt; }
      parts = parts.filter((q) => q.life > 0);
      for (const f of floats) f.t += dt * 0.9;
      floats = floats.filter((f) => f.t < 1);

      const k = Math.min(1, dt * 22);
      P.rx += (P.x - P.rx) * k; P.ry += (P.y - P.ry) * k;

      // 자동 걷기
      if (path.length) {
        walkT -= dt;
        if (walkT <= 0) {
          walkT = STEP_TIME;
          const [nx, ny] = path.shift();
          if (!stepTo(nx, ny)) { path = []; pending = null; }
        }
      } else if (pending) {
        const tg = pending;
        pending = null;
        if (tg.face) { P.fx = Math.sign(tg.x - P.x); P.fy = Math.sign(tg.y - P.y); if (P.fx) P.flip = P.fx; }
        act(tg.x, tg.y);
      }

      // 닭: 돌아다니고, 콕콕, 달걀 낳기
      hens.forEach((h, i) => {
        h.rx += (h.x - h.rx) * Math.min(1, dt * 8);
        h.ry += (h.y - h.ry) * Math.min(1, dt * 8);
        if (h.peck > 0) h.peck -= dt;
        h.next -= dt;
        if (h.next <= 0) {
          h.next = rand(0.8, 2.5);
          if (Math.random() < 0.3) { h.peck = 0.4; return; }
          const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][Math.floor(rand(0, 4))];
          const nx = h.x + dx, ny = h.y + dy;
          if (walkable(nx, ny) && !(nx === P.x && ny === P.y) && !hens.some((o) => o.x === nx && o.y === ny)) {
            h.x = nx; h.y = ny;
            if (dx) h.flip = dx;
          }
        }
        const last = S.get('h' + i, { t: Date.now() });
        if (Date.now() - last.t >= EGG_TIME) {
          if (!layEgg(i, h.x, h.y)) {
            const e = emptyGrass(h.x, h.y);
            if (!e || !layEgg(i, e[0], e[1])) S.set('h' + i, { t: Date.now() });
          }
        }
      });

      // 나비: 꽃 주변을 팔랑팔랑
      const flowers = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const t = tiles[I(x, y)]; if (t && FLOWER[t.k]) flowers.push([x, y]); }
      const want = Math.min(3, Math.ceil(flowers.length / 3));
      while (flies.length < want) flies.push({ x: rand(0, COLS), y: rand(0, ROWS), tx: 0, ty: 0, ph: Math.random() * 6, color: ['#fde047', '#f9a8d4', '#ffffff'][flies.length % 3], next: 0 });
      if (flies.length > want) flies.length = want;
      for (const b of flies) {
        b.next -= dt;
        if (b.next <= 0 && flowers.length) {
          const f = flowers[Math.floor(rand(0, flowers.length))];
          b.tx = f[0] + 0.5 + rand(-0.6, 0.6); b.ty = f[1] + rand(-0.2, 0.5); b.next = rand(1.5, 3.5);
        }
        b.x += (b.tx - b.x) * Math.min(1, dt * 1.2) + Math.sin(performance.now() / 180 + b.ph) * dt * 0.8;
        b.y += (b.ty - b.y) * Math.min(1, dt * 1.2) + Math.cos(performance.now() / 230 + b.ph) * dt * 0.8;
      }

      updateHud();
    }

    // ----- 시작 -----
    if (!S.get('intro2', 0)) {
      S.set('intro2', 1);
      S.set('intro', 1);
      saveCoins();
      api.overlay({
        title: '🌾 농장 마을',
        html:
          '<div class="rules">' +
          '<div>🚶 방향키로 걷거나, 가고 싶은 곳을 탭하세요</div>' +
          '<div>🅰 <b>A 버튼</b>: 바라보는 칸(노란 테두리)에서 행동</div>' +
          `<div>${img('sprout')} 밭: 씨앗 심기 → 물 주기 → 수확</div>` +
          '<div>🔨 <b>만들기</b>: 밭·나무·꽃·울타리·가로등·닭…</div>' +
          `<div>🏠 집터에서 집을 짓고 업그레이드 (수확 +10%씩)</div>` +
          `<div>${img('hen')} 닭은 2분마다 달걀을 낳아요</div>` +
          '</div>' +
          '<p style="margin:6px 0 0">⏰ 실제 시간으로 자라요. 밤이 되면 가로등에 불이 켜져요!<br>💻 PC: 방향키 이동 · 스페이스 행동 · B 만들기</p>',
        buttons: [{ label: '시작!', primary: true, onClick: api.hideOverlay }],
      });
    } else {
      let ripe = 0;
      for (const t of tiles) if (t && ((t.k === 1 && t.c && progress(t) >= 1) || (TREES[t.k] && fruitReady(t)) || t.k === 30)) ripe++;
      if (ripe) api.toast(`없는 동안 ${ripe}개를 거둘 수 있게 됐어요! ✨`, '#facc15');
    }

    if (window.__TEST__) {
      window.__TEST__.farm = {
        tiles, hens, P, get coins() { return coins; }, set coins(v) { coins = v; }, get house() { return house; }, get mode() { return mode; },
        layout: () => ({ T, ox, oy }), act, goAndAct, get path() { return path; }, CROPS, BUILD,
      };
    }

    return {
      isPlaying: () => false,
      onDir(dx, dy) {
        const now = performance.now();
        if (now - lastMove < MOVE_GAP) return;
        lastMove = now;
        path = []; pending = null;
        stepTo(P.x + dx, P.y + dy);
      },
      onAction() { act(P.x + P.fx, P.y + P.fy); },
      onButton(id) {
        if (id === 'act') act(P.x + P.fx, P.y + P.fy);
        if (id === 'build') { if (mode) { setMode(null); api.toast('만들기 끝!'); } else buildMenu(); }
      },
      onPointer(type, x, y) {
        if (type !== 'pointerdown' || !T) return;
        const col = Math.floor((x * cv.width - ox) / T), row = Math.floor((y * cv.height - oy) / T);
        if (!inside(col, row)) return;
        if (mode) { act(col, row); return; }   // 만들기/치우기 중에는 탭한 곳에 바로
        goAndAct(col, row);
      },
      update,
      draw,
      resize() { lastW = 0; },
    };
  }

  Arcade.register({
    id: 'farm',
    title: '농장 키우기',
    desc: '돌아다니며 농사짓고 집 짓고 마을 꾸미기',
    bestLabel: '누적 수익',
    noPause: true,
    buttons: [
      { id: 'act', label: 'A', primary: true },
      { id: 'build', label: '🔨 만들기', key: 'KeyB' },
    ],
    drawIcon(ctx, size) {
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#d6a76b';
      ctx.fillRect(size * 0.15, size * 0.45, size * 0.4, size * 0.4);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath(); ctx.moveTo(size * 0.08, size * 0.48); ctx.lineTo(size * 0.35, size * 0.2); ctx.lineTo(size * 0.62, size * 0.48); ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(size * 0.75, size * 0.4, size * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c4a2a'; ctx.fillRect(size * 0.72, size * 0.52, size * 0.06, size * 0.2);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(size * 0.7, size * 0.38, size * 0.04, 0, Math.PI * 2); ctx.arc(size * 0.8, size * 0.45, size * 0.04, 0, Math.PI * 2); ctx.fill();
    },
    create,
  });
})();
