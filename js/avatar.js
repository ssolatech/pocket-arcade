// 캐릭터(아바타) 꾸미기 데이터와 그리기. 16x16 도트를 몸 → 머리 → 아이템 순서로 겹쳐 그린다.
'use strict';

window.Avatar = (() => {
  const O = '#1b1626'; // 외곽선

  const BODY = {
    boy: [
      '................',
      '................',
      '....oooooooo....',
      '...oSSSSSSSSo...',
      '..oSSSSSSSSSSo..',
      '..oSSSSSSSSSSo..',
      '..oSSkSSSSkSSo..',
      '..oSSkSSSSkSSo..',
      '..oSpSSmmSSpSo..',
      '...oSSSSSSSSo...',
      '...oCCCCCCCCo...',
      '..oSCCCCCCCCSo..',
      '..oSCcCCCCcCSo..',
      '...occcccccco...',
      '....oPPooPPo....',
      '....oBBooBBo....',
    ],
    girl: [
      '................',
      '................',
      '....oooooooo....',
      '...oSSSSSSSSo...',
      '..oSSSSSSSSSSo..',
      '..oSSSSSSSSSSo..',
      '..oSSkSSSSkSSo..',
      '..oSSkSSSSkSSo..',
      '..oSpSSmmSSpSo..',
      '...oSSSSSSSSo...',
      '...oCCCwwCCCo...',
      '..oSCCCCCCCCSo..',
      '...oCCCCCCCCo...',
      '..oCCCCCCCCCCo..',
      '..occcccccccco..',
      '....oSo..oSo....',
    ],
  };

  const HAIR = {
    short: [
      '................',
      '....oooooooo....',
      '...oHHHHHHHHo...',
      '..oHHHHHHHHHHo..',
      '..oHHhHHHHhHHo..',
      '..oH........Ho..',
    ],
    spiky: [
      '...o..o..o..o...',
      '..oHoHHoHHoHo...',
      '..oHHHHHHHHHHo..',
      '..oHHHHHHHHHHo..',
      '..oHhHHhHHhHHo..',
      '..oH........Ho..',
    ],
    bob: [
      '................',
      '....oooooooo....',
      '...oHHHHHHHHo...',
      '..oHHHHHHHHHHo..',
      '..oHhHHHHHHhHo..',
      '.oHH........HHo.',
      '.oHH........HHo.',
      '.oHHo......oHHo.',
      '..oo........oo..',
    ],
    long: [
      '................',
      '....oooooooo....',
      '...oHHHHHHHHo...',
      '..oHHHHHHHHHHo..',
      '..oHHhHHHHhHHo..',
      '.oHH........HHo.',
      '.oHH........HHo.',
      '.oHH........HHo.',
      '.oHH........HHo.',
      '.oHHo......oHHo.',
      '.ohho......ohho.',
      '..oo........oo..',
    ],
    ponytail: [
      '................',
      '....oooooooo....',
      '...oHHHHHHHHoo..',
      '..oHHHHHHHHHHHo.',
      '..oHHhHHHHhHHHHo',
      '..oH........oHHo',
      '............oHho',
      '............oHo.',
      '.............o..',
    ],
  };

  const ITEM_ART = {
    flower: [
      '', '', '', '', '', '', '', '',
      '.............ppp',
      '.............pYp',
      '.............ppp',
      '..............g.',
      '..............g.',
    ],
    stick: [
      '', '', '', '', '', '',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
    ],
    shield: [
      '', '', '', '', '', '', '', '', '',
      'oooooo..........',
      'oFFFFo..........',
      'oFYYFo..........',
      'oFYYFo..........',
      'oFFFFo..........',
      '.oFFo...........',
      '..oo............',
    ],
    lantern: [
      '', '', '', '', '', '', '', '', '',
      '.............o..',
      '............ooo.',
      '...........oYYYo',
      '...........oYwYo',
      '...........oYYYo',
      '............ooo.',
    ],
    sword: [
      '', '', '', '',
      '..............o.',
      '.............oLo',
      '.............oLo',
      '.............oLo',
      '.............oLo',
      '...........oYYYo',
      '.............oNo',
      '.............oNo',
      '..............o.',
    ],
    staff: [
      '', '',
      '.............oGo',
      '.............oGo',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
      '..............N.',
    ],
  };

  // lv: 이 레벨이 되면 해금
  const OPTIONS = {
    gender: [
      { id: 'boy', label: '남자' },
      { id: 'girl', label: '여자' },
    ],
    skin: [
      { id: 's1', label: '밝은 피부', color: '#fbe0c4' },
      { id: 's2', label: '보통 피부', color: '#f2c79b' },
      { id: 's3', label: '구릿빛 피부', color: '#d9a066' },
      { id: 's4', label: '갈색 피부', color: '#8d5a3b' },
    ],
    hairStyle: [
      { id: 'short', label: '짧은 머리' },
      { id: 'spiky', label: '뾰족 머리' },
      { id: 'bob', label: '단발' },
      { id: 'long', label: '긴 머리' },
      { id: 'ponytail', label: '포니테일' },
    ],
    hairColor: [
      { id: 'brown', label: '갈색', color: '#7a4a2a' },
      { id: 'black', label: '검정', color: '#2b2433' },
      { id: 'blonde', label: '금발', color: '#f2c14e' },
      { id: 'red', label: '빨강', color: '#c2410c' },
      { id: 'pink', label: '분홍', color: '#f472b6', lv: 2 },
      { id: 'blue', label: '파랑', color: '#60a5fa', lv: 4 },
      { id: 'silver', label: '은색', color: '#d1d5db', lv: 6 },
    ],
    clothes: [
      { id: 'blue', label: '파랑', color: '#3b82f6' },
      { id: 'red', label: '빨강', color: '#ef4444' },
      { id: 'green', label: '초록', color: '#22c55e' },
      { id: 'purple', label: '보라', color: '#a855f7' },
      { id: 'yellow', label: '노랑', color: '#facc15' },
      { id: 'pink', label: '분홍', color: '#f9a8d4' },
      { id: 'white', label: '하양', color: '#e5e7eb' },
      { id: 'black', label: '검정', color: '#374151', lv: 3 },
      { id: 'teal', label: '청록', color: '#14b8a6', lv: 5 },
    ],
    item: [
      { id: 'none', label: '없음', desc: '맨손으로 모험!' },
      { id: 'flower', label: '꽃', desc: '귀여움 +100 (게임 효과 없음)' },
      { id: 'stick', label: '나무 막대', desc: '모험가의 첫 장비 (게임 효과 없음)' },
      { id: 'shield', label: '방패', desc: '스테이지마다 몬스터 공격 1회 막기', lv: 2 },
      { id: 'lantern', label: '랜턴', desc: '어두운 스테이지에서 시야가 넓어짐', lv: 3 },
      { id: 'sword', label: '검', desc: '스테이지마다 몬스터 1마리 퇴치 (+200점)', lv: 5 },
      { id: 'staff', label: '마법 지팡이', desc: '몬스터 이동 속도 20% 감소', lv: 7 },
    ],
  };

  const GROUP_LABEL = {
    gender: '성별', skin: '피부', hairStyle: '머리 모양', hairColor: '머리 색', clothes: '옷 색', item: '아이템',
  };

  const DEFAULT = { gender: 'boy', skin: 's2', hairStyle: 'short', hairColor: 'brown', clothes: 'blue', item: 'none' };

  function find(group, id) {
    return OPTIONS[group].find((o) => o.id === id) || OPTIONS[group][0];
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function paint(ctx, rows, pal, p) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(i * p), Math.floor(j * p), Math.ceil(p), Math.ceil(p));
      }
    });
  }

  const cache = new Map();
  function render(look, size) {
    look = Object.assign({}, DEFAULT, look);
    const key = JSON.stringify(look) + size;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const p = size / 16;
    const skin = find('skin', look.skin).color;
    const cloth = find('clothes', look.clothes).color;
    const hair = find('hairColor', look.hairColor).color;
    paint(ctx, BODY[look.gender] || BODY.boy, {
      o: O, S: skin, k: O, p: '#f4a3a3', m: '#b4533a',
      C: cloth, c: shade(cloth, 0.75), w: '#ffffff', P: '#3f3a52', B: '#5b3a29',
    }, p);
    paint(ctx, HAIR[look.hairStyle] || HAIR.short, { o: O, H: hair, h: shade(hair, 0.75) }, p);
    const art = ITEM_ART[look.item];
    if (art) {
      paint(ctx, art, {
        o: O, L: '#e5e7eb', Y: '#facc15', N: '#8b5a2b', F: '#94a3b8', G: '#22d3ee', p: '#f472b6', g: '#22c55e', w: '#ffffff',
      }, p);
    }
    if (cache.size > 40) cache.clear();
    cache.set(key, c);
    return c;
  }

  // 레벨 a → b 사이에 새로 해금된 항목 이름 목록
  function unlocksBetween(a, b) {
    const out = [];
    for (const g in OPTIONS) {
      for (const o of OPTIONS[g]) if (o.lv && o.lv > a && o.lv <= b) out.push(`${GROUP_LABEL[g]}: ${o.label}`);
    }
    return out;
  }

  return { OPTIONS, GROUP_LABEL, DEFAULT, find, render, shade, paint, unlocksBetween };
})();
