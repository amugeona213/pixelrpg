// 타이틀 화면과 캐릭터 만들기(이름 정하기) 화면. 주인공은 여자 견습 원정대원 한 명이에요.
// 고르는 메뉴(시작하기·이어하기, 이름 입력)는 ui.js 가 HTML 로 띄우고, 여기서는 배경과 캐릭터를 그려요.

import { input } from "../engine/input.js";
import { drawShadow } from "../engine/body.js";
import { drawSprite } from "../engine/sprite.js";
import { setLevel, drawBackground } from "./level.js";
import { heroFrame } from "./hero.js";
import { drawTitleText, drawCreateText } from "./hud.js";
import { GROUND_Y, SCALE, VIEW_W } from "../config.js";

const WIDE = { width: 100000, platforms: [], theme: "road" };

export class TitleScene {
  constructor() {
    this.t = 0;
    setLevel(WIDE);
  }
  update(dt) {
    this.t += dt;
  }
  draw(r) {
    // 숲길을 천천히 걸어가는 주인공
    const camX = this.t * 14;
    drawBackground(r.bg, camX, { theme: "road", platforms: false });
    r.begin(camX);
    const x = camX + VIEW_W / 2;
    drawShadow(r.frame, x, GROUND_Y, 8);
    drawSprite(r.frame, heroFrame("f", "walk", this.t), x, GROUND_Y);
    r.present();
    drawTitleText(r.ctx, this.t);
  }
}

// 캐릭터 만들기: 주인공 고화질 그림을 반투명 검은 판 위에 보여 주고, 이름을 정해요 (이름 입력은 ui.js)
const CARD = { x: 300, y: 140, w: 330, h: 470 }; // 큰 캔버스 기준
const ART = new Image();
ART.src = "assets/select/f.png";

export class CreateScene {
  constructor() {
    this.t = 0;
    setLevel({ ...WIDE, theme: "village" });
  }
  update(dt) {
    this.t += dt;
  }
  draw(r) {
    drawBackground(r.bg, 120, { theme: "village", platforms: false });
    r.begin(0);
    r.present();
    const ctx = r.ctx, { x, y, w, h } = CARD;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffd84a";
    ctx.stroke();
    if (ART.complete && ART.naturalWidth) {
      const k = Math.min((w - 40) / ART.naturalWidth, (h - 40) / ART.naturalHeight);
      const iw = ART.naturalWidth * k, ih = ART.naturalHeight * k, bob = Math.sin(this.t * 2) * 3;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 20, y + 20, w - 40, h - 40, 12);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ART, x + w / 2 - iw / 2, y + h - 20 - ih + bob, iw, ih);
      ctx.restore();
    }
    drawCreateText(ctx);
  }
}