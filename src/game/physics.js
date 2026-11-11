// 공통 물리: 중력, 이동, 땅·발판 착지. 플레이어와 땅 위의 적이 같이 써요.

import { GRAVITY, MAX_FALL, WORLD_W } from "../config.js";
import { landingY, supportAt } from "./level.js";

export const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** e: { x, y, vx, vy, onGround }. 발 위치 기준. */
export function moveBody(e, dt) {
  if (e.onGround && !supportAt(e.x, e.y)) e.onGround = false; // 발판 끝에서 떨어져요
  if (!e.onGround) e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
  const prevY = e.y;
  e.x = clamp(e.x + e.vx * dt, 8, WORLD_W - 8);
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
