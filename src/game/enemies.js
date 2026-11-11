// 적: 그림자 병사(땅, 단검으로 찌름), 박쥐(공중, 몸통 박치기).
// 모든 적은 { type, x, y, hp, maxHp, dead, box(), center(), update(dt, world), draw(frame, world), hurt(dmg, dir, knock) } 를 가져요.

import { READY, poseAt, createFx, batFx } from "../engine/px.js";
import { drawBody, drawShadow, makeTint, runPose, idlePose } from "../engine/body.js";
import { GROUND_Y } from "../config.js";
import { moveBody, approach, clamp, overlap } from "./physics.js";

const SOLDIER_TINT = makeTint({
  shell: ["#a497bc", "#6e6388", "#4a4062", "#2e2742"],
  core: ["#6a1e30", "#4a1422", "#300c16", "#1e080e"],
  mark: "#ff3b30",
  ink: "#07050c",
});
const S_STANCE = { ...READY, weapon: "dagger", fx: 12, fy: -17, sa: 0.25 };
const S_WIND = { ...S_STANCE, crouch: 4, lean: -4, fx: 1, fy: -29, sa: -1.5, ffx: 5, fbx: -8 };
const S_STRIKE = { ...S_STANCE, x: 5, crouch: 3, lean: 7, fx: 20, fy: -20, sa: 0.3, ffx: 12, fbx: -9 };
const S_TRACK = [[0, S_STANCE], [0.32, S_WIND], [0.42, S_STRIKE, "snap"], [0.62, S_STRIKE], [0.85, S_STANCE]];
const STRIKE_T = 0.42, ATTACK_END = 0.85;

export class Soldier {
  constructor(x, y = GROUND_Y) {
    Object.assign(this, {
      type: "soldier", x, y, vx: 0, vy: 0, onGround: true, facing: -1,
      hp: 45, maxHp: 45, speed: 36, damage: 10,
      state: "walk", t: 0, struck: false, cd: 0.8 + Math.random() * 0.6,
      flash: 0, hurtT: 0, dead: false, time: Math.random() * 10,
    });
  }
  box() { return { x0: this.x - 7, x1: this.x + 7, y0: this.y - 36, y1: this.y }; }
  center() { return [this.x, this.y - 18]; }

  update(dt, world) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.cd -= dt;
    const p = world.player, dx = p.x - this.x, near = Math.abs(p.y - this.y) < 30;

    if (this.hurtT > 0) this.vx = approach(this.vx, 0, 500 * dt);
    else if (this.state === "attack") {
      this.t += dt;
      this.vx = approach(this.vx, 0, 600 * dt);
      if (!this.struck && this.t >= STRIKE_T) {
        this.struck = true;
        if (p.alive && Math.sign(dx) === this.facing && Math.abs(dx) < 32 && near) world.damagePlayer(this.damage, this.facing);
      }
      if (this.t >= ATTACK_END) {
        this.state = "walk";
        this.cd = 1 + Math.random() * 0.7;
      }
    } else if (p.alive && Math.abs(dx) < 230) {
      this.facing = Math.sign(dx) || this.facing;
      if (Math.abs(dx) > 22) this.vx = approach(this.vx, this.facing * this.speed, 300 * dt);
      else {
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.cd <= 0 && near) {
          this.state = "attack";
          this.t = 0;
          this.struck = false;
        }
      }
    } else this.vx = approach(this.vx, 0, 300 * dt);

    moveBody(this, dt);
  }

  pose() {
    if (this.state === "attack") return poseAt(S_TRACK, this.t);
    if (this.hurtT > 0) return { ...S_STANCE, lean: -7, crouch: 3, fx: 5, fy: -24 };
    if (Math.abs(this.vx) > 6) return runPose(S_STANCE, this.time * 0.8);
    return idlePose(S_STANCE, this.time);
  }

  draw(frame) {
    if (this.onGround) drawShadow(frame, this.x, this.y, 9);
    drawBody(frame, this.pose(), this.x, this.y, { flip: this.facing < 0, tint: SOLDIER_TINT, flash: this.flash });
  }

  hurt(dmg, dir, knock) {
    this.hp -= dmg;
    this.flash = 0.09;
    this.hurtT = 0.25;
    this.vx = dir * knock;
    this.vy = -70;
    this.onGround = false;
    this.facing = -dir || this.facing;
    if (this.state === "attack" && !this.struck) this.state = "walk"; // 찌르기 전에 맞으면 끊겨요
  }
}

export class Bat {
  constructor(x, y = 70) {
    Object.assign(this, {
      type: "bat", x, y, vx: 0, hp: 24, maxHp: 24, damage: 8, speed: 46,
      t: Math.random() * 10, touchCd: 0, flash: 0, hurtT: 0, dead: false,
      fx: createFx(batFx, { x, y, seed: 1 + Math.floor(Math.random() * 99) }),
    });
  }
  box() { return { x0: this.x - 9, x1: this.x + 9, y0: this.y - 8, y1: this.y + 8 }; }
  center() { return [this.x, this.y]; }

  update(dt, world) {
    this.t += dt;
    this.fx.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.touchCd = Math.max(0, this.touchCd - dt);
    const p = world.player;
    if (this.hurtT > 0) {
      this.x += this.vx * dt;
      this.vx *= 0.9;
    } else if (p.alive) {
      const tx = p.x, ty = p.y - 26 + Math.sin(this.t * 1.7) * 12;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      if (d > 1) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt + Math.sin(this.t * 6) * 14 * dt;
      }
    }
    this.y = clamp(this.y, 18, GROUND_Y - 14);
    if (p.alive && this.touchCd <= 0 && overlap(this.box(), p.box())) {
      this.touchCd = 1;
      world.damagePlayer(this.damage, Math.sign(p.x - this.x) || 1);
    }
  }

  draw(frame) {
    if (this.flash > 0 && Math.floor(this.flash * 60) % 2 === 0) return; // 맞으면 깜빡여요
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y);
    this.fx.draw(frame);
  }

  hurt(dmg, dir, knock) {
    this.hp -= dmg;
    this.flash = 0.12;
    this.hurtT = 0.2;
    this.vx = dir * knock * 0.8;
  }
}

export function makeEnemy(spec) {
  return spec.type === "bat" ? new Bat(spec.x, spec.y) : new Soldier(spec.x, spec.y);
}
