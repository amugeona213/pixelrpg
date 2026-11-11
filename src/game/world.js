// 한 판의 게임: 플레이어, 적, 투사체, 이펙트, 웨이브, 카메라, 승패.

import { createFx, hitSpark, damageNumber, poof, heartPickup, collectBurst, torch, portal, PAL } from "../engine/px.js";
import { FxPool } from "../engine/fxpool.js";
import { VIEW_W, WORLD_W, GROUND_Y, HEART_DROP, HEART_HEAL } from "../config.js";
import { Player } from "./player.js";
import { makeEnemy } from "./enemies.js";
import { Projectile } from "./projectiles.js";
import { WAVES, TORCHES, PORTAL_X, drawBackground } from "./level.js";
import { overlap, clamp } from "./physics.js";

const rnd = () => 1 + Math.floor(Math.random() * 9999);

export class World {
  /** hint: 시작할 때 잠깐 보여줄 조작 안내 (기기마다 달라요) */
  constructor(cls, hint = "") {
    this.cls = cls;
    this.player = new Player(cls, 40);
    this.enemies = [];
    this.projectiles = [];
    this.hearts = [];
    this.fx = new FxPool();
    this.torches = TORCHES.map((x, i) => createFx(torch, { x, y: GROUND_Y - 6, seed: i + 3 }));
    this.portal = null;
    this.waveIndex = 0;
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.camX = 0;
    this.hitstop = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.banner = hint ? { text: hint, t: 4 } : null;
    this.state = "play"; // play | over | clear
    this.endT = 0;
  }

  get totalWaves() { return WAVES.length; }

  update(dt) {
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    // 공격이 맞는 순간: 세상 전체가 잠깐 멈춰요
    if (this.player.frozen) {
      this.player.updateFrozen(dt);
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.time += dt;
    const p = this.player;
    p.update(dt, this);

    while (this.waveIndex < WAVES.length && p.x >= WAVES[this.waveIndex].trigger) {
      const w = WAVES[this.waveIndex++];
      for (const s of w.enemies) this.enemies.push(makeEnemy(s));
      this.banner = { text: `웨이브 ${this.waveIndex}/${WAVES.length} · ${w.name}`, t: 2.4 };
    }

    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);

    for (const h of this.hearts) {
      h.fx.update(dt);
      if (!h.taken && p.alive && overlap(p.box(), { x0: h.x - 8, x1: h.x + 8, y0: h.y - 16, y1: h.y })) {
        h.taken = true;
        p.heal(HEART_HEAL);
        this.fx.spawn(collectBurst, { x: h.x, y: h.y, palette: PAL.blood, seed: rnd() });
      }
    }
    this.hearts = this.hearts.filter((h) => !h.taken);

    this.fx.update(dt);
    for (const t of this.torches) t.update(dt);
    if (this.portal) this.portal.update(dt);

    // 모든 웨이브를 깨면 포탈이 열려요
    if (!this.portal && this.waveIndex >= WAVES.length && this.enemies.length === 0) {
      this.portal = createFx(portal, { x: PORTAL_X, y: GROUND_Y, seed: 4 });
      this.banner = { text: "포탈이 열렸어요! 오른쪽 끝으로 가세요 →", t: 3.5 };
    }
    if (this.state === "play" && this.portal && p.alive && Math.abs(p.x - PORTAL_X) < 14) this.state = "clear";
    if (this.state === "play" && p.dead) {
      this.endT += dt;
      if (this.endT > 1.4) this.state = "over";
    }

    // 카메라: 바라보는 쪽을 조금 더 보여줘요
    const target = clamp(p.x - VIEW_W * 0.42 + p.facing * 24, 0, WORLD_W - VIEW_W);
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
  }

  // ---- 전투
  meleeHit(player, def) {
    const h = def.hitbox, f = player.facing;
    const box = {
      x0: f > 0 ? player.x + h.x0 : player.x - h.x1,
      x1: f > 0 ? player.x + h.x1 : player.x - h.x0,
      y0: player.y + h.y0,
      y1: player.y + h.y1,
    };
    for (const e of this.enemies) {
      if (e.dead || !overlap(box, e.box())) continue;
      const dir = def.hitbox.x0 < 0 ? Math.sign(e.x - player.x) || f : f; // 회전베기는 양옆으로 밀어내요
      this.damageEnemy(e, def.damage, dir, def.knock, def.hitPalette);
    }
  }

  fire(player, def) {
    for (const shot of def.shots) this.projectiles.push(new Projectile(player, def, shot));
  }

  projectileHit(pr, e) {
    const p = pr.p;
    this.damageEnemy(e, p.damage, pr.dir, 70, p.hitPalette);
    this.hitstop = Math.max(this.hitstop, 0.04);
    if (p.explode) this.explode(pr.x, pr.y, p.explode, e);
  }

  projectileExpire(pr) {
    if (pr.p.explode) this.explode(pr.x, pr.y, pr.p.explode, null);
  }

  explode(x, y, ex, already) {
    const gy = y > GROUND_Y - 30 ? GROUND_Y : y + 16;
    this.fx.spawn(ex.mod, { ...ex.opts, x: Math.round(x), y: Math.round(gy), seed: rnd() });
    this.addShake(0.35, 3);
    for (const e of this.enemies) {
      if (e.dead || e === already) continue;
      const [cx, cy] = e.center();
      if (Math.hypot(cx - x, cy - y) <= ex.radius) this.damageEnemy(e, ex.damage, Math.sign(cx - x) || 1, ex.knock);
    }
  }

  damageEnemy(e, dmg, dir, knock, palette) {
    e.hurt(dmg, dir, knock);
    const [cx, cy] = e.center();
    this.fx.spawn(hitSpark, { x: Math.round(cx - dir * 4), y: Math.round(cy + 10), height: 10, flip: dir < 0, seed: rnd(), ...(palette ? { palette } : {}) });
    this.fx.spawn(damageNumber, { x: Math.round(cx), y: Math.round(cy - 14), text: `-${dmg}`, seed: rnd() });
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.kills++;
      this.score += e.type === "bat" ? 80 : 100;
      this.fx.spawn(poof, { x: Math.round(e.x), y: Math.round(e.type === "bat" ? e.y + 10 : e.y), seed: rnd() });
      if (Math.random() < HEART_DROP) {
        const hx = Math.round(e.x);
        this.hearts.push({ x: hx, y: GROUND_Y, taken: false, fx: createFx(heartPickup, { x: hx, y: GROUND_Y, seed: rnd() }) });
      }
    }
  }

  damagePlayer(dmg, dir) {
    const p = this.player;
    if (!p.hurt(dmg, dir)) return;
    this.fx.spawn(damageNumber, { x: Math.round(p.x), y: Math.round(p.y - 46), text: `-${dmg}`, palette: PAL.ice, seed: rnd() });
    this.addShake(0.22, 2);
    if (p.dead) this.fx.spawn(poof, { x: Math.round(p.x), y: Math.round(p.y), seed: rnd() });
  }

  addShake(t, amp) {
    if (t >= this.shakeT) {
      this.shakeT = t;
      this.shakeAmp = amp;
    }
  }

  /** 지금 화면 흔들림 [x, y] (게임 픽셀). */
  shake() {
    const s = this.player.shake;
    if (this.shakeT <= 0) return s;
    const k = this.shakeAmp * Math.min(1, this.shakeT / 0.2), f = Math.floor(this.shakeT * 60);
    return [s[0] + Math.round(Math.sin(f * 2.4) * k), s[1] + Math.round(Math.cos(f * 3.7) * k * 0.7)];
  }

  // ---- 그리기 (뒤에서 앞으로)
  draw(r) {
    drawBackground(r.bg, this.camX);
    r.begin(this.camX);
    const F = r.frame;
    for (const t of this.torches) t.draw(F);
    if (this.portal) this.portal.draw(F);
    for (const h of this.hearts) h.fx.draw(F);
    this.fx.draw(F, "back");
    for (const e of this.enemies) e.draw(F, this);
    this.player.draw(F);
    for (const pr of this.projectiles) pr.draw(F);
    this.fx.draw(F, "front");
  }
}
