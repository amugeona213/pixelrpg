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
/** 칼 그리기: 손(hx, hy)에서 각도 ang 으로. 손잡이·금색 날밑·두 줄 칼날(밝음+그늘)·외곽선 */
function drawSword(s, hx, hy, ang, len = 17) {
  const c = Math.cos(ang), n = Math.sin(ang), px = -n, py = c; // px,py: 칼날 수직 방향(아래쪽)
  const pts = new Map();
  const put = (x, y, col) => pts.set(`${Math.round(x)},${Math.round(y)}`, col);
  for (let i = -3; i <= 0; i += 0.5) put(hx + c * i, hy + n * i, i < -2 ? HAND.N : HAND.l); // 손잡이
  for (let j = -2; j <= 2; j += 0.5) put(hx + c * 1 + px * j, hy + n * 1 + py * j, Math.abs(j) > 1.4 ? HAND.G : HAND.g); // 날밑
  for (let i = 2; i <= len; i += 0.5) {
    put(hx + c * i, hy + n * i, HAND.M);
    if (i < len - 1.5) put(hx + c * i + px, hy + n * i + py, HAND.m);
  }
  put(hx + c * (len + 1), hy + n * (len + 1), HAND.M); // 칼끝
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
    const gr = grid(F[name], pal), w = gr[0].length, h = gr.length;
    const sw = o.swing ?? null;
    const [sway, lift] = WIND[windKey] ?? [0, 0];
    const s = new Sheet(w + M * 2 + (sw ? 14 : 0), h + M, 0, h + M);
    const box = faceBox(gr) ?? fb;
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
    for (let y = box.y1 + 1; y < h; y++) {
      const isLeg = y >= legTop;
      if (isLeg && o.legsFrom) continue;
      if (o.legs != null && y >= h - LEG_ROWS_REF) continue; // 참고 GIF 에서 따온 다리로 바꿔요
      for (let x = 0; x < w; x++) {
        if (!gr[y][x]) continue;
        if (sw && x >= E[0] && y >= E[1] && x <= E[2] && y <= E[3]) continue;
        const [nx, ny] = !isLeg ? blow(x, y, capePivot, 0, cape[0], cape[1]) : [x, y];
        s.set(nx + M, ny + M + (isLeg ? 0 : up), color(gr[y][x]));
      }
    }
    const armAndSword = () => {
      const [sx, sy] = ATTACK.shoulder, [hx, hy] = sw.hand;
      if (!sw.smear) drawSword(s, hx + M, hy + M, sw.ang);
      drawArm(s, sx + M, sy + M, hx + M, hy + M);
    };
    if (o.legs != null) {
      // 다리 가운데: 원본 다리 줄의 픽셀 가운데에 따온 다리의 가운데를 맞춰요
      const xs = [];
      for (let y = h - LEG_ROWS_REF; y < h; y++) for (let x = 0; x < w; x++) if (gr[y][x]) xs.push(x);
      const c = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
      // 참고 GIF 캐릭터는 왼쪽을 보고 있어서, 오른쪽을 보는 주인공에 맞게 좌우를 뒤집어요
      const rows = REF_LEGS[o.legs].map((r) => [...r.replace(/[hi]/g, ".")].reverse().join(""));
      const lx = c - (REF_LEGS[0][0].length - 1 - LEG_CX_REF) + M, ly = h - LEG_ROWS_REF + M;
      // 외곽선 먼저 (다리 바깥 한 칸, 비어 있는 곳만)
      rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
        if (ch === ".") return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
          const nx = lx + xx + dx, ny = ly + yy + dy, nr = rows[yy + dy];
          const inside = nr && nr[xx + dx] && nr[xx + dx] !== ".";
          if (!inside && !s.get(nx, ny)) s.set(nx, ny, LEG_PAL.A);
        }
      }));
      s.art(rows, LEG_PAL, lx, ly);
    }    if (sw?.behind) armAndSword();
    for (const [x, y, c] of o.blink ? headBlink : head) {
      const [nx, ny] = blow(x, y, hairPivot, headMinX, sway, lift);
      s.set(nx + dx + M, ny + dy + M, c);
    }
    if (sw && !sw.behind) armAndSword();
    // 늘어나면서 생긴 1픽셀 틈 메우기 (뒤쪽 영역만)
    const lim = Math.max(hairPivot, capePivot) + dx + M;
    for (let y = 1; y < s.h - 13; y++)
      for (let x = 1; x < lim; x++)
        if (!s.get(x, y) && s.get(x - 1, y) && s.get(x + 1, y) && (s.get(x, y - 1) || s.get(x, y + 1))) s.set(x, y, s.get(x - 1, y));
    s.ax = headCx + dx + M; // 머리 가운데가 기준 → 프레임이 바뀌어도 머리가 흔들리지 않아요
    if (o.lift) s.ay += o.lift; // 몸 전체를 위로 (발이 땅에서 떨어지는 장면)
    return s;
  };  // 쓰러짐: 서 있는 그림(통일된 머리)을 눕혀요
  const lying = one("idle0").rotated();
  const [x0, , x1, y1] = lying.bounds();
  lying.ax = Math.round((x0 + x1) / 2);
  lying.ay = y1 + 1;
  FRAMES[g] = {
    idle: [one("idle0"), one("idle1")],
    blink: [one("idle0", "idle0", { blink: true })], // 눈 깜빡임
    // (다리를 합성한 중간 그림은 허리 선이 깨지고 픽셀이 떨려서 쓰지 않아요)
    // 걷기 8단계 (사용자가 준 참고 GIF: 장마다 0.1초, 발 닿으면 1px 내려앉고 발이 떨어지면 몸 전체가 1px 떠요)
    //   시트 4장 각각을 "강한 순간 + 이어지는 순간" 두 장으로: 닿기(내려앉음) → 닿기, 엇갈림(뜸) → 엇갈림
    //   다리는 참고 GIF 10장을 그대로 따왔어요. 윗몸은 시트 걷기 4장을 순서대로 (팔이 다리와 반대로 흔들려요)
    walk: REF_LEGS.map((_, i) =>
      one(["walk0", "walk0", "walk0", "walk1", "walk1", "walk2", "walk2", "walk2", "walk3", "walk3"][i], "wk" + "ABCDEFGHAB"[i], { legs: i, upperDy: WALK_DOWN[i] }),
    ),    land: [one("idle0", "idle1", { upperDy: 2 })], // 착지: 무릎 굽힘
    jump: [one("jump", "jumpUp"), one("jump", "jumpDown")], // 올라갈 때, 떨어질 때 (머리카락·망토가 반대로 날려요)
    attack: SWING.map((sw, i) => one("attack", i < 2 ? "idle1" : "attack", { swing: sw })),
    hurt: [one("hurt")],
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
