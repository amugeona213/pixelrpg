// 적: 고블린·그림자 병사(땅, 단검으로 찌름), 슬라임(통통 튀며 몸통 박치기), 박쥐(공중), 허수아비(연습용).
// 모든 적은 { type, x, y, hp, maxHp, dead, box(), center(), update(dt, world), draw(frame, world), hurt(dmg, dir, knock) } 를 가져요.

import { READY, poseAt, createFx, batFx, slimeFx } from "../engine/px.js";
import { Sheet, palette, drawSprite } from "../engine/sprite.js";
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

// 고블린: 그림자 병사와 같은 몸놀림, 초록 피부에 누더기 옷, 더 약해요
const GOBLIN_TINT = makeTint({
  shell: ["#b8e07a", "#84b84e", "#5a8a34", "#3a5e22"],
  core: ["#8a5a35", "#623f22", "#432a16", "#2c1c0e"],
  mark: "#ffd84a",
  ink: "#10140a",
});
const KINDS = {
  soldier: { hp: 45, speed: 36, damage: 10, tint: SOLDIER_TINT, gold: [4, 8], sight: 230 },
  goblin: { hp: 30, speed: 40, damage: 7, tint: GOBLIN_TINT, gold: [3, 6], sight: 190 },
};

export class Soldier {
  constructor(x, y = GROUND_Y, type = "soldier") {
    const k = KINDS[type];
    Object.assign(this, {
      type, x, y, vx: 0, vy: 0, onGround: true, facing: -1,
      hp: k.hp, maxHp: k.hp, speed: k.speed, damage: k.damage, tint: k.tint, gold: k.gold, sight: k.sight,
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
    } else if (p.alive && Math.abs(dx) < this.sight) {
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
    drawBody(frame, this.pose(), this.x, this.y, { flip: this.facing < 0, tint: this.tint, flash: this.flash });
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
      type: "bat", x, y, vx: 0, hp: 24, maxHp: 24, damage: 8, speed: 46, gold: [2, 4],
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

// 슬라임: 통통 튀며 다가와요. 몸에 닿으면 아파요. pixelfx 의 slime(제자리 뛰기)을 그리면서,
// 공중에 떠 있는 순간에만 앞으로 움직여요.
const SLIME_LOOP = 1.8, SLIME_LIFT = 0.9, SLIME_LAND = 1.44;
export class Slime {
  constructor(x, y = GROUND_Y) {
    const seed = 1 + Math.floor(Math.random() * 99);
    Object.assign(this, {
      type: "slime", x, y, vx: 0, hp: 22, maxHp: 22, damage: 5, gold: [1, 3], facing: -1,
      touchCd: 0, flash: 0, hurtT: 0, dead: false, sight: 170,
      fx: createFx(slimeFx, { x, y, seed, hop: 16 }),
    });
    this.fx.update(Math.random() * SLIME_LOOP); // 다 같이 뛰지 않게
  }
  box() { return { x0: this.x - 11, x1: this.x + 11, y0: this.y - 16, y1: this.y }; }
  center() { return [this.x, this.y - 8]; }

  update(dt, world) {
    this.fx.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.touchCd = Math.max(0, this.touchCd - dt);
    const p = world.player, dx = p.x - this.x, ph = this.fx.t % SLIME_LOOP;
    if (this.hurtT > 0) this.vx *= 0.9;
    else if (p.alive && Math.abs(dx) < this.sight) {
      this.facing = Math.sign(dx) || this.facing;
      this.vx = ph > SLIME_LIFT && ph < SLIME_LAND ? this.facing * 52 : 0;
    } else this.vx = 0;
    this.x = clamp(this.x + this.vx * dt, 12, world.width - 12);
    if (p.alive && this.touchCd <= 0 && overlap(this.box(), p.box())) {
      this.touchCd = 1;
      world.damagePlayer(this.damage, Math.sign(dx) || 1);
    }
  }
  draw(frame) {
    if (this.flash > 0 && Math.floor(this.flash * 60) % 2 === 0) return;
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y);
    this.fx.draw(frame);
  }
  hurt(dmg, dir, knock) {
    this.hp -= dmg;
    this.flash = 0.12;
    this.hurtT = 0.22;
    this.vx = dir * knock * 0.7;
  }
}

// 허수아비: 튜토리얼에서 때려 보는 연습 상대. 쓰러지지 않고, 맞으면 흔들려요.
const STRAW = palette({ k: "#1d1726", y: "#e2c070", Y: "#b8923c", b: "#7a5028", B: "#553519", c: "#c4303c", s: "#f0e0b0", e: "#1d1726" });
const SCARECROW = [
  "....kkkkk....",
  "...kyyyyyk...",
  "..kyYyyyYyk..",
  "kkkkkkkkkkkkk",
  "...kssssk....",
  "...ksekesk...",
  "...kssssk....",
  "....kkkk.....",
  "kkkkkbBkkkkkk",
  "kcccccccccccck",
  "kkcccbBcccckk",
  "...kcbBck....",
  "...kcbBck....",
  "...kyyyyk....",
  "...kyYyYk....",
  "....kbBk.....",
  "....kbBk.....",
  "....kbBk.....",
  "....kbBk.....",
  "....kbBk.....",
  "....kbBk.....",
  "...kkbBkk....",
];
const SCARE_S = (() => {
  const w = Math.max(...SCARECROW.map((r) => r.length)), s = new Sheet(w, SCARECROW.length, 6, SCARECROW.length);
  s.art(SCARECROW, STRAW, 0, 0);
  return s;
})();
export class Scarecrow {
  constructor(x, y = GROUND_Y) {
    Object.assign(this, { type: "scarecrow", x, y, hp: 9999, maxHp: 9999, gold: [0, 0], hits: 0, wob: 0, flash: 0, dead: false, dummy: true });
  }
  box() { return { x0: this.x - 7, x1: this.x + 7, y0: this.y - 22, y1: this.y }; }
  center() { return [this.x, this.y - 12]; }
  update(dt) {
    this.wob = Math.max(0, this.wob - dt);
    this.flash = Math.max(0, this.flash - dt);
  }
  draw(frame) {
    const sway = this.wob > 0 ? Math.round(Math.sin(this.wob * 40) * 2) : 0;
    drawSprite(frame, SCARE_S, this.x + sway, this.y, { flash: this.flash });
  }
  hurt() {
    this.hits++;
    this.wob = 0.35;
    this.flash = 0.06;
  }
}

export function makeEnemy(spec) {
  if (spec.type === "bat") return new Bat(spec.x, spec.y);
  if (spec.type === "slime") return new Slime(spec.x);
  if (spec.type === "scarecrow") return new Scarecrow(spec.x);
  return new Soldier(spec.x, spec.y, spec.type);
}
