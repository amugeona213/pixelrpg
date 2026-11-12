// 캐릭터 정보: 성별, 이름, 보이지 않는 고유번호, 태생 특성, 돈, 진행 상황. 브라우저에 저장해요.
//
// 고유번호(id): 캐릭터를 만들 때 한 번 정해지고 화면에는 절대 안 나와요.
// 태생 특성은 고유번호로 정해져요 (같은 번호 = 항상 같은 특성). 특성마다 3%, 최대 2개, 중복 없음.
// 특성 이름도 화면에 안 나와요. NPC 대사나 플레이 감각으로만 짐작할 수 있어요.

/** 태생 특성 표. 새 특성은 여기에 한 줄 추가하면 돼요. 효과 수치는 docs/기획서.md 와 같아요. */
export const TRAITS = [
  { id: "mana", name: "마나의 축복" },     // 처음부터 마나 개방, 마나 최대치·회복 +20%
  { id: "swiftLegs", name: "재빠른 다리" }, // 이동 속도 +10%, 민첩 1.5배
  { id: "swiftArms", name: "재빠른 팔" },   // 공격 속도 +12%, 솜씨 1.5배
  { id: "strongLegs", name: "강한 다리" },  // 점프 +12%, 밀려나는 거리 절반
  { id: "strongArms", name: "강한 팔" },    // 근접 피해 +12%, 힘 1.5배
  { id: "genius", name: "천재" },           // 스킬 반복 횟수 -30%, 능력치 1.1배
  { id: "hunter", name: "사냥꾼" },         // 활 피해 +10%, 전리품 +30%, 15% 화살 안 줄어듦
  { id: "merchant", name: "상인" },         // 살 때 -15%, 팔 때 +15%, 돈 +10%
  { id: "tough", name: "강인한 몸" },       // 최대 체력 +15%, 밤샘 페널티 절반
  { id: "expert", name: "전문가" },         // 가장 많이 쓴 무기 능력치 2배, 나머지 0.8배
  { id: "weakSpot", name: "약점 탐지" },    // 치명타 +10%
];
export const TRAIT_CHANCE = 0.03;
export const MAX_TRAITS = 2;

// 고유번호 → 0~1 사이 수 (같은 입력이면 항상 같은 값)
function hash01(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 고유번호로 태생 특성 id 목록을 정해요. */
export function traitsOf(id) {
  const got = TRAITS.filter((t, i) => hash01(id, i + 1) < TRAIT_CHANCE).map((t) => t.id);
  // 3개 이상 뽑히면 무작위(이것도 고유번호로 정해짐)로 2개만 남겨요
  got.sort((a, b) => hash01(id, a.length * 31 + a.charCodeAt(0)) - hash01(id, b.length * 31 + b.charCodeAt(0)));
  return got.slice(0, MAX_TRAITS);
}

function newId() {
  const a = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a);
  else a[0] = Math.floor(Math.random() * 4294967296);
  return a[0] || 1;
}

/** 새 캐릭터 */
export function createProfile(gender, name) {
  const id = newId();
  return {
    v: 1,
    id,
    gender, // "m" | "f"
    name,
    traits: traitsOf(id),
    gold: 0,
    map: "village",
    tutorial: 0,   // 튜토리얼 단계 (끝나면 99)
    knows: { elder: true }, // NPC 별로 주인공 이름을 아는지. 고향 촌장님은 처음부터 알아요
    flags: {},     // 이야기 진행 표시
    weapon: null,  // 왕이 준 첫 무기: "sword" | "bow" | "staff"
    arrows: 0,
    manaOpen: false,
    stats: { kills: 0, deaths: 0, swings: 0, jumps: 0 }, // 반복 행동 횟수 (M2 에서 스킬·능력치에 써요)
    created: Date.now(),
  };
}

export const hasTrait = (p, id) => p.traits.includes(id);
/** 마나 개방: 태생 "마나의 축복" 이거나 마탑 수련을 통과했으면 */
export const manaOpen = (p) => p.manaOpen || hasTrait(p, "mana");

// ---- 특성이 몸에 주는 효과 (지금 버전에서 쓰는 것만)
export function bodyMods(p) {
  const t = (id) => hasTrait(p, id);
  return {
    hp: t("tough") ? 1.15 : 1,
    speed: t("swiftLegs") ? 1.1 : 1,
    jump: t("strongLegs") ? 1.12 : 1,
    knock: t("strongLegs") ? 0.5 : 1,
    melee: t("strongArms") ? 1.12 : 1,
    atkSpeed: t("swiftArms") ? 1.12 : 1,
    crit: t("weakSpot") ? 0.15 : 0.05,
    gold: t("merchant") ? 1.1 : 1,
  };
}

// ---- 저장 (이 브라우저에만. 시크릿 창 등에서는 저장이 안 될 수 있어요)
const KEY = "pixelrpg.save.v1";
export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!p || p.v !== 1 || typeof p.id !== "number") return null;
    p.traits = traitsOf(p.id); // 특성은 항상 고유번호에서 다시 계산 (저장 파일을 고쳐도 안 바뀌게)
    p.gender = "f"; // 주인공은 여자 한 명 (예전 남자 저장 파일도 여자로)
    return p;
  } catch {
    return null;
  }
}
export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// ---- 한국어 조사: 이름 끝 글자에 받침이 있는지 보고 이/가, 은/는, 을/를, 아/야 ...
export function josa(word, pair) {
  const [a, b] = pair.split("/"); // a: 받침 있을 때, b: 없을 때
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return word + b;
  const jong = (ch - 0xac00) % 28;
  if (pair === "으로/로" && jong === 8) return word + b; // ㄹ 받침은 "로"
  return word + (jong ? a : b);
}
