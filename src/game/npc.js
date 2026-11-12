// NPC(말을 거는 사람들)와 조사할 수 있는 물건(표지판). 대화 내용은 story.js 에 있어요.
// NPC 몸은 pixelfx 뼈대 캐릭터에 옷 색(tint)을 입혀서 그려요.

import { READY } from "../engine/px.js";
import { drawBody, drawShadow, makeTint, idlePose } from "../engine/body.js";
import { Sheet, palette, drawSprite } from "../engine/sprite.js";

export const NPC_KINDS = {
  elder: {
    name: "촌장",
    tint: makeTint({ shell: ["#e8dcc0", "#b8a07a", "#86704e", "#56462e"], core: ["#5e7a4a", "#465e36", "#30422a", "#20301c"], mark: "#e2b352" }),
    stance: { ...READY, crouch: 5, lean: 3, fx: 10, fy: -18, bx: 6, by: -18 },
  },
  guard: {
    name: "경비병",
    tint: makeTint({ shell: ["#dfe4ee", "#a8b0c2", "#727c94", "#454d64"], core: ["#3c5fbf", "#2c4a98", "#1e3470", "#14224c"], mark: "#e2b352" }),
    stance: { ...READY, weapon: "spear", fx: 9, fy: -20, sa: -1.45, bx: 7, by: -20 },
  },
  maid: {
    name: "시녀",
    tint: makeTint({ shell: ["#f2eef6", "#c6bcd4", "#968aa8", "#665a7a"], core: ["#3a3550", "#2a2640", "#1c1a2e", "#121020"], mark: "#ec9c8e" }),
    stance: { ...READY, fx: 6, fy: -18, bx: 4, by: -18 },
  },
  king: {
    name: "국왕",
    tint: makeTint({ shell: ["#fff0c0", "#e8c060", "#b88a2c", "#7a5618"], core: ["#b02a3a", "#86202e", "#5a1420", "#3a0c14"], mark: "#62e0ff" }),
    stance: { ...READY, crouch: 1, fx: 10, fy: -22, bx: 8, by: -22 },
    crown: true,
  },
};

const PROP_PAL = palette({ k: "#1d1726", W: "#a8743f", w: "#7a5028", d: "#553519", t: "#e8d8b0", G: "#e2b352", g: "#b8862c", R: "#c4303c" });
const SIGN = [
  "kkkkkkkkkkkkkk",
  "kWWWWWWWWWWWWk",
  "kWttttwttttWWk",
  "kWWWWWWWWWWWWk",
  "kWtttwtttttWWk",
  "kwwwwwwwwwwwwk",
  "kkkkkkkkkkkkkk",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  ".....kwdk.....",
  "....kkwdkk....",
]; // 기둥이 길어서 주인공(키 약 38) 어깨 높이에 판이 와요
const CROWN = ["k.k.k.k", "kGkGkGk", "kGGRGGk", "kgggggk", ".kkkkk."];

function sheetOf(rows, ax, ay) {
  const w = Math.max(...rows.map((r) => r.length)), s = new Sheet(w, rows.length, ax ?? Math.floor(w / 2), ay ?? rows.length);
  s.art(rows, PROP_PAL, 0, 0);
  return s;
}
const SIGN_S = sheetOf(SIGN);
const CROWN_S = sheetOf(CROWN, 3, 5);

export class Npc {
  constructor(def, y) {
    Object.assign(this, { ...def, y, t: Math.random() * 5 });
    this.k = NPC_KINDS[def.kind];
    this.name = this.k.name;
  }
  update(dt, player) {
    this.t += dt;
    // 주인공이 가까이 오면 그쪽을 봐요
    if (Math.abs(player.x - this.x) < 70) this.face = Math.sign(player.x - this.x) || this.face;
  }
  draw(frame) {
    drawShadow(frame, this.x, this.y, 9);
    drawBody(frame, idlePose(this.k.stance, this.t), this.x, this.y, { flip: this.face < 0, tint: this.k.tint });
    if (this.k.crown) drawSprite(frame, CROWN_S, this.x + (this.face < 0 ? 1 : -1), this.y - 37 + (Math.floor(this.t * 3) & 1), { flip: this.face < 0 });
  }
}

export class Prop {
  constructor(def, y) {
    Object.assign(this, { ...def, y });
    this.name = def.kind === "sign" ? "표지판" : "물건";
  }
  update() {}
  draw(frame) {
    drawSprite(frame, SIGN_S, this.x, this.y);
  }
}
