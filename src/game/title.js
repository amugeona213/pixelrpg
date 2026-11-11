// 직업 선택 화면: 세 직업이 서 있고, 고른 직업은 기본 공격을 시범으로 보여줘요.

import { createAct } from "../engine/px.js";
import { input } from "../engine/input.js";
import { drawBody, drawShadow, idlePose } from "../engine/body.js";
import { drawBackground } from "./level.js";
import { drawTitleHud } from "./hud.js";
import { CLASSES } from "./classes.js";
import { GROUND_Y, SCALE } from "../config.js";

const XS = [80, 160, 240]; // 게임 픽셀 기준 가로 위치

export class Title {
  constructor(sel = 0) {
    this.sel = sel;
    this.time = 0;
    this.demo = null;
    this.demoWait = 0.6;
  }

  /** 화면을 눌러 고를 때: 큰 캔버스 좌표(1280x720)의 (x, y) 에 있는 직업 번호, 없으면 -1. */
  pick(x, y) {
    if (y < 340 || y > 620) return -1;
    return XS.findIndex((cx) => Math.abs(x - cx * SCALE) < 128);
  }
  select(i) {
    if (i === this.sel || i < 0) return;
    this.sel = i;
    this.demo = null;
    this.demoWait = 0.35;
  }

  /** 시작하면 고른 직업을 돌려줘요. */
  update(dt) {
    this.time += dt;
    const before = this.sel;
    if (input.hit("left")) this.sel = (this.sel + CLASSES.length - 1) % CLASSES.length;
    if (input.hit("right")) this.sel = (this.sel + 1) % CLASSES.length;
    if (input.hit("one")) this.sel = 0;
    if (input.hit("two")) this.sel = 1;
    if (input.hit("three")) this.sel = 2;
    if (this.sel !== before) {
      this.demo = null;
      this.demoWait = 0.35;
    }
    if (input.hit("confirm")) return CLASSES[this.sel];

    if (this.demo) {
      this.demo.act.update(dt * this.demo.speed);
      if (this.demo.act.t >= this.demo.end) {
        this.demo = null;
        this.demoWait = 1.1;
      }
    } else if ((this.demoWait -= dt) <= 0) {
      const c = CLASSES[this.sel], d = c.attack;
      const mod = d.kind === "melee" ? d.mod : { meta: d.mod.meta, act: { poses: d.mod.act.poses, hits: [] }, draw() {} };
      this.demo = { act: createAct(mod, { x: XS[this.sel], y: GROUND_Y, seed: 3 }), speed: d.speed * 0.8, end: d.endT + 0.2 };
    }
    return null;
  }

  draw(r, mode) {
    const camX = (this.time * 12) % 600;
    drawBackground(r.bg, camX, { platforms: false });
    r.begin(0);
    CLASSES.forEach((c, i) => {
      const demo = i === this.sel ? this.demo : null;
      drawShadow(r.frame, XS[i], GROUND_Y, 9);
      if (demo && demo.act.t >= 0) demo.act.fx.draw(r.frame, "back");
      const pose = demo ? demo.act.pose : idlePose(c.stance, this.time + i * 0.4);
      drawBody(r.frame, pose, XS[i], GROUND_Y, { tint: c.tint });
      if (demo && demo.act.t >= 0) demo.act.fx.draw(r.frame, "front");
    });
    r.present();
    drawTitleHud(r.ctx, CLASSES, this.sel, XS.map((x) => x * SCALE), mode);
  }
}
