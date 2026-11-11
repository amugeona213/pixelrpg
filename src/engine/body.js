// pixelfx 의 뼈대 캐릭터(posed)를 게임 캐릭터로 그려요. 직업·적마다 색(tint)을 바꿔 칠해요.

import { posed, hex, DUMMY_PAL, rgb } from "./px.js";

const u = (c) => c >>> 0; // 부호 없는 값으로 맞춰서 비교해요 (rgb()는 음수가 나올 수 있어요)
const WHITE = u(rgb(255, 255, 255));

/**
 * 색 바꾸기 표. shell: 겉면 4단계(밝음→어두움), core: 관절·안쪽 4단계, mark: 가슴 표식, ink: 외곽선.
 * pixelfx 더미의 원래 색을 이 색들로 바꿔 그려요. 무기 색은 그대로 둬요.
 */
export function makeTint({ shell, core, mark, ink }) {
  const m = new Map();
  ["A", "B", "C", "D"].forEach((k, i) => m.set(u(hex(DUMMY_PAL[k])), u(hex(shell[i]))));
  ["E", "F", "G", "J"].forEach((k, i) => m.set(u(hex(DUMMY_PAL[k])), u(hex(core[i]))));
  if (mark) m.set(u(hex(DUMMY_PAL.m)), u(hex(mark)));
  if (ink) m.set(u(hex(DUMMY_PAL.k)), u(hex(ink)));
  return m;
}

/**
 * pose 자세의 캐릭터를 발 위치 (x, y)에 그려요. flip: 왼쪽을 봄. flash: 0보다 크면 하얗게 번쩍.
 * blink: true 면 이번 프레임은 안 그려요 (무적 깜빡임).
 */
export function drawBody(frame, pose, x, y, { flip = false, tint = null, flash = 0, blink = false } = {}) {
  if (blink) return;
  const r = posed(pose);
  const rx = Math.round(pose.x ?? 0), ry = Math.round(pose.y ?? 0);
  const W = frame.w, H = frame.h, C = frame.color;
  const BX = Math.round(x) - frame.ox + (flip ? -rx : rx);
  const BY = Math.round(y) - frame.oy + ry;
  for (let i = 0; i < r.n; i++) {
    const px = flip ? BX - r.xs[i] - 1 : BX + r.xs[i];
    const py = BY + r.ys[i];
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    let c = u(r.color[i]);
    if (flash > 0) c = WHITE;
    else if (tint) c = tint.get(c) ?? c;
    C[py * W + px] = c;
  }
}

/** 발밑 그림자 (반투명 검정). hw: 반 폭. */
export function drawShadow(frame, x, groundY, hw = 9) {
  const W = frame.w, H = frame.h, C = frame.color;
  const cx = Math.round(x) - frame.ox, sy = Math.round(groundY) - frame.oy;
  for (let dy = 0; dy < 2; dy++) {
    const py = sy + dy;
    if (py < 0 || py >= H) continue;
    for (let dx = -hw + dy * 2; dx <= hw - dy * 2; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= W) continue;
      const i = py * W + px;
      if (!C[i]) C[i] = u(110 << 24); // 아무것도 없으면 검정 반투명
    }
  }
}

/** 4프레임 달리기 다리 동작. stance(서 있는 자세) 위에 덮어써요. */
const RUN = [
  { ffx: 9, fbx: -7, ffy: -4, fby: -6 },
  { ffx: 3, fbx: 1, ffy: -8, fby: -4, crouch: 1 },
  { ffx: -6, fbx: 9, ffy: -6, fby: -4 },
  { ffx: 1, fbx: 3, ffy: -4, fby: -8, crouch: 1 },
];
export function runPose(stance, time) {
  const f = Math.floor(time * 11) % 4;
  return { ...stance, lean: (stance.lean ?? 0) + 4, ...RUN[f], crouch: (stance.crouch ?? 0) + (RUN[f].crouch ?? 0) };
}
/** 숨쉬기: 1/3초마다 살짝 오르내려요. */
export function idlePose(stance, time) {
  const up = Math.floor(time * 3) & 1;
  return { ...stance, crouch: (stance.crouch ?? 0) + up };
}
/** 점프·낙하 자세. */
export function jumpPose(stance, vy) {
  return vy < 0
    ? { ...stance, crouch: 0, ffx: 6, ffy: -11, fbx: -3, fby: -7, lean: 2 }
    : { ...stance, crouch: 1, ffx: 5, ffy: -6, fbx: -5, fby: -9, lean: -1 };
}
