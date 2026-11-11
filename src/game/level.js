// 스테이지: 발판, 웨이브(적 등장), 배경 그리기.

import { rgb } from "../engine/px.js";
import { VIEW_W, VIEW_H, WORLD_W, GROUND_Y } from "../config.js";

/** 위에서만 밟을 수 있는 발판. y: 윗면. */
export const PLATFORMS = [
  { x: 230, y: 112, w: 64 },
  { x: 610, y: 104, w: 80 },
  { x: 760, y: 76, w: 56 },
  { x: 1080, y: 110, w: 72 },
  { x: 1440, y: 100, w: 90 },
];

/** 플레이어가 trigger 를 넘으면 적이 나와요. x: 등장 위치, y 생략 시 땅 / 박쥐는 공중. */
export const WAVES = [
  { trigger: 60, name: "숲 입구", enemies: [{ type: "soldier", x: 380 }, { type: "soldier", x: 450 }] },
  { trigger: 470, name: "부서진 다리", enemies: [{ type: "bat", x: 700, y: 70 }, { type: "soldier", x: 760 }, { type: "bat", x: 820, y: 60 }] },
  { trigger: 900, name: "횃불 길", enemies: [{ type: "soldier", x: 1150 }, { type: "soldier", x: 1210 }, { type: "bat", x: 1180, y: 64 }, { type: "soldier", x: 860 }] },
  { trigger: 1300, name: "마지막 방어선", enemies: [{ type: "soldier", x: 1560 }, { type: "soldier", x: 1620 }, { type: "bat", x: 1500, y: 60 }, { type: "bat", x: 1600, y: 50 }, { type: "bat", x: 1240, y: 70 }] },
];

export const TORCHES = [200, 560, 980, 1380, 1700];
export const PORTAL_X = WORLD_W - 70;

// ---- 배경 (bg 배열에 직접 칠해요. 화면 좌표 기준)
const SKY = [rgb(13, 11, 24), rgb(20, 16, 36), rgb(30, 22, 52), rgb(44, 30, 66), rgb(62, 38, 76)];
const MOON = rgb(236, 226, 206), MOON_D = rgb(196, 182, 168);
const FAR = rgb(34, 28, 56), FAR_TOP = rgb(46, 38, 72);
const NEAR = rgb(22, 30, 40), NEAR_TOP = rgb(32, 46, 52);
const EDGE = rgb(88, 120, 70), EDGE_D = rgb(58, 86, 52), DIRT = rgb(52, 40, 46), DIRT_D = rgb(38, 30, 36), MORTAR = rgb(28, 22, 28);
const LEDGE = rgb(120, 104, 128), LEDGE_D = rgb(74, 62, 86), LEDGE_DD = rgb(46, 38, 58);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const hashStar = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const farH = (wx) => 70 + Math.sin(wx * 0.011) * 14 + Math.sin(wx * 0.027 + 1.7) * 7 + Math.sin(wx * 0.061) * 3;
const nearH = (wx) => 112 + Math.sin(wx * 0.016 + 0.4) * 10 + Math.sin(wx * 0.043 + 2.1) * 5 + (Math.sin(wx * 0.19) > 0.85 ? -8 : 0);

export function drawBackground(bg, camX, { platforms = true } = {}) {
  const W = VIEW_W, H = VIEW_H;
  for (let sx = 0; sx < W; sx++) {
    const fh = Math.round(farH(sx + camX * 0.2)), nh = Math.round(nearH(sx + camX * 0.5));
    const wx = sx + Math.round(camX);
    for (let y = 0; y < H; y++) {
      let c;
      if (y >= GROUND_Y) {
        const gy = y - GROUND_Y;
        if (gy === 0) c = EDGE;
        else if (gy === 1) c = (wx & 3) === 0 ? EDGE : EDGE_D;
        else {
          const row = Math.floor((gy - 2) / 6), off = row % 2 ? 8 : 0;
          c = (gy - 2) % 6 === 5 || (wx + off) % 16 === 0 ? MORTAR : gy < 6 ? DIRT : DIRT_D;
        }
      } else if (y >= nh) c = y === nh ? NEAR_TOP : NEAR;
      else if (y >= fh) c = y === fh ? FAR_TOP : FAR;
      else {
        const t = (y / GROUND_Y) * (SKY.length - 1) + BAYER[((y & 3) << 2) | (sx & 3)] / 16;
        c = SKY[Math.min(SKY.length - 1, Math.floor(t))];
        const sxs = sx + Math.round(camX * 0.05);
        if (hashStar(sxs, y) > 0.9965) c = rgb(200, 190, 255);
      }
      bg[y * W + sx] = c;
    }
  }
  // 달 (거의 움직이지 않아요)
  const mx = 250 - Math.round(camX * 0.03), my = 34;
  for (let y = -10; y <= 10; y++)
    for (let x = -10; x <= 10; x++) {
      const d = x * x + y * y;
      if (d > 100) continue;
      const px = mx + x, py = my + y;
      if (px < 0 || px >= W || py < 0 || py >= farH(px + camX * 0.2)) continue;
      bg[py * W + px] = (x - 3) * (x - 3) + (y + 2) * (y + 2) < 30 ? MOON_D : MOON;
    }
  // 발판
  if (!platforms) return;
  for (const p of PLATFORMS) {
    const x0 = Math.round(p.x - camX);
    for (let dy = 0; dy < 7; dy++) {
      const py = p.y + dy;
      if (py < 0 || py >= H) continue;
      for (let dx = 0; dx < p.w; dx++) {
        const px = x0 + dx;
        if (px < 0 || px >= W) continue;
        const edge = dx === 0 || dx === p.w - 1;
        bg[py * W + px] = dy === 0 ? LEDGE : dy === 6 || edge ? LEDGE_DD : (dx + dy * 3) % 11 === 0 ? LEDGE_DD : LEDGE_D;
      }
    }
  }
}

/** 발 아래 땅 높이: 땅 또는 발판 (위에서 내려올 때만). prevY: 지난 프레임 발 높이. */
export function landingY(x, prevY, y) {
  let best = GROUND_Y;
  for (const p of PLATFORMS) {
    if (x < p.x || x > p.x + p.w) continue;
    if (prevY <= p.y + 0.5 && y >= p.y && p.y < best) best = p.y;
  }
  return best;
}

/** 지금 서 있는 곳이 발판 위인지 (발판 끝에서 떨어지게 하려고 써요). */
export function supportAt(x, y) {
  if (y >= GROUND_Y - 0.5) return true;
  return PLATFORMS.some((p) => x >= p.x && x <= p.x + p.w && Math.abs(y - p.y) < 0.5);
}
