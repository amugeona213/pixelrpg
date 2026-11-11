// 플레이어: 이동, 점프, 기본 공격(J), 스킬(K). 공격 동작은 pixelfx 의 act 를 재생해요.

import { createAct } from "../engine/px.js";
import { input } from "../engine/input.js";
import { drawBody, drawShadow, runPose, idlePose, jumpPose } from "../engine/body.js";
import { GROUND_Y, PLAYER_INVULN } from "../config.js";
import { moveBody, approach } from "./physics.js";

/** 투사체를 쏘는 동작은 자세만 빌려 써요 (원래 이펙트의 화살·불덩이는 빼고, 게임이 직접 쏴요). */
function posesOnly(mod) {
  return { meta: mod.meta, act: { poses: mod.act.poses, hits: [] }, draw() {} };
}

export class Player {
  constructor(cls, x) {
    Object.assign(this, {
      cls, x, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true,
      hp: cls.hp, maxHp: cls.hp, invuln: 0, hurtT: 0, flash: 0, time: 0,
      action: null, cd: { attack: 0, skill: 0 }, dead: false, deadT: 0,
    });
  }

  get alive() { return !this.dead; }
  /** 공격이 맞는 순간 잠깐 멈춤(히트스톱) 중인지. 이때는 세상 전체가 멈춰요. */
  get frozen() { return !!this.action?.act.frozen; }
  get shake() { return this.action ? this.action.act.shake : [0, 0]; }
  box() { return { x0: this.x - 6, x1: this.x + 6, y0: this.y - 34, y1: this.y }; }

  update(dt, world) {
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cd.attack = Math.max(0, this.cd.attack - dt);
    this.cd.skill = Math.max(0, this.cd.skill - dt);

    if (this.dead) {
      this.deadT += dt;
      this.vx = approach(this.vx, 0, 400 * dt);
      moveBody(this, dt);
      return;
    }

    const want = this.hurtT > 0 ? 0 : (input.held("right") ? 1 : 0) - (input.held("left") ? 1 : 0);
    if (this.action && this.onGround) this.vx = approach(this.vx, 0, 900 * dt);
    else {
      this.vx = approach(this.vx, want * this.cls.speed, (this.onGround ? 900 : 520) * dt);
      if (want && !this.action) this.facing = want;
    }

    if (!this.action && this.hurtT <= 0) {
      if (input.hit("jump") && this.onGround) {
        this.vy = -this.cls.jump;
        this.onGround = false;
      }
      if (input.hit("attack") && this.cd.attack <= 0) this.start("attack", world);
      else if (input.hit("skill") && this.cd.skill <= 0) this.start("skill", world);
    }
    // 점프 키를 일찍 떼면 낮게 뛰어요
    if (!this.onGround && this.vy < -60 && !input.held("jump")) this.vy += 900 * dt;

    moveBody(this, dt);
    if (this.action) this.updateAction(dt, world);
  }

  start(slot, world) {
    const def = this.cls[slot];
    this.cd[slot] = def.cooldown;
    const mod = def.kind === "melee" ? def.mod : posesOnly(def.mod);
    const act = createAct(mod, { x: this.x, y: this.y, flip: this.facing < 0, seed: 1 + Math.floor(Math.random() * 999) });
    if (def.kind === "melee") act.onHit = () => world.meleeHit(this, def);
    this.action = { slot, def, act, released: false };
  }

  updateAction(dt, world) {
    const a = this.action;
    a.act.fx.options.x = Math.round(this.x); // 이펙트가 캐릭터를 따라다녀요 (공중 공격)
    a.act.fx.options.y = Math.round(this.y);
    a.act.update(dt * a.def.speed);
    if (a.def.kind === "cast" && !a.released && a.act.t >= a.def.releaseT) {
      a.released = true;
      world.fire(this, a.def);
    }
    if (a.act.t >= a.def.endT && !a.act.frozen) this.action = null;
  }

  /** 히트스톱 중에는 동작 시계만 돌려요 (멈춤 시간이 줄어들어요). */
  updateFrozen(dt) {
    this.action.act.update(dt * this.action.def.speed);
  }

  hurt(dmg, dir) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = PLAYER_INVULN;
    this.hurtT = 0.28;
    this.flash = 0.08;
    this.vx = dir * 130;
    this.vy = -110;
    this.onGround = false;
    this.action = null; // 맞으면 공격이 끊겨요
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  pose() {
    const s = this.cls.stance;
    if (this.dead) return { ...s, crouch: 9, lean: 9, fx: 14, fy: -8, bx: 6, by: -6, ffx: 8, fbx: -8 };
    if (this.action) return this.action.act.pose ?? s;
    if (this.hurtT > 0) return { ...s, lean: -6, crouch: 3, fx: 4, fy: -26 };
    if (!this.onGround) return jumpPose(s, this.vy);
    if (Math.abs(this.vx) > 12) return runPose(s, this.time);
    return idlePose(s, this.time);
  }

  draw(frame) {
    if (this.onGround) drawShadow(frame, this.x, this.y, 9);
    const a = this.action, active = a && a.act.t >= 0;
    if (active) a.act.fx.draw(frame, "back");
    drawBody(frame, this.pose(), this.x, this.y, {
      flip: this.facing < 0,
      tint: this.cls.tint,
      flash: this.flash,
      blink: this.invuln > 0 && !this.dead && Math.floor(this.time * 20) % 2 === 0,
    });
    if (active) a.act.fx.draw(frame, "front");
  }
}
