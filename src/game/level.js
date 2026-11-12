// 지금 맵의 땅·발판과 배경 그리기. 맵 내용(어디에 무엇이 있는지)은 maps.js 에 있어요.
// 맵이 바뀌면 setLevel(map) 을 불러요. 물리(physics.js)는 level.platforms, level.width 를 봐요.

import { rgb } from "../engine/px.js";
import { VIEW_W, VIEW_H, GROUND_Y } from "../config.js";

export const level = { width: 1800, platforms: [], theme: "road" };

export function setLevel(map) {
  level.width = map.width;
  level.platforms = map.platforms ?? [];
  level.theme = map.theme ?? "road";
}

// ---- 색
const C = (r, g, b) => rgb(r, g, b);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hashStar = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const wave = (wx, a, b) => Math.sin(wx * a + b);

/** 테마: 하늘 색 띠, 먼 산·가까운 층 모양(높이 함수)과 색, 땅 모양. */
const THEMES = {
  // 해 질 녘 시골 마을: 보랏빛 하늘, 언덕, 불 켜진 집들
  village: {
    sky: [C(40, 30, 66), C(70, 46, 92), C(118, 66, 104), C(176, 98, 102), C(222, 140, 104)],
    stars: 0.9985,
    moon: false,
    far: [C(66, 52, 90), C(84, 66, 106)], farH: (wx) => 92 + wave(wx, 0.008, 0) * 10 + wave(wx, 0.021, 2) * 5,
    near: [C(38, 34, 54), C(52, 46, 70)], nearH: houseH,
    windows: houseWindows,
    ground: "grass",
  },
  // 밤의 숲길
  road: {
    sky: [C(13, 11, 24), C(20, 16, 36), C(30, 22, 52), C(44, 30, 66), C(62, 38, 76)],
    stars: 0.9965,
    moon: true,
    far: [C(34, 28, 56), C(46, 38, 72)], farH: (wx) => 70 + wave(wx, 0.011, 0) * 14 + wave(wx, 0.027, 1.7) * 7 + wave(wx, 0.061, 0) * 3,
    near: [C(22, 30, 40), C(32, 46, 52)], nearH: (wx) => 112 + wave(wx, 0.016, 0.4) * 10 + wave(wx, 0.043, 2.1) * 5 + (Math.sin(wx * 0.19) > 0.85 ? -8 : 0),
    ground: "grass",
  },
  // 왕성 안뜰: 성탑 실루엣, 돌 성벽, 돌바닥
  castle: {
    sky: [C(12, 12, 28), C(18, 18, 40), C(26, 24, 54), C(36, 30, 66), C(48, 38, 78)],
    stars: 0.997,
    moon: true,
    far: [C(30, 28, 52), C(42, 40, 68)], farH: towerH,
    near: [C(46, 44, 64), C(70, 68, 92)], nearH: () => 104, wall: true,
    moonAt: [170, 16], // 성탑(가장 높은 곳 y 30)보다 위, 오른쪽 위 HUD 와 겹치지 않게
    windows: castleWindows,
    ground: "stone",
  },
};

// 마을 집: 140px 마다 폭 72 집 한 채 (뾰족 지붕)
function houseH(wx) {
  const i = Math.floor(wx / 140), x = wx - i * 140 - 30;
  if (x < 0 || x >= 72) return 126 + (wave(wx, 0.09, i) > 0.6 ? -3 : 0); // 울타리·덤불
  const roof = 92 - Math.min(x, 71 - x) * 0.55; // 지붕 기울기
  return Math.round(roof);
}
function houseWindows(put, camX) {
  const k = Math.round(camX * 0.5), lit = C(255, 206, 120), lit2 = C(240, 160, 90);
  for (let sx = 0; sx < VIEW_W; sx++) {
    const wx = sx + k, i = Math.floor(wx / 140), x = wx - i * 140 - 30;
    if (x < 0 || x >= 72) continue;
    // 창문 2개, 문 1개
    for (const [x0, y0, w, h] of [[12, 106, 8, 7], [50, 106, 8, 7], [30, 113, 9, 15]]) {
      if (x < x0 || x >= x0 + w) continue;
      for (let y = y0; y < y0 + h; y++) put(sx, y, (x - x0 === Math.floor(w / 2) || y === y0 + 3) && h < 10 ? lit2 : x0 === 30 ? C(96, 64, 44) : lit);
    }
  }
}
// 성탑: 120px 마다 탑, 사이는 성벽 + 톱니
function towerH(wx) {
  const i = Math.floor(wx / 120), x = wx - i * 120;
  if (x < 26) return 34 + (x < 4 || x > 21 ? 0 : 0) - (x % 6 < 3 ? 4 : 0);
  return 70 - (x % 8 < 4 ? 4 : 0);
}
function castleWindows(put, camX) {
  const k = Math.round(camX * 0.2), lit = C(255, 196, 110);
  for (let sx = 0; sx < VIEW_W; sx++) {
    const x = (sx + k) % 120;
    if (x >= 10 && x <= 14) for (let y = 50; y < 58; y++) put(sx, y, lit);
  }
}

const EDGE = C(88, 120, 70), EDGE_D = C(58, 86, 52), DIRT = C(52, 40, 46), DIRT_D = C(38, 30, 36), MORTAR = C(28, 22, 28);
const STONE = C(84, 80, 102), STONE_D = C(62, 58, 80), STONE_E = C(120, 116, 140);
const LEDGE = C(138, 130, 160), LEDGE_D = C(84, 80, 106), LEDGE_DD = C(26, 18, 30), LEDGE_SPOT = C(62, 58, 80); // 발판: 성 돌 색 + 진한 외곽선
const WOOD = C(150, 100, 58), WOOD_D = C(110, 70, 40), WOOD_DD = C(70, 44, 28);
const MOON = C(236, 226, 206), MOON_D = C(196, 182, 168), STAR = C(200, 190, 255);

export function drawBackground(bg, camX, { theme = level.theme, platforms = true } = {}) {
  const T = THEMES[theme] ?? THEMES.road, W = VIEW_W, H = VIEW_H, S = T.sky;
  const put = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < W && y < H) bg[y * W + x] = c;
  };
  for (let sx = 0; sx < W; sx++) {
    const fh = Math.round(T.farH(sx + camX * 0.2)), nh = Math.round(T.nearH(sx + camX * 0.5));
    const wx = sx + Math.round(camX), nx = sx + Math.round(camX * 0.5);
    for (let y = 0; y < H; y++) {
      let c;
      if (y >= GROUND_Y) c = groundPx(T.ground, wx, y - GROUND_Y);
      else if (y >= nh) {
        if (T.wall) c = y === nh ? T.near[1] : (y - nh) % 6 === 5 || (nx + (Math.floor((y - nh) / 6) % 2 ? 6 : 0)) % 12 === 0 ? T.far[0] : T.near[0];
        else c = y === nh ? T.near[1] : T.near[0];
        if (T.wall && y < nh + 4 && nx % 10 < 5) c = y < nh + 4 ? T.near[1] : c; // 성벽 톱니
      } else if (y >= fh) c = y === fh ? T.far[1] : T.far[0];
      else {
        const t = (y / GROUND_Y) * (S.length - 1) + BAYER[((y & 3) << 2) | (sx & 3)] / 16;
        c = S[Math.min(S.length - 1, Math.floor(t))];
        if (hashStar(sx + Math.round(camX * 0.05), y) > T.stars && y < 90) c = STAR;
      }
      bg[y * W + sx] = c;
    }
  }
  if (T.wall) // 성벽 위 톱니 (빈 칸은 하늘·탑이 보여요)
    for (let sx = 0; sx < W; sx++) {
      const nx = sx + Math.round(camX * 0.5);
      if (nx % 10 >= 5) for (let y = 100; y < 104; y++) put(sx, y, T.near[1]);
    }
  if (T.windows) T.windows(put, camX);
  if (T.moon) {
    const [m0, my] = T.moonAt ?? [250, 30];
    const mx = m0 - Math.round(camX * 0.03);
    for (let y = -10; y <= 10; y++)
      for (let x = -10; x <= 10; x++) {
        const px = mx + x, py = my + y;
        if (x * x + y * y > 100 || px < 0 || px >= W || py < 0 || py >= T.farH(px + camX * 0.2)) continue;
        bg[py * W + px] = (x - 3) * (x - 3) + (y + 2) * (y + 2) < 30 ? MOON_D : MOON;
      }
  }
  if (platforms) for (const p of level.platforms) drawPlatform(put, p, camX);
}

function groundPx(kind, wx, gy) {
  if (kind === "stone") {
    if (gy === 0) return STONE_E;
    const row = Math.floor((gy - 1) / 7), off = row % 2 ? 11 : 0;
    return (gy - 1) % 7 === 6 || (wx + off) % 22 === 0 ? MORTAR : gy < 4 ? STONE : STONE_D;
  }
  if (gy === 0) return EDGE;
  if (gy === 1) return (wx & 3) === 0 ? EDGE : EDGE_D;
  const row = Math.floor((gy - 2) / 6), off = row % 2 ? 8 : 0;
  return (gy - 2) % 6 === 5 || (wx + off) % 16 === 0 ? MORTAR : gy < 6 ? DIRT : DIRT_D;
}

function drawPlatform(put, p, camX) {
  const x0 = Math.round(p.x - camX);
  if (p.kind === "crate") {
    // 나무 상자: 윗면부터 땅까지
    for (let y = p.y; y < GROUND_Y; y++)
      for (let dx = 0; dx < p.w; dx++) {
        const edge = dx === 0 || dx === p.w - 1 || y === p.y || y === GROUND_Y - 1;
        const diag = Math.abs((dx / p.w) - ((y - p.y) / (GROUND_Y - p.y))) < 0.08;
        put(x0 + dx, y, edge ? WOOD_DD : y === p.y + 1 ? WOOD : diag ? WOOD_D : (dx % 5 === 0 ? WOOD_D : WOOD));
      }
    return;
  }
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < p.w; dx++) {
      const edge = dx === 0 || dx === p.w - 1;
      put(x0 + dx, p.y + dy, dy === 0 ? LEDGE : dy === 6 || edge ? LEDGE_DD : (dx + dy * 3) % 11 === 0 ? LEDGE_SPOT : LEDGE_D);
    }
}

/** 발 아래 땅 높이: 땅 또는 발판 (위에서 내려올 때만). prevY: 지난 프레임 발 높이. */
export function landingY(x, prevY, y) {
  let best = GROUND_Y;
  for (const p of level.platforms) {
    if (x < p.x || x > p.x + p.w) continue;
    if (prevY <= p.y + 0.5 && y >= p.y && p.y < best) best = p.y;
  }
  return best;
}

/** 지금 서 있는 곳이 발판 위인지 (발판 끝에서 떨어지게 하려고 써요). */
export function supportAt(x, y) {
  if (y >= GROUND_Y - 0.5) return true;
  return level.platforms.some((p) => x >= p.x && x <= p.x + p.w && Math.abs(y - p.y) < 0.5);
}
/** (x, y) 에 서 있는 발판 (없으면 null) */
export const platformAt = (x, y) => level.platforms.find((p) => x >= p.x && x <= p.x + p.w && Math.abs(y - p.y) < 0.5) ?? null;
