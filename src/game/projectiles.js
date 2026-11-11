// 투사체: 화살, 마력탄, 화염구. pixelfx 의 반복 이펙트를 그리면서 위치만 옮겨요.

import { createFx } from "../engine/px.js";
import { WORLD_W } from "../config.js";

export class Projectile {
  constructor(owner, def, shot) {
    const p = def.projectile, dir = owner.facing;
    Object.assign(this, {
      p, dir, x: owner.x + dir * 16, y: owner.y + def.handY + (shot.dy ?? 0),
      traveled: 0, hit: new Set(), dead: false,
    });
    this.fx = createFx(p.fx, { ...p.opts, x: this.x, y: this.y, flip: dir < 0, seed: 1 + Math.floor(Math.random() * 999) });
  }

  update(dt, world) {
    this.fx.update(dt);
    const step = this.dir * this.p.speed * dt;
    this.x += step;
    this.traveled += Math.abs(step);
    for (const e of world.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      const b = e.box();
      if (this.x >= b.x0 - 3 && this.x <= b.x1 + 3 && this.y >= b.y0 - 3 && this.y <= b.y1 + 3) {
        this.hit.add(e);
        world.projectileHit(this, e);
        if (!this.p.pierce) {
          this.dead = true;
          return;
        }
      }
    }
    if (this.traveled > this.p.range || this.x < 0 || this.x > WORLD_W) {
      this.dead = true;
      world.projectileExpire(this);
    }
  }

  draw(frame) {
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y);
    this.fx.draw(frame);
  }
}
