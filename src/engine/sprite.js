// 글자 그림(ASCII) 스프라이트: 손으로 찍은 픽셀 그림을 문자열로 적고, 팔레트로 색을 입혀요.
//   한 글자 = 한 픽셀, "." = 투명. 팔레트는 { 글자: "#rrggbb" }.
// 캐릭터는 여러 부품(머리, 몸통, 다리...)을 한 장(Sheet)에 겹쳐 찍어 프레임을 만들어요.

import { hex } from "./px.js";

const u = (c) => c >>> 0; // pixelfx 색은 부호 있는 정수라서 부호 없는 값으로 맞춰요
export const color = (s) => u(hex(s));

/** 한 프레임짜리 픽셀 판. ax, ay: 발 위치(기준점). */
export class Sheet {
  constructor(w, h, ax, ay) {
    Object.assign(this, { w, h, ax, ay, px: new Uint32Array(w * h) });
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : 0;
  }
  /**
   * 글자 그림을 (x, y)에 찍어요. pal: 글자 → 색(숫자). swap: 글자 → 다른 글자 (예: 뒤쪽 다리는 어둡게).
   * flip: 좌우 뒤집기.
   */
  art(rows, pal, x, y, { swap = null, flip = false } = {}) {
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        let ch = row[i];
        if (ch === "." || ch === " ") continue;
        if (swap && swap[ch]) ch = swap[ch];
        this.set(x + (flip ? w - 1 - i : i), y + j, pal[ch]);
      }
    });
  }
  /** 두께 있는 선 (팔·칼). 바깥 테두리 색 ink 를 먼저 칠하고 안을 c 로 칠해요. */
  limb(x0, y0, x1, y1, c, ink, thick = 2) {
    const pts = linePts(x0, y0, x1, y1);
    const o = thick === 2 ? [-1, 0, 1, 2] : [-1, 0, 1];
    const n = thick === 2 ? [0, 1] : [0];
    if (ink) for (const [x, y] of pts) for (const dy of o) for (const dx of o) this.set(x + dx, y + dy, ink);
    for (const [x, y] of pts) for (const dy of n) for (const dx of n) this.set(x + dx, y + dy, c);
  }
  /** 1픽셀 선 */
  line(x0, y0, x1, y1, c) {
    for (const [x, y] of linePts(x0, y0, x1, y1)) this.set(x, y, c);
  }
  /** 비어 있는 픽셀 중 그림에 붙은 곳을 ink 로 칠해요 (테두리). */
  outline(ink) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, ink);
  }
  /** 90도 돌린 새 판 (쓰러진 모습). 시계 반대 방향. */
  rotated() {
    const s = new Sheet(this.h, this.w, 0, 0);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) s.px[(this.w - 1 - x) * s.w + y] = this.px[y * this.w + x];
    return s;
  }
  /** 그림이 있는 영역 [x0, y0, x1, y1] */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.px[y * this.w + x]) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    return [x0, y0, x1, y1];
  }
}

export function linePts(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

/** 팔레트 { 글자: "#hex" } → { 글자: 색 숫자 } */
export const palette = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, color(v)]));

const WHITE = color("#ffffff");

/**
 * 스프라이트를 게임 프레임(pixelfx frame)에 그려요. (x, y) = 발 위치.
 * flip: 왼쪽을 봄. flash: 하얗게 번쩍. alpha 는 지원하지 않아요 (blink 로 깜빡이기).
 */
export function drawSprite(frame, s, x, y, { flip = false, flash = 0, blink = false, tint = null } = {}) {
  if (blink || !s) return;
  const W = frame.w, H = frame.h, C = frame.color;
  const bx = Math.round(x) - frame.ox, by = Math.round(y) - frame.oy - s.ay;
  for (let j = 0; j < s.h; j++) {
    const py = by + j;
    if (py < 0 || py >= H) continue;
    for (let i = 0; i < s.w; i++) {
      let c = s.px[j * s.w + i];
      if (!c) continue;
      const px = flip ? bx + (s.ax - i) : bx + (i - s.ax);
      if (px < 0 || px >= W) continue;
      if (flash > 0) c = WHITE;
      else if (tint) c = tint(c);
      C[py * W + px] = c;
    }
  }
}

/** 스프라이트를 일반 canvas 로 (메뉴·선택 화면에서 크게 그릴 때). */
export function sheetToCanvas(s) {
  const cv = document.createElement("canvas");
  cv.width = s.w;
  cv.height = s.h;
  const cx = cv.getContext("2d"), img = cx.createImageData(s.w, s.h), d = new Uint32Array(img.data.buffer);
  d.set(s.px); // pixelfx 색 배열은 canvas 와 같은 바이트 순서(ABGR)예요
  cx.putImageData(img, 0, 0);
  return cv;
}
