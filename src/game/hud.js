// 화면 위 글씨와 UI (한글). 큰 캔버스(1280x720)에 직접 그려요.
// 대화창·메뉴·이름 입력은 ui.js (HTML) 가 맡아요.

import { SCALE, GROUND_Y } from "../config.js";
import { TUTORIAL_END } from "./world.js";

const FONT = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";

// 기기별 키 이름 (input.mode: keyboard | touch | gamepad)
const KEY = {
  keyboard: { move: "← →", jump: "Space", attack: "J", interact: "E" },
  gamepad: { move: "스틱", jump: "A", attack: "X", interact: "B" },
  touch: { move: "◀ ▶", jump: "점프", attack: "공격", interact: "조사" },
};
export const keyName = (mode, k) => (KEY[mode] ?? KEY.keyboard)[k];

/** 튜토리얼 안내 문구 */
export function tutorialText(step, mode) {
  const k = (n) => keyName(mode, n);
  switch (step) {
    case 0: return `${k("move")} 로 걸어 보세요`;
    case 1: return `${k("jump")} 로 점프해서 나무 상자 위에 올라가 보세요`;
    case 2: return `${k("attack")} 로 허수아비를 3번 때려 보세요`;
    case 3: return `표지판 앞에서 ${k("interact")} 를 눌러 읽어 보세요`;
    case 4: return `촌장님께 가서 ${k("interact")} 로 말을 거세요`;
    default: return "";
  }
}

export function text(ctx, s, x, y, { size = 22, color = "#f4f1ea", align = "left", weight = 700, shadow = true } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(s, x + 2, y + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function panel(ctx, x, y, w, h, a = 0.55, r = 10) {
  ctx.fillStyle = `rgba(10, 8, 18, ${a})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawHud(ctx, world, mode = "keyboard", banner = null) {
  const W = ctx.canvas.width, H = ctx.canvas.height, p = world.player, pr = world.profile;

  // 이름 + 체력
  panel(ctx, 20, 18, 360, 66);
  text(ctx, pr.name, 36, 38, { size: 21, color: "#ffd84a" });
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 364, 38, { size: 17, align: "right" });
  const bx = 36, by = 56, bw = 328, bh = 14, k = p.hp / p.maxHp;
  ctx.fillStyle = "#2a1620";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = k > 0.35 ? "#d6304a" : "#ff6a3a";
  ctx.fillRect(bx, by, bw * k, bh);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(bx, by, bw * k, 3);

  // 돈 + 지역 이름
  panel(ctx, W - 290, 18, 270, 66);
  text(ctx, world.map.name, W - 36, 38, { size: 19, align: "right", color: "#cfc8e8" });
  ctx.fillStyle = "#f0b424";
  ctx.beginPath();
  ctx.arc(W - 262, 62, 8, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, `${pr.gold} G`, W - 36, 62, { size: 20, align: "right", color: "#ffe066" });

  // 튜토리얼 안내
  if (world.tutorial) {
    const s = tutorialText(pr.tutorial, mode);
    ctx.font = `700 22px ${FONT}`;
    const w = Math.max(420, ctx.measureText(s).width + 80);
    panel(ctx, W / 2 - w / 2, 104, w, 50, 0.72);
    text(ctx, "연습", W / 2 - w / 2 + 16, 129, { size: 16, color: "#8fdc6a" });
    text(ctx, s, W / 2 + 14, 129, { size: 22, align: "center" });
  }

  // 말 걸기 표시: NPC·표지판 머리 위에 말풍선
  if (world.near && p.alive) {
    const o = world.near, sx = (o.x - world.camX) * SCALE, sy = (GROUND_Y - (o.kind === "sign" ? 20 : 44)) * SCALE;
    const label = `${keyName(mode, "interact")}  ${o.kind === "sign" ? "읽기" : "대화"}`;
    ctx.font = `700 20px ${FONT}`;
    const w = ctx.measureText(label).width + 36;
    panel(ctx, sx - w / 2, sy - 62, w, 42, 0.85, 14);
    text(ctx, label, sx, sy - 41, { size: 20, align: "center", color: "#ffe9a6" });
    ctx.fillStyle = "rgba(10, 8, 18, 0.85)";
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 21);
    ctx.lineTo(sx + 8, sy - 21);
    ctx.lineTo(sx, sy - 11);
    ctx.fill();
  }

  // 지역 이름 (맵에 들어올 때 잠깐)
  if (banner && banner.t > 0) {
    ctx.globalAlpha = Math.min(1, banner.t / 0.5);
    text(ctx, banner.text, W / 2, H * 0.36, { size: 44, align: "center", weight: 800, color: "#fff6c4" });
    if (banner.sub) text(ctx, banner.sub, W / 2, H * 0.36 + 46, { size: 20, align: "center", color: "#cfc8e8" });
    ctx.globalAlpha = 1;
  }

  if (world.state === "dead") {
    const a = Math.min(1, world.deadT / 0.8);
    ctx.fillStyle = `rgba(6, 4, 12, ${0.6 * a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    text(ctx, "쓰러졌어요…", W / 2, H / 2 - 20, { size: 54, align: "center", weight: 800, color: "#ff8a8a" });
    text(ctx, "가진 돈의 1/5을 잃고 이 지역 입구에서 다시 시작해요", W / 2, H / 2 + 40, { size: 22, align: "center" });
    ctx.globalAlpha = 1;
  }
}

/** 타이틀 화면 글씨 */
export function drawTitleText(ctx, t) {
  const W = ctx.canvas.width;
  const bob = Math.round(Math.sin(t * 1.6) * 4);
  text(ctx, "픽셀 원정대", W / 2, 150 + bob, { size: 78, align: "center", color: "#ffd84a", weight: 800 });
  text(ctx, "유물 PIXEL 을 찾아서", W / 2, 222, { size: 26, align: "center", color: "#cfc8e8" });
}

/** 캐릭터 만들기 화면 글씨 (오른쪽에 소개, 이름 입력창은 ui.js 가 띄워요) */
export function drawCreateText(ctx) {
  const W = ctx.canvas.width;
  text(ctx, "견습 원정대원", W / 2, 62, { size: 44, align: "center", color: "#ffd84a", weight: 800 });
  const x = 680;
  text(ctx, "도토리 마을의 견습 원정대원.", x, 230, { size: 24, color: "#f4f1ea" });
  text(ctx, "왕의 부름을 받아,", x, 274, { size: 22, color: "#cfc8e8" });
  text(ctx, "유물 PIXEL 을 찾아 떠나요.", x, 308, { size: 22, color: "#cfc8e8" });
  text(ctx, "아래에서 이름을 정해 주세요.", x, 370, { size: 20, color: "#9a94b4" });
}