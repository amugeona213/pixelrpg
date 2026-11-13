// 주인공 그림: 주인공 스프라이트 시트(assets/ref/hero-sprites.webp)에서 뽑은 픽셀아트(heroArt.js)를 써요.
// 다시 뽑기: py tools/hero-from-strip.py  (시트를 바꾸면 이것만 다시 돌리면 돼요)
//
// 시트 그림은 프레임마다 머리 모양·눈이 조금씩 달라서, 여기서 디자인을 맞춰요:
//   1) 머리 통일: 모든 프레임의 머리를 "서기 1" 그림의 머리로 바꿔요 (얼굴 위치에 맞춰 붙여요)
//   2) 눈 통일: 그 머리에 손으로 찍은 눈(EYES)을 그려요 → 모든 프레임에서 눈이 같아요
//   +) 바람: 머리카락(뒤쪽)과 망토가 프레임마다 조금씩 날려요 (WIND)
//   3) 곧은 칼: 공격 그림의 휜 칼과 앞팔을 지우고, 팔·칼을 각도마다 직접 그려요
//   4) 이어지는 동작(구분 동작):
//        베기 6단계 = 머리 뒤로 들기 → 높이 들기 → 휘두르기 → 베기 → 내리기 → 거두기 (SWING)
//        걷기 8장   = 시트의 4장 사이에 "다음 걸음의 다리 + 1픽셀 내려앉은 몸" 을 끼워요
//        착지       = 서기 그림의 윗몸을 2픽셀 눌러 무릎을 굽힌 모습

import { Sheet, color, palette, sheetToCanvas } from "../engine/sprite.js";
import { HERO_ART, SYMS } from "./heroArt.js";

const HAND = palette({
  k: "#1a121e", s: "#f6dcd0", r: "#eaa6a0", T: "#c08a78", E: "#1c2550", e: "#4a63c0", w: "#ffffff",
  N: "#8b5a3a", l: "#5f3c2a", g: "#ecc864", G: "#c08a40", M: "#f2f6fb", m: "#a8b4c8", n: "#6b7588",
  // 낡은 철검: A 밝은 면, B 가운데, C 그늘, R 녹, D 쇠 날밑·자루끝, F 날밑 밝은 곳
  A: "#ccd2d8", B: "#959fae", C: "#626c80", R: "#8f5a3a", D: "#474e5e", F: "#7c8698",
});
// 눈 (오른쪽을 보는 얼굴). 얼굴의 오른쪽 아래(턱 앞)에 맞춰 그려요. 남자는 얼굴이 좁아서 눈 사이가 가까워요
const EYES = {
  f: [
    "skksssskks",
    "sEEssssEEs",
    "sewssssews",
    "rssssssssr",
    ".sssTTsss.",
  ],
  // 눈 감은 모습 (깜빡임): 속눈썹 선이 아래로
  fBlink: [
    "ssssssssss",
    "ssssssssss",
    "skksssskks",
    "rssssssssr",
    ".sssTTsss.",
  ],
  m: [
    "kkssskks",
    "EEsssEEs",
    "ewsssews",
    "rsssssss",
    ".ssTTss.",
  ],
};
// 프레임마다 머리카락·망토가 뒤로 날리는 정도. sway: 뒤(왼쪽)로 늘어남, lift: 위로 들림(-는 아래로 처짐)
const WIND = {
  idle0: [0, 0], idle1: [1, 0],
  walk0: [2, 0], walk1: [1, 1], walk2: [2, 0], walk3: [1, -1],
  // 걷기 8단계용: 머리카락·망토가 걸음마다 번갈아 흔들려요 (참고 GIF 의 외투 자락처럼)
  wkA: [2, -1], wkB: [3, 0], wkC: [1, 1], wkD: [2, 0], wkE: [2, -1], wkF: [3, 0], wkG: [1, 1], wkH: [2, 0],
  jumpUp: [1, -2], jumpDown: [2, 3],
  attack: [2, 1], hurt: [-1, 2],
};
// 곧은 칼 (오른쪽을 향해 수평, 손잡이가 왼쪽): 금색 날밑, 밝은 칼날 + 그늘 + 칼끝
const SWORD = [
  "....kk..................",
  "kkk.kgk.kkkkkkkkkkkkkk..",
  "kNlkkgGkMMMMMMMMMMMMMMkk",
  "kllkkGgknmmmmmmmmmmmmMMk",
  "kkk.kgk.kkkkkkkkkkkkkkk.",
  "....kk..................",
];
// 공격 그림(heroArt.js 의 attack, 여자) 좌표: 앞팔·칼을 지울 범위와 어깨 위치
const ATTACK = { erase: [25, 21, 99, 31], shoulder: [23, 24] };
// 베기 단계: 손 위치, 칼 각도(라디안, 0 = 앞, - = 위), behind = 머리 뒤로 들어서 머리보다 먼저 그림
const SWING = [
  // 도트 게임 자료(보고서 "도트 게임 주인공 모션 원칙"): 작은 그림에서 칼을 아무 각도로 돌리면 선이 깨져요.
  // 깨끗한 각도(45도 단위)만 쓰고, 휘두르는 순간(smear)에는 칼을 숨기고 pixelfx 베기 궤적이 대신 보여요.
  { hand: [18, 19], ang: -Math.PI * 0.75, behind: true }, // 들기: 칼을 등 뒤 위로 (45도)
  { hand: [19, 12], ang: -Math.PI / 2, behind: true },    // 머리 위로 (수직)
  { hand: [30, 18], smear: true },                        // 휘두르기: 칼은 궤적 속에 (숨김)
  { hand: [33, 24], smear: true },                        // 베기: 궤적 (맞는 순간)
  { hand: [33, 25], ang: 0 },                             // 앞으로 쭉 뻗은 마무리 (가장 오래 보여요)
  { hand: [30, 28], ang: Math.PI / 4 },                   // 거두기 (45도 아래)
];
const LEG_ROWS = 12; // 그림 아래쪽 이 줄 수만큼이 다리
const SLEEVE = color("#e6dfe8"); // 흰 소매

// ---- 걷기 다리: 사용자가 준 참고 GIF(걷기, 10장, 한 장 0.1초)의 다리를 한 픽셀씩 따온 것.
// 치마 바로 아래(6줄)부터 발끝까지라서 다리가 몸에 이어져 움직여요. 색만 주인공 것(짙은 스타킹, 갈색 장화)으로 바꿔요.
//   k 밝은 다리, j 다리, l·m 다리 그늘, a 뒤쪽(어두운) 장화, b 앞쪽 장화, h·i 치마 자락(그리지 않아요), . 투명
const LEG_PAL = palette({
  k: "#5a5078", j: "#433b5e", l: "#2e2944", m: "#2e2944", // 짙은 스타킹 (밝음 → 그늘)
  a: "#3a2420", b: "#6a4430", // 장화 (뒤쪽 어둡게, 앞쪽 밝게)
  A: "#131025", // 외곽선
});
const LEG_ROWS_REF = 6, LEG_CX_REF = 12; // 따온 줄 수, 따온 그림의 다리 가운데 칸
const REF_LEGS = [
  [".......lhhhh..jjjj......", ".......lll....jkkk......", "......ljjj.....kkkj.....", "......jjj......jkkk.....", "......aaa.......bbb.....", "......aa........bbb....."],
  [".......lhhhh.jjjj.......", ".......jlll..jkkk.......", "........jjj...jkkj......", "........jjj....kkb......", "........aaa....bbb......", ".........aa............."],
  ["........hhhjjjj.........", ".........lllkkk.........", ".........jjjkkkj........", ".........jjjjkkb........", ".........aaa.bbb........", "..........aa............"],
  ["........hhhjjjj.........", "..........lkkkk.........", "..........jkkkj.........", "...........jkkb.........", "...........abbb.........", "...........aa..........."],
  ["........hhhmlll.........", "........jjjjjjj.........", "........kkk.jjjl........", "........bbb..jjj........", "........bbb..aaaa.......", "..............aaa......."],
  [".......jhhii.llll.......", ".......jjjj...jjj.......", ".......kkk....ljjj......", "......jkkj.....jjj......", "......bbb......aaaa.....", "......bbb.......aaa....."],
  [".......jhhii.llll.......", "........jjj..jjjj.......", "........kkk..ljjjj......", "........kkk...jjja......", "........bbb....aaa......", ".........bb............."],
  ["........hhhjlll.........", ".........kkkjjj.........", ".........kkkjjjl........", "..........kkljja........", "..........bb.aaa........", "..........bb............"],
  ["........hhhjjll.........", "..........kkkjj.........", "..........kkkjj.........", "...........kkja.........", "...........bbaa.........", "...........bb..........."],
  ["........hhhjlll.........", "........jjjljjj.........", "........kkk.jjjl........", "........bbb.ljjj........", "........bbb..aaaa.......", "..............aaa......."],
];
// 참고 GIF 에서 몸이 1px 내려앉는 장면 (2번, 6번)
const WALK_DOWN = [0, 1, 0, 0, 0, 1, 0, 0, 0, 0];
// 걷기 말고 다른 동작도 같은 다리 디자인으로 (참고 GIF 와 같은 그림체로 손으로 찍음, GIF 처럼 왼쪽 보는 방향으로 적고 그릴 때 뒤집어요)
const STAND_LEGS = [ // 서기: 두 발을 어깨너비로 모아 딛기
  ".........lll.jjj........",
  ".........lll.jkk........",
  ".........jjj.jkk........",
  ".........jjj..kkj.......",
  "........aaa...bbb.......",
  "........aaa...bbbb......",
];
// 베기 때 크게 벌린 걸음 (기준 다리와 같은 그림체, 왼쪽 보는 방향으로 적고 그릴 때 뒤집어요)
const WIDE_LEGS = [
  "......llll....jjjj......",
  ".....lll.......jkkk.....",
  "....ljjj........kkkj....",
  "...ljjj..........kkkj...",
  "..aaaa............bbbb..",
  "..aaa.............bbbbb.",
];
const POSE_LEGS = {
  stand: STAND_LEGS,
  lunge: REF_LEGS[0],   // 베기: 크게 벌린 걸음 자세 (몸이 앞으로 실려요)
  rise: REF_LEGS[3],    // 점프 올라갈 때: 한쪽 무릎을 들어 올림
  fall: REF_LEGS[7],    // 떨어질 때: 다리를 내리며 착지 준비
  hurt: REF_LEGS[1],    // 맞음: 뒤로 밀리며 다리가 모임
  wide: WIDE_LEGS,      // 베기: 깊게 내딛은 걸음
};
/**
 * 낡은 철검 (무기를 고르기 전까지 쓰는 칼). 손(hx, hy)에서 각도 ang 으로, 45도 단위로만 그려요 (도트가 깨지지 않게).
 * 모양: 둥근 쇠 자루끝 · 낡은 가죽 손잡이 · 짧은 쇠 날밑 · 3줄 칼날(밝은 면 / 가운데 / 그늘) · 뾰족한 칼끝
 * 낡은 느낌: 탁한 회색 쇠, 녹슨 점 2개, 이가 빠진 자국 1개
 */
function drawSword(s, hx, hy, ang) {
  const q = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(q)), uy = Math.round(Math.sin(q)); // 칼이 뻗는 방향 (한 칸씩)
  const diag = ux !== 0 && uy !== 0;
  const vx = -uy, vy = ux;                          // 날밑 방향 (칼과 직각)
  const [lx, ly] = ux === 0 ? [-1, 0] : [0, -1];    // 밝은 면 = 위쪽 (빛이 위에서 와요)
  const [tx, ty] = ux !== 0 ? [ux, 0] : [0, uy];    // 날밑 두께 방향
  const G = diag ? 2 : 3, N = diag ? 10 : 15, b0 = 3; // 대각선은 한 칸이 1.4픽셀이라 칸 수를 줄여요
  const pts = new Map();
  const put = (x, y, col) => pts.set(`${x},${y}`, col);
  const at = (a) => [hx + ux * a, hy + uy * a];
  // 자루끝 + 손잡이 (가죽 끈이 번갈아 감긴 모양)
  put(...at(-G - 1), HAND.D);
  for (let a = -G; a <= 0; a++) put(...at(a), (a + G) % 2 ? HAND.N : HAND.l);
  // 칼날 (날밑 바로 앞 한 칸은 좁은 목)
  if (diag) put(...at(2), HAND.B);
  const nick = b0 + Math.floor(N * 0.55), rust1 = b0 + 2, rust2 = b0 + Math.floor(N * 0.72);
  for (let i = 0; i < N; i++) {
    const a = b0 + i, [x, y] = at(a), left = N - 1 - i; // left: 칼끝까지 남은 칸
    put(x, y, left === 0 ? HAND.A : a === rust2 ? HAND.R : HAND.B);
    if (left >= 1 && a !== nick) put(x + lx, y + ly, HAND.A);
    if (left >= 2) put(x - lx, y - ly, a === rust1 ? HAND.R : HAND.C);
  }
  // 날밑 (두 줄 두께, 가운데가 밝아요)
  const [gx, gy] = at(1);
  for (let j = -2; j <= 2; j++)
    for (let k = 0; k < 2; k++) put(gx + vx * j + tx * k, gy + vy * j + ty * k, j === 0 ? HAND.F : HAND.D);
  // 외곽선 먼저 (칼 모양 바깥 1칸)
  for (const key of pts.keys()) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!pts.has(`${x + dx},${y + dy}`)) s.set(x + dx, y + dy, HAND.k);
  }
  for (const [key, col] of pts) {
    const [x, y] = key.split(",").map(Number);
    s.set(x, y, col);
  }
}
/** 앞팔: 어깨 → 손 (흰 소매 + 갈색 장갑) */
function drawArm(s, sx, sy, hx, hy) {
  s.limb(sx, sy, hx, hy, SLEEVE, HAND.k);
  s.set(hx, hy, HAND.l);
  s.set(hx + 1, hy, HAND.l);
  s.set(hx, hy + 1, HAND.l);
  s.set(hx + 1, hy + 1, HAND.N);
}
const M = 8; // 판 가장자리 여백 (머리를 옮겨 붙일 때 잘리지 않게)

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const isSteel = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 36 && r > 70;
};
const isSkin = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return r > 215 && g > 180 && r - b > 22;
};

/** 글자 그림 → 색 격자 (null = 투명) */
function grid(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: w }, (_, x) => (r[x] && r[x] !== "." ? pal[SYMS.indexOf(r[x])] : null)));
}
/** 얼굴: 위쪽 62% 안에서 가장 큰 살색 덩어리의 범위 { x0, y0, x1, y1 } */
function faceBox(g) {
  const h = Math.ceil(g.length * 0.62), w = g[0].length, seen = new Set();
  let best = null;
  for (let sy = 0; sy < h; sy++)
    for (let sx = 0; sx < w; sx++) {
      if (!g[sy][sx] || !isSkin(g[sy][sx]) || seen.has(sy * w + sx)) continue;
      const st = [[sx, sy]], b = { x0: sx, y0: sy, x1: sx, y1: sy, n: 0 };
      seen.add(sy * w + sx);
      while (st.length) {
        const [x, y] = st.pop();
        b.n++;
        b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && g[ny][nx] && isSkin(g[ny][nx]) && !seen.has(ny * w + nx)) {
            seen.add(ny * w + nx);
            st.push([nx, ny]);
          }
      }
      if (!best || b.n > best.n) best = b;
    }
  return best && best.n >= 8 ? best : null;
}

const FRAMES = {};
for (const g of ["f"]) { // 주인공은 여자 한 명
  const art = HERO_ART[g];
  const pal = art.pal, F = art.frames;
  // 기준 머리: 서기 1 그림의 턱 위쪽 전부 + 손으로 찍은 눈
  const base = grid(F.idle0, pal), fb = faceBox(base);
  const head = []; // [x, y, 색(숫자)]
  for (let y = 0; y <= fb.y1; y++) base[y].forEach((c, x) => c && head.push([x, y, color(c)]));
  const eyes = EYES[g] ?? EYES.f, eyeX = fb.x1 - (eyes[0].length - 1), eyeY = fb.y1 - 4;
  eyes.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== ".") head.push([eyeX + i, eyeY + j, HAND[ch]]);
  }));
  // 눈 감은 머리 (깜빡임용): 눈 자리만 바꿔요
  const headBlink = head.slice(0, head.length - eyes.flat().join("").replace(/\./g, "").length);
  if (EYES[g + "Blink"]) EYES[g + "Blink"].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== ".") headBlink.push([eyeX + i, eyeY + j, HAND[ch]]);
  }));
  const eyesArt = eyes;
  const headMinX = Math.min(...head.map((p) => p[0]));
  const hairPivot = Math.min(fb.x0, eyeX) - 2; // 이보다 왼쪽(뒤쪽) 머리카락이 날려요
  const headCx = Math.round((Math.min(...head.map((p) => p[0])) + Math.max(...head.map((p) => p[0]))) / 2);

  // 뒤로 날리기: pivot 보다 왼쪽 픽셀을 멀수록 더 많이 옮겨요
  const blow = (x, y, pivot, minX, sway, lift) => {
    if (x >= pivot || pivot <= minX) return [x, y];
    const t = (pivot - x) / (pivot - minX);
    return [x - Math.round(sway * t), y - Math.round(lift * t * t)];
  };
  /**
   * 한 프레임. o: { legsFrom: 다리를 가져올 다른 프레임 이름, upperDy: 윗몸을 아래로 누르는 픽셀, swing: SWING 단계, blink: 눈 감음 }
   */
  const one = (name, windKey = name, o = {}) => {
    // o.src: 다른 시트에서 뽑은 그림 (f2 = 추가 동작 시트의 점프·착지·맞음·쓰러짐)
    const SRC = o.src ? HERO_ART[o.src] : art;
    let gr = grid(SRC.frames[name], SRC.pal), h = gr.length;
    const w = gr[0].length;
    // o.legCut: 원본 그림의 다리(아래 legCut 줄)를 잘라내고 서기·걷기와 같은 기준 다리(6줄)를 붙여요.
    //   잘린 줄의 칼(회색 쇠)은 그대로 남겨요. footH = 발바닥 아래 줄, 그보다 아래로 내려간 칼끝은 발 위치를 맞춰요
    let footH = h, legCx = null;
    if (o.legCut) {
      const hem = h - (SRC.sink?.[name] ?? 0) - o.legCut, xs = []; // 발바닥(칼끝 아래 줄 빼고)에서 위로 legCut 줄
      for (let y = hem; y < h; y++) for (let x = 0; x < w; x++) if (gr[y][x] && !isSteel(gr[y][x])) xs.push(x);
      legCx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2) + (o.legDx ?? 0);
      footH = hem + LEG_ROWS_REF - 1; // 기준 다리 맨 윗줄이 치마 끝줄과 겹치게 (틈이 안 생겨요)
      const nh = Math.max(h, footH);
      // 잘린 줄에서는 칼만 남겨요: 회색 픽셀이 10개 넘게 이어진 덩어리만 (다리의 흰 줄무늬 조각은 버려요)
      const keep = new Set();
      for (let y = hem; y < h; y++) for (let x = 0; x < w; x++) {
        if (keep.has(y * w + x) || !gr[y][x] || !isSteel(gr[y][x])) continue;
        const st = [[x, y]], seen = [[x, y]], vis = new Set([y * w + x]);
        while (st.length) {
          const [cx, cy] = st.pop();
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = cx + ox, ny = cy + oy;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w && !vis.has(ny * w + nx) && gr[ny][nx] && isSteel(gr[ny][nx])) { vis.add(ny * w + nx); st.push([nx, ny]); seen.push([nx, ny]); }
          }
        }
        if (seen.length > 10) for (const [sx, sy] of seen) keep.add(sy * w + sx);
      }
      gr = Array.from({ length: nh }, (_, y) => y < hem ? gr[y] : Array.from({ length: w }, (_, x) => (keep.has(y * w + x) ? gr[y][x] : null)));
      h = nh;
    }
    // o.erase: [x0, y0, x1, y1, 색] 범위의 픽셀을 그 색으로 바꿔요 (뽑은 그림에서 잘못된 부분 지우기)
    for (const [ex0, ey0, ex1, ey1, col] of o.erase ?? [])
      for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) if (gr[y]?.[x]) gr[y][x] = col;
    const sw = o.swing ?? null;
    const [sway, lift] = WIND[windKey] ?? [0, 0];
    const s = new Sheet(w + M * 2 + (sw || o.blade ? 14 : 0), h + M, 0, h + M);
    // o.face: [x1, y1] 얼굴 오른쪽 아래(턱) 자리를 직접 정해요 (팔이 얼굴을 가려서 자동으로 못 찾는 그림)
    const box = o.face ? { x0: o.face[0] - 7, y0: o.face[1] - 6, x1: o.face[0], y1: o.face[1] } : faceBox(gr) ?? fb;
    const dx = box.x1 - fb.x1, up = o.upperDy ?? 0, dy = box.y1 - fb.y1 + up;
    const legTop = h - LEG_ROWS;
    // 다리: 다른 프레임에서 가져오면 얼굴 위치로 맞춰 붙여요 (걷기 중간 그림)
    if (o.legsFrom) {
      const g2 = grid(F[o.legsFrom], pal), b2 = faceBox(g2) ?? fb, sx = box.x1 - b2.x1, h2 = g2.length;
      for (let y = h2 - LEG_ROWS; y < h2; y++)
        for (let x = 0; x < g2[0].length; x++) if (g2[y][x]) s.set(x + sx + M, y + (h - h2) + M, color(g2[y][x]));
    }
    // 몸: 턱 아래만 (머리는 기준 머리로 바꿔요). 망토(몸 뒤쪽)는 점프할 때 날려요
    const capePivot = box.x0 - 4, cape = windKey.startsWith("jump") ? [Math.ceil(sway / 2), Math.sign(lift) * 2] : [0, 0];
    const E = ATTACK.erase;
    // o.blade: 몸 그림(f3)에 칼만 쥐여 줘요. auto = 앞으로 뻗은 손(몸 가운데 높이의 가장 오른쪽 픽셀), rel = 얼굴 오른쪽 아래 기준
    //   behind = 몸 뒤에 (몸보다 먼저 그려요)
    const blade = () => {
      const B = o.blade;
      let hx, hy;
      if (B.auto) {
        let best = -1;
        for (let y = Math.floor(h * 0.5); y < Math.floor(h * 0.78); y++)
          for (let x = w - 1; x > best; x--) if (gr[y][x]) { best = x; hy = y; break; }
        hx = best;
      } else [hx, hy] = [box.x1 + B.rel[0], box.y1 + B.rel[1]];
      drawSword(s, hx + M, hy + M, B.ang);
    };
    if (o.blade?.behind) blade();
    // o.keepHead: 머리를 바꾸지 않고 그림 전체를 그대로 (누운 모습처럼 머리 방향이 다를 때)
    for (let y = o.keepHead ? 0 : box.y1 + 1; y < h; y++) {
      const isLeg = y >= legTop;
      if (isLeg && o.legsFrom) continue;
      if (o.legs != null && !o.legCut && y >= footH - LEG_ROWS_REF && y < footH) continue; // 참고 GIF 에서 따온 다리로 바꿔요
      for (let x = 0; x < w; x++) {
        if (!gr[y][x]) continue;
        if (sw && x >= E[0] && y >= E[1] && x <= E[2] && y <= E[3]) continue;
        const [nx, ny] = !isLeg ? blow(x, y, capePivot, 0, cape[0], cape[1]) : [x, y];
        s.set(nx + M, ny + M + (isLeg ? 0 : up), color(gr[y][x]));
      }
    }
    // o.keepSword: 머리를 바꿀 때 턱 위쪽의 칼(회색 쇠)은 남겨요 (머리 뒤로 넘어간 칼끝)
    if (o.keepSword && !o.keepHead)
      for (let y = 0; y <= box.y1; y++) for (let x = 0; x < w; x++) if (gr[y][x] && isSteel(gr[y][x])) s.set(x + M, y + M, color(gr[y][x]));
    // o.hand: [x, y] 칼 손잡이에 손(장갑)을 하나 더 쥐여 줘요 (두 손으로 칼 잡기). 팔은 들어 올린 팔과 겹쳐 보여요
    if (o.hand) {
      const [gx, gy] = o.hand, glove = [[0, 0, HAND.l], [1, 0, HAND.l], [0, 1, HAND.N], [1, 1, HAND.l], [2, 1, HAND.N], [1, 2, HAND.N]];
      for (const [x, y] of glove) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!glove.some((q) => q[0] === x + ox && q[1] === y + oy)) s.set(gx + x + ox + M, gy + y + oy + M, HAND.k);
      for (const [x, y, c] of glove) s.set(gx + x + M, gy + y + M, c);
    }
    const armAndSword = () => {
      const [sx, sy] = ATTACK.shoulder, [hx, hy] = sw.hand;
      if (!sw.smear) drawSword(s, hx + M, hy + M, sw.ang);
      drawArm(s, sx + M, sy + M, hx + M, hy + M);
    };
    if (o.legs != null) {
      // 다리 가운데: 원본 다리 줄의 픽셀 가운데에 따온 다리의 가운데를 맞춰요
      const xs = [];
      for (let y = footH - LEG_ROWS_REF; y < footH; y++) for (let x = 0; x < w; x++) if (gr[y][x]) xs.push(x);
      const c = legCx ?? Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
      // 참고 GIF 캐릭터는 왼쪽을 보고 있어서, 오른쪽을 보는 주인공에 맞게 좌우를 뒤집어요
      const src = typeof o.legs === "number" ? REF_LEGS[o.legs] : POSE_LEGS[o.legs];
      const ly0 = footH - LEG_ROWS_REF + M;
      const rows = src.map((r) => [...r.replace(/[hi]/g, ".")].reverse().join(""));
      const lx = c - (REF_LEGS[0][0].length - 1 - LEG_CX_REF) + M, ly = ly0;
      // 외곽선 먼저 (다리 바깥 한 칸, 비어 있는 곳만)
      rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
        if (ch === ".") return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
          const nx = lx + xx + dx, ny = ly + yy + dy, nr = rows[yy + dy];
          const inside = nr && nr[xx + dx] && nr[xx + dx] !== ".";
          if (!inside && !s.get(nx, ny) && ny < footH + M) s.set(nx, ny, LEG_PAL.A); // 발바닥 아래로는 안 그려요
        }
      }));
      s.art(rows, LEG_PAL, lx, ly);
      // 다리 앞을 지나는 칼은 다리 위에 다시 그려요
      if (o.legCut) for (let y = footH - LEG_ROWS_REF; y < h; y++) for (let x = 0; x < w; x++) if (gr[y][x]) s.set(x + M, y + M, color(gr[y][x]));
    }
    if (sw?.behind) armAndSword();
    // o.torso: 턱 아래 가슴(옷깃·블라우스)을 서기 그림에서 가져와 붙여요 (원래 그림의 팔을 지운 자리)
    if (o.torso) for (let y = fb.y1 + 1; y <= fb.y1 + o.torso; y++)
      for (let x = fb.x0 - 4; x <= fb.x1 + 3; x++) if (base[y]?.[x]) s.set(x + dx + M, y + dy + M, color(base[y][x]));
    // o.raise: { hand: [x, y] 머리 꼭대기 가운데 기준 손 자리, ang: 칼 각도 }. 칼과 팔은 머리 뒤(먼저), 두 손은 머리 위(나중)
    const R = o.raise && (() => {
      const top = Math.min(...head.map((p) => p[1])) + dy;
      const hx = headCx + dx + o.raise.hand[0], hy = top + o.raise.hand[1];
      const c = Math.round(Math.cos(o.raise.ang)), n = Math.round(Math.sin(o.raise.ang));
      return { hx, hy, top, h2: [hx - c, hy - n] }; // 둘째 손: 손잡이를 따라 칼 반대쪽
    })();
    if (R) {
      drawSword(s, R.hx + M, R.hy + M, o.raise.ang);
      // 팔뚝: 머리카락 속(머리 꼭대기 아래)에서 손까지만. 어깨~턱 사이는 머리에 가려 보이지 않는 자리예요
      drawArm(s, R.h2[0] - 1 + M, R.top + 5 + M, R.h2[0] + M, R.h2[1] + M);
      drawArm(s, R.hx + 1 + M, R.top + 5 + M, R.hx + M, R.hy + M);
    }
    for (const [x, y, c] of o.keepHead ? [] : o.blink ? headBlink : head) {
      const [nx, ny] = blow(x, y, hairPivot, headMinX, sway, lift);
      s.set(nx + dx + M, ny + dy + M, c);
    }
    if (sw && !sw.behind) armAndSword();
    if (R) for (const [x, y] of [R.h2, [R.hx, R.hy]]) {
      // 장갑 (손잡이를 감싼 두 손)
      for (const [ox, oy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2], [-1, 1], [2, 1]]) if (!s.get(x + ox + M, y + oy + M) || true) s.set(x + ox + M, y + oy + M, HAND.k);
      s.set(x + M, y + M, HAND.l); s.set(x + 1 + M, y + M, HAND.l); s.set(x + M, y + 1 + M, HAND.N); s.set(x + 1 + M, y + 1 + M, HAND.l);
    }
    if (o.blade && !o.blade.behind) blade();
    // o.eyes: 머리를 바꾸지 않은 그림에도 같은 눈을 찍어요 (줄인 그림은 눈이 뭉개져서)
    if (o.eyes && box !== fb) {
      const ex = box.x1 - (eyesArt[0].length - 1), ey = box.y1 - 4;
      // 얼굴(살색)과 원래 눈(어두운 색) 자리에만 찍어요 → 얼굴 앞을 지나는 팔 위에는 눈이 그려지지 않아요
      const onFace = (x, y) => { const c = gr[y]?.[x]; return c && (isSkin(c) || rgbOf(c).reduce((a, b) => a + b) < 240); };
      eyesArt.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && onFace(ex + i, ey + j) && s.set(ex + i + M, ey + j + M, HAND[ch])));
    }
    // 늘어나면서 생긴 1픽셀 틈 메우기 (뒤쪽 영역만)
    const lim = Math.max(hairPivot, capePivot) + dx + M;
    for (let y = 1; y < s.h - 13; y++)
      for (let x = 1; x < lim; x++)
        if (!s.get(x, y) && s.get(x - 1, y) && s.get(x + 1, y)) s.set(x, y, s.get(x - 1, y)); // 세로로 한 줄 전체가 빈 틈도 메워요
    s.ax = headCx + dx + M - (o.step ?? 0); // 머리 가운데가 기준 → 프레임이 바뀌어도 머리가 흔들리지 않아요. step: 앞으로 내딛기
    if (o.lift) s.ay += o.lift; // 몸 전체를 위로 (발이 땅에서 떨어지는 장면)
    if (o.legCut) s.ay = footH + M; // 잘라 붙인 다리의 발바닥
    else s.ay -= SRC.sink?.[name] ?? 0; // 발바닥보다 아래로 내려간 칼끝만큼 발 위치를 올려요
    return s;
  };  // 쓰러짐: 서 있는 그림(통일된 머리)을 눕혀요
  // 쓰러짐: 추가 동작 시트의 누운 그림을 그대로 (머리 방향이 달라 머리는 바꾸지 않아요)
  const lying = one("down", "idle0", { src: "f2", keepHead: true });
  const [x0, , x1, y1] = lying.bounds();
  lying.ax = Math.round((x0 + x1) / 2);
  lying.ay = y1 + 1;
  FRAMES[g] = {
    // 모든 동작이 걷기와 같은 다리 디자인 (POSE_LEGS)
    idle: [one("idle0", "idle0", { legs: "stand" }), one("idle1", "idle1", { legs: "stand" })],
    blink: [one("idle0", "idle0", { blink: true, legs: "stand" })], // 눈 깜빡임
    // (다리를 합성한 중간 그림은 허리 선이 깨지고 픽셀이 떨려서 쓰지 않아요)
    // 걷기 8단계 (사용자가 준 참고 GIF: 장마다 0.1초, 발 닿으면 1px 내려앉고 발이 떨어지면 몸 전체가 1px 떠요)
    //   시트 4장 각각을 "강한 순간 + 이어지는 순간" 두 장으로: 닿기(내려앉음) → 닿기, 엇갈림(뜸) → 엇갈림
    //   다리는 참고 GIF 10장을 그대로 따왔어요. 윗몸은 시트 걷기 4장을 순서대로 (팔이 다리와 반대로 흔들려요)
    walk: REF_LEGS.map((_, i) =>
      one(["walk0", "walk0", "walk0", "walk1", "walk1", "walk2", "walk2", "walk2", "walk3", "walk3"][i], "wk" + "ABCDEFGHAB"[i], { legs: i, upperDy: WALK_DOWN[i] }),
    ),
    // 점프·착지·맞음: 사용자가 준 추가 동작 시트(assets/ref/hero-motions2.png) 맨 아래 줄을 참고로 뽑은 그림
    land: [one("crouch", "idle1", { src: "f2", legCut: 7, legs: "stand" })], // 착지: 무릎을 굽혀 웅크림
    jump: [one("air", "jumpUp", { src: "f2", legCut: 8, legs: "rise" }), one("jumpPrep", "jumpDown", { src: "f2", legCut: 8, legs: "fall" })], // 올라갈 때(공중), 떨어질 때(다리를 내려 착지 준비)
    // 베기 6단계: OpenArt 로 만든 베기 시트(assets/ref/hero-slash-ai.png)를 줄인 그림 (tools/hero-slash.py → f4)
    //   사용자 동작 시트를 기준 그림으로 넣어 같은 얼굴·옷·낡은 철검으로 그렸어요. 팔·칼이 머리 위로 올라가서 머리는 바꾸지 않아요
    //   1 젖히기(칼을 몸 뒤로 낮게) → 2 치켜들기(머리 위) → 3 내려치기 → 4 베기(앞으로 깊게 내딛음, 맞는 순간) → 5 마무리(칼끝을 낮게) → 6 거두기
    //   머리가 가려지지 않는 장(1·4·5·6)은 서기·걷기와 같은 머리로 바꾸고, 칼을 머리 위로 든 장(2·3)은 그림 머리에 같은 눈만 찍어요
    attack: [
      one("s0", "attack", { src: "f4", keepSword: true, legCut: 8, legs: "lunge" }),                                   // 1 젖히기
      one("s1", "attack", { src: "f4", face: [29, 37], legCut: 9, legs: "lunge", erase: [[19, 36, 27, 46, "#1b1c36"]], torso: 8, raise: { hand: [-1, -5], ang: -Math.PI * 0.75 } }), // 2 치켜들기: 두 손으로 칼을 머리 위로, 칼끝은 뒤로
      one("s2", "attack", { src: "f4", face: [30, 35], legCut: 9, legs: "lunge", erase: [[20, 36, 28, 46, "#1b1c36"]], torso: 8, raise: { hand: [6, -4], ang: -Math.PI / 4 } }),     // 3 내려치기 시작: 두 손이 머리 앞쪽 위로, 칼끝이 앞으로 넘어옴
      one("s3", "attack", { src: "f4", keepSword: true, legCut: 8, legs: "lunge" }),                                   // 4 베기
      one("s4", "attack", { src: "f4", keepSword: true, legCut: 8, legs: "lunge" }),                                   // 5 마무리
      one("s5", "attack", { src: "f4", keepSword: true, legCut: 8, legs: "stand" }),                                  // 6 거두기
    ],
    hurt: [one("hurt", "hurt", { src: "f2", legCut: 7, legs: "hurt" })],
    down: [lying],
  };
}
FRAMES.m = FRAMES.f;

/**
 * 지금 상태에 맞는 그림.
 *   state: idle | walk | air | land | attack | hurt | down
 *   actT: 칼 공격 동작 시간 (pixelfx sword-slash: -0.55 시작, 0.06 에 맞음) → 베기 6단계 중 하나
 */
// 걷기: 시간 대신 "걸은 거리"로 그림을 넘겨요 → 발이 미끄러지지 않아요.
// 한 걸음 사이클 36px: 닿기 10px, 엇갈림 8px, 닿기 10px, 엇갈림 8px (78px/s 로 걸으면 약 133ms / 100ms)
// 10장 x 8px = 한 사이클 80px (걷는 속도 78px/s 에서 한 장 약 0.1초, 참고 GIF 와 같은 박자)
const WALK_STEP = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8], WALK_CYCLE = 80;
// 서기(숨쉬기): 400ms 들이쉬고 250ms 내쉬기. 약 3.2초마다 0.12초 눈 깜빡임
const IDLE_MS = [0.4, 0.25], BLINK_EVERY = 3.2, BLINK_LEN = 0.12;
function stepIndex(steps, total, v) {
  let r = ((v % total) + total) % total;
  for (let i = 0; i < steps.length; i++) {
    if (r < steps[i]) return i;
    r -= steps[i];
  }
  return 0;
}

export function heroFrame(gender, state, t, vy = 0, actT = 0, dist = 0) {
  const F = FRAMES[gender === "f" ? "f" : "m"];
  switch (state) {
    case "walk": return F.walk[stepIndex(WALK_STEP, WALK_CYCLE, dist)];
    case "land": return F.land[0];
    case "air": return vy < 40 ? F.jump[0] : F.jump[1];
    case "attack": {
      // 단계: 들기 → 머리 위 → 휘두르기(궤적) → 베기(궤적, 0.06 에 맞음) → 마무리(가장 길게) → 거두기
      const i = actT < -0.3 ? 0 : actT < -0.06 ? 1 : actT < 0.03 ? 2 : actT < 0.12 ? 3 : actT < 0.32 ? 4 : 5;
      return F.attack[i];
    }
    case "hurt": return F.hurt[0];
    case "down": return F.down[0];
    default: {
      if (t % BLINK_EVERY > BLINK_EVERY - BLINK_LEN) return F.blink[0];
      return F.idle[stepIndex(IDLE_MS, IDLE_MS[0] + IDLE_MS[1], t)];
    }
  }
}

export function heroCanvas(gender, state = "idle", i = 0) {
  return sheetToCanvas(FRAMES[gender === "f" ? "f" : "m"][state][i]);
}
export const HERO_FRAMES = FRAMES;
