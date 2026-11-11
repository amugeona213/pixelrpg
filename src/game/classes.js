// 직업 데이터. 새 직업은 여기에 하나 더 추가하면 선택 화면과 게임에 바로 나와요.
//
// attack / skill 의 kind:
//   "melee" : pixelfx 의 동작(act)을 그대로 재생해요. 동작 안의 타격 시점(hits)에 hitbox 범위의 적이 맞아요.
//   "cast"  : 동작의 자세만 빌려 쓰고, releaseT(동작 시간) 에 투사체를 쏴요.
// speed: 동작 재생 배속 (클수록 빠름). endT: 이 동작 시간이 지나면 다시 움직일 수 있어요.
// cooldown: 재사용 대기시간 (초). hitbox: 캐릭터 발 기준, 앞쪽이 +x.

import { READY, PAL, swordSlash, spinSlash, arrowShot, fireballThrow, arrowFx, fireballFx, smallExplosion } from "../engine/px.js";
import { makeTint } from "../engine/body.js";

export const CLASSES = [
  {
    id: "warrior",
    name: "전사",
    desc: "튼튼한 근접 딜러. 검으로 베고 휘둘러요.",
    color: "#e8b04a",
    hp: 130,
    speed: 76,
    jump: 250,
    tint: makeTint({
      shell: ["#eef2f8", "#b4bfd0", "#7a879e", "#4a5470"],
      core: ["#a8323c", "#7a2230", "#4e1420", "#300c14"],
      mark: "#ffd84a",
    }),
    stance: { ...READY, weapon: "sword", fx: 11, fy: -15, sa: 0.38 },
    attack: {
      name: "베기", kind: "melee", mod: swordSlash, speed: 1.6, endT: 0.42, cooldown: 0.05,
      damage: 18, knock: 130, hitbox: { x0: -2, x1: 46, y0: -46, y1: 4 },
    },
    skill: {
      name: "회전베기", kind: "melee", mod: spinSlash, speed: 1.25, endT: 0.62, cooldown: 4,
      damage: 32, knock: 170, hitbox: { x0: -50, x1: 50, y0: -50, y1: 4 },
    },
  },
  {
    id: "mage",
    name: "마법사",
    desc: "마력탄으로 멀리서 공격하고, 화염구로 한꺼번에 날려요.",
    color: "#b88aff",
    hp: 85,
    speed: 70,
    jump: 245,
    tint: makeTint({
      shell: ["#eadcff", "#b68cec", "#7c52bc", "#4c2e84"],
      core: ["#3c2c70", "#2c1f56", "#1e143e", "#140e2c"],
      mark: "#62e0ff",
    }),
    stance: { ...READY, fx: 12, fy: -20, bx: 8, by: -19 },
    attack: {
      name: "마력탄", kind: "cast", mod: fireballThrow, speed: 2.6, releaseT: 0.95, endT: 1.12, cooldown: 0.05,
      shots: [{ dy: 0 }], handY: -22,
      // 보라색 작은 불덩이: 파이어볼 이펙트에 arcane 팔레트를 입혀요
      projectile: { fx: fireballFx, opts: { palette: PAL.arcane, radius: 3, speed: 90 }, speed: 230, range: 240, damage: 15, pierce: false, hitPalette: PAL.arcane },
    },
    skill: {
      name: "화염구", kind: "cast", mod: fireballThrow, speed: 1.6, releaseT: 0.95, endT: 1.2, cooldown: 5,
      shots: [{ dy: 0 }], handY: -22,
      projectile: {
        fx: fireballFx, opts: { radius: 6 }, speed: 170, range: 270, damage: 26, pierce: false,
        explode: { mod: smallExplosion, opts: { size: 0.55 }, radius: 46, damage: 24, knock: 190 },
      },
    },
  },
  {
    id: "archer",
    name: "궁수",
    desc: "빠르게 움직이며 화살을 쏴요. 스킬은 꿰뚫는 화살 세 발.",
    color: "#8fdc6a",
    hp: 100,
    speed: 86,
    jump: 262,
    tint: makeTint({
      shell: ["#e6f4cc", "#a8d070", "#6c9c42", "#406828"],
      core: ["#6e4c2c", "#523820", "#382616", "#26190e"],
      mark: "#ffcf5a",
    }),
    stance: { ...READY, weapon: "bow", sa: -0.4, fx: 12, fy: -20, bx: 6, by: -17 },
    attack: {
      name: "화살", kind: "cast", mod: arrowShot, speed: 2.8, releaseT: 0.56, endT: 0.72, cooldown: 0.05,
      shots: [{ dy: 0 }], handY: -28,
      projectile: { fx: arrowFx, opts: {}, speed: 340, range: 300, damage: 13, pierce: false },
    },
    skill: {
      name: "관통 화살", kind: "cast", mod: arrowShot, speed: 1.9, releaseT: 0.56, endT: 0.8, cooldown: 4,
      shots: [{ dy: -8 }, { dy: 0 }, { dy: 8 }], handY: -28,
      projectile: { fx: arrowFx, opts: { palette: PAL.gold }, speed: 380, range: 340, damage: 22, pierce: true, hitPalette: PAL.gold },
    },
  },
];

export const classById = (id) => CLASSES.find((c) => c.id === id) ?? CLASSES[0];
