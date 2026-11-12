// 맵 데이터. 맵은 한 줄로 이어져요: 오른쪽 끝으로 가면 next, 왼쪽 끝으로 가면 prev 맵.
//   platforms: 발판 (kind "crate" 는 옆으로 못 지나가는 나무 상자)
//   enemies:   { type, x, y? }  (맵에 들어올 때마다 다시 나와요)
//   npcs:      { id, kind, x, face }  대화는 story.js 의 같은 id
//   props:     { id, kind: "sign", x }  조사하면 story.js 의 같은 id
//   torches:   횃불 x 위치
//   gate:      오른쪽 끝을 막는 조건 (아직 못 가면 안내 문구)

export const MAPS = {
  village: {
    name: "도토리 마을 끝",
    theme: "village",
    width: 1080,
    prev: null,
    next: "road",
    tutorial: true,
    platforms: [{ x: 330, y: 126, w: 26, kind: "crate" }],
    enemies: [{ type: "scarecrow", x: 480 }],
    props: [{ id: "signVillage", kind: "sign", x: 620 }],
    npcs: [{ id: "elder", kind: "elder", x: 840, face: -1 }],
    torches: [180, 760, 1020],
  },
  road: {
    name: "왕국 가는 길",
    theme: "road",
    width: 2600,
    prev: "village",
    next: "castle",
    platforms: [
      { x: 520, y: 112, w: 64 },
      { x: 880, y: 104, w: 80 },
      { x: 1040, y: 78, w: 56 },
      { x: 1500, y: 110, w: 72 },
      { x: 1880, y: 100, w: 90 },
      { x: 2200, y: 126, w: 26, kind: "crate" },
    ],
    enemies: [
      { type: "slime", x: 380 },
      { type: "goblin", x: 640 },
      { type: "slime", x: 820 },
      { type: "goblin", x: 1120 },
      { type: "goblin", x: 1180 },
      { type: "slime", x: 1400 },
      { type: "goblin", x: 1650 },
      { type: "slime", x: 1720 },
      { type: "goblin", x: 2040 },
      { type: "goblin", x: 2090 },
      { type: "slime", x: 2320 },
    ],
    props: [{ id: "signRoad", kind: "sign", x: 120 }, { id: "signCastle", kind: "sign", x: 2480 }],
    npcs: [],
    torches: [300, 760, 1300, 1820, 2380],
  },
  castle: {
    name: "루멘 왕성",
    theme: "castle",
    width: 1040,
    prev: "road",
    next: null,
    platforms: [],
    enemies: [],
    props: [],
    npcs: [
      { id: "guard", kind: "guard", x: 170, face: -1 },
      { id: "maid", kind: "maid", x: 470, face: 1 },
      { id: "guard2", kind: "guard", x: 760, face: -1 },
      { id: "king", kind: "king", x: 930, face: -1 },
    ],
    torches: [90, 330, 610, 860, 1000],
    gate: "아직 원정 준비 중이에요. (다음 업데이트에서 안개 숲으로 가는 길이 열려요)",
  },
};

export const mapById = (id) => MAPS[id] ?? MAPS.village;
