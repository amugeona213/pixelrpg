// 공통 물리: 중력, 이동, 땅·발판 착지. 플레이어와 땅 위의 적이 같이 써요.
// 발판은 위에서만 밟아요. kind: "crate"(나무 상자)는 옆으로 통과할 수 없는 단단한 상자예요.

import { GRAVITY, MAX_FALL } from "../config.js";
import { level, landingY, supportAt } from "./level.js";

export const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** e: { x, y, vx, vy, onGround }. 발 위치 기준. hw: 몸 반 폭 (상자에 막힐 때). */
export function moveBody(e, dt, hw = 5) {
  if (e.onGround && !supportAt(e.x, e.y)) e.onGround = false; // 발판 끝에서 떨어져요
  if (!e.onGround) e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
  const prevY = e.y;
  let nx = clamp(e.x + e.vx * dt, (e.minX ?? 8), level.width - 8);
  // 단단한 상자: 윗면보다 낮으면 옆으로 못 지나가요
  for (const p of level.platforms) {
    if (p.kind !== "crate" || e.y <= p.y + 1) continue;
    if (nx + hw > p.x && nx - hw < p.x + p.w) {
      nx = e.x <= p.x + p.w / 2 ? p.x - hw : p.x + p.w + hw;
      e.vx = 0;
    }
  }
  e.x = nx;
  e.y += e.vy * dt;
  if (e.vy >= 0) {
    const ly = landingY(e.x, prevY, e.y);
    if (e.y >= ly) {
      e.y = ly;
      e.vy = 0;
      e.onGround = true;
    } else e.onGround = false;
  }
}

/** 두 사각형 { x0, x1, y0, y1 } 이 겹치는지. */
export const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
