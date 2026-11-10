// 앱 아이콘(PNG/SVG) 생성기. 실행: node tools/make-icons.js
// 외부 라이브러리 없이 Node 기본 기능(zlib)만 사용한다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = '#1a1626';
const PAL = { h: '#8b5a2b', s: '#f2c79b', d: '#1b1b2a', b: '#3b82f6', B: '#1d4ed8' };
const SPRITE = [
  '..hhhh..',
  '.hhhhhh.',
  '.hsdsds.',
  '..ssss..',
  '.bbbbbb.',
  's.bBBb.s',
  '..bbbb..',
  '..d..d..',
];
// 아이콘 가장자리가 잘려도(마스커블) 캐릭터가 보이도록 12칸 격자 가운데에 8x8 캐릭터 배치
const GRID = 12, OFF = 2;

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const td = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cell = size / GRID;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell) - OFF, gy = Math.floor(y / cell) - OFF;
      const ch = gx >= 0 && gy >= 0 && gx < 8 && gy < 8 ? SPRITE[gy][gx] : '.';
      const [r, g, b] = hex(ch === '.' ? BG : PAL[ch]);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function svg() {
  let rects = '';
  SPRITE.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${x + OFF}" y="${y + OFF}" width="1" height="1" fill="${PAL[ch]}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">` +
    `<rect width="${GRID}" height="${GRID}" rx="2" fill="${BG}"/>${rects}</svg>\n`;
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512));
fs.writeFileSync(path.join(out, 'icon.svg'), svg());
console.log('아이콘 생성 완료:', out);
