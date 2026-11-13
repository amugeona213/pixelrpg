// 주인공: 이동, 점프, 칼 공격. 그림은 hero.js 의 픽셀 스프라이트, 공격의 타이밍·히트스톱·베기 이펙트는 pixelfx 의 sword-slash 동작을 써요.
// 태생 특성(profile.js bodyMods)이 속도·점프·체력·피해에 조금씩 영향을 줘요.

import { createAct, swordSlash } from "../engine/px.js";
import { input } from "../engine/input.js";
import { drawShadow } from "../engine/body.js";
import { drawSprite } from "../engine/sprite.js";
import { GROUND_Y, PLAYER_INVULN } from "../config.js";
import { moveBody, approach } from "./physics.js";
import { heroFrame } from "./hero.js";
import { bodyMods } from "./profile.js";
import { platformAt } from "./level.js";

export const BASE = { hp: 100, speed: 78, jump: 252 };

// 견습생의 낡은 검: 베기 (M2 에서 무기별 공격으로 바뀌어요)
export const OLD_SWORD = {
  name: "베기", mod: swordSlash, speed: 1.6, endT: 0.42, cooldown: 0.05,
  damage: 14, knock: 120, hitbox: { x0: -2, x1: 44, y0: -44, y1: 4 },
};

export class Player {
  constructor(profile, x) {
    const m = bodyMods(profile);
    Object.assign(this, {
      profile, mods: m, x, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true,
      maxHp: Math.round(BASE.hp * m.hp), speed: BASE.speed * m.speed, jumpV: BASE.jump * m.jump,
      invuln: 0, hurtT: 0, flash: 0, time: 0, action: null, cd: { attack: 0 }, dead: false, deadT: 0,
      locked: false, // 대화 중에는 못 움직여요
      landT: 0,      // 착지한 뒤 무릎 굽힌 모습을 보여 줄 시간
      coyote: 0,     // 발판 끝에서 떨어진 직후에도 점프할 수 있는 시간 (Celeste 처럼 0.1초)
      walkDist: 0,   // 걸은 거리 (걷기 그림을 거리로 넘겨서 발이 미끄러지지 않게)
    });
    // 맵을 옮겨도 체력은 이어져요 (쓰러졌다 일어나면 가득)
    this.hp = Math.max(1, Math.min(this.maxHp, profile.hp ?? this.maxHp));
  }

  get alive() { return !this.dead; }
  get frozen() { return !!this.action?.act.frozen; }
  get shake() { return this.action ? this.action.act.shake : [0, 0]; }
  box() { return { x0: this.x - 7, x1: this.x + 7, y0: this.y - 38, y1: this.y }; }
  get standingOn() { return this.onGround ? platformAt(this.x, this.y) : null; }

  update(dt, world) {
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cd.attack = Math.max(0, this.cd.attack - dt);

    if (this.dead) {
      this.deadT += dt;
      this.vx = approach(this.vx, 0, 400 * dt);
      moveBody(this, dt);
      return;
    }
    const ctl = !this.locked && this.hurtT <= 0;
    const want = ctl ? (input.held("right") ? 1 : 0) - (input.held("left") ? 1 : 0) : 0;
    if (this.action && this.onGround) this.vx = approach(this.vx, 0, 900 * dt);
    else {
      this.vx = approach(this.vx, want * this.speed, (this.onGround ? 900 : 520) * dt);
      if (want && !this.action) this.facing = want;
    }

    if (ctl && !this.action) {
      if (input.hit("jump") && (this.onGround || this.coyote > 0)) {
        this.vy = -this.jumpV;
        this.onGround = false;
        this.coyote = 0;
        world.count("jumps");
      }
      if (input.hit("attack") && this.cd.attack <= 0) this.attack(world);
    }
    // 점프 키를 일찍 떼면 낮게 뛰어요
    if (!this.onGround && this.vy < -60 && !input.held("jump")) this.vy += 900 * dt;

    const wasAir = !this.onGround;
    moveBody(this, dt);
    if (wasAir && this.onGround) this.landT = 0.1; // 착지: 잠깐 무릎을 굽혀요
    if (this.onGround) {
      this.coyote = 0.1;
      this.walkDist += Math.abs(this.vx) * dt;
    } else this.coyote = Math.max(0, this.coyote - dt);
    this.landT = Math.max(0, this.landT - dt);
    if (this.action) this.updateAction(dt);
  }

  attack(world) {
    const def = OLD_SWORD;
    this.cd.attack = def.cooldown;
    // 베기 궤적은 캐릭터보다 크게 (참고 자료처럼). 그림만 커지고 맞는 범위(hitbox)는 그대로예요
    const act = createAct(def.mod, { x: this.x, y: this.y, flip: this.facing < 0, radius: 52, seed: 1 + Math.floor(Math.random() * 999) });
    act.onHit = () => world.meleeHit(this, def);
    this.action = { def, act, speed: def.speed * this.mods.atkSpeed };
    world.count("swings");
  }

  updateAction(dt) {
    const a = this.action;
    a.act.fx.options.x = Math.round(this.x); // 이펙트가 캐릭터를 따라다녀요 (공중 공격)
    a.act.fx.options.y = Math.round(this.y);
    a.act.update(dt * a.speed);
    if (a.act.t >= a.def.endT && !a.act.frozen) this.action = null;
  }
  updateFrozen(dt) {
    this.action.act.update(dt * this.action.speed);
  }

  hurt(dmg, dir) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = PLAYER_INVULN;
    this.hurtT = 0.28;
    this.flash = 0.08;
    this.vx = dir * 130 * this.mods.knock;
    this.vy = -110;
    this.onGround = false;
    this.action = null; // 맞으면 공격이 끊겨요
    if (this.hp <= 0) this.dead = true;
    return true;
  }
  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  state() {
    if (this.dead) return "down";
    if (this.action) return "attack";
    if (this.hurtT > 0) return "hurt";
    if (!this.onGround) return "air";
    if (this.landT > 0 && Math.abs(this.vx) < 30) return "land";
    if (Math.abs(this.vx) > 12) return "walk";
    return "idle";
  }

  draw(frame) {
    if (this.onGround) drawShadow(frame, this.x, this.y, 8);
    const a = this.action, active = a && a.act.t >= 0;
    if (active) a.act.fx.draw(frame, "back");
    const spr = heroFrame(this.profile.gender, this.state(), this.time, this.vy, a ? a.act.t : 0, this.walkDist);
    drawSprite(frame, spr, this.x, this.y, {
      flip: this.facing < 0,
      flash: this.flash,
      blink: this.invuln > 0 && !this.dead && Math.floor(this.time * 20) % 2 === 0,
    });
    if (active) a.act.fx.draw(frame, "front");
  }
}
