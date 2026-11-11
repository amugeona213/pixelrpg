// 입력: 키보드 · 터치 버튼 · 게임패드를 모두 같은 "동작 이름"으로 받아요.
//   input.held("left")  누르고 있는 중
//   input.hit("jump")   이번 프레임에 막 누름
// 터치 버튼은 input.press / release / tap 으로 동작을 넣어요 (src/engine/touch.js).
// input.mode 는 마지막으로 쓴 기기예요: "keyboard" | "touch" | "gamepad" (화면 안내 문구가 바뀌어요).

export const KEYS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  jump: ["ArrowUp", "KeyW", "Space"],
  attack: ["KeyJ", "KeyZ"],
  skill: ["KeyK", "KeyX"],
  confirm: ["Enter", "Space"], // 직업 선택 화면에서 시작
  menu: ["Enter"],             // 게임 중 직업 선택으로 (Space 는 점프라서 빼요)
  pause: ["Escape", "KeyP"],
  restart: ["KeyR"],
  one: ["Digit1", "Numpad1"],
  two: ["Digit2", "Numpad2"],
  three: ["Digit3", "Numpad3"],
};

// 표준 게임패드 배치 (Xbox 기준: 0 A, 1 B, 2 X, 3 Y, 8 View/Select, 9 Menu/Start, 12~15 십자키)
const PAD = {
  jump: [0], confirm: [0, 9], attack: [2], skill: [3, 1], pause: [9], menu: [8], restart: [3],
  up: [12], left: [14], right: [15],
};
const STICK = 0.45;

const GAME_CODES = new Set(Object.values(KEYS).flat());
const keyDown = new Set(), keyHit = new Set();
const touchHeld = new Map(), touchHit = new Set();
let padHeld = new Set(), padHit = new Set();
const modeListeners = [];

function setMode(m) {
  if (input.mode === m) return;
  input.mode = m;
  for (const f of modeListeners) f(m);
}

addEventListener("keydown", (e) => {
  if (GAME_CODES.has(e.code)) e.preventDefault();
  if (!keyDown.has(e.code)) keyHit.add(e.code);
  keyDown.add(e.code);
  setMode("keyboard");
});
addEventListener("keyup", (e) => keyDown.delete(e.code));
addEventListener("blur", () => {
  keyDown.clear();
  touchHeld.clear();
});

export const input = {
  mode: "keyboard",
  held: (name) => KEYS[name].some((c) => keyDown.has(c)) || (touchHeld.get(name) ?? 0) > 0 || padHeld.has(name),
  hit: (name) => KEYS[name].some((c) => keyHit.has(c)) || touchHit.has(name) || padHit.has(name),

  /** 터치: 누르기 시작 (손가락 여러 개가 같은 동작을 눌러도 세어요) */
  press(name) {
    touchHeld.set(name, (touchHeld.get(name) ?? 0) + 1);
    touchHit.add(name);
    setMode("touch");
  },
  release(name) {
    const n = (touchHeld.get(name) ?? 0) - 1;
    if (n > 0) touchHeld.set(name, n);
    else touchHeld.delete(name);
  },
  /** 터치: 한 번 누름 (메뉴 버튼) */
  tap(name) {
    touchHit.add(name);
    setMode("touch");
  },
  releaseAll() {
    touchHeld.clear();
  },
  onMode(f) {
    modeListeners.push(f);
  },
  setMode,

  /** 매 프레임 시작에 불러요: 게임패드 상태를 읽어요. */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      for (const [name, idx] of Object.entries(PAD)) if (idx.some((i) => gp.buttons[i]?.pressed)) now.add(name);
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (ax < -STICK) now.add("left");
      if (ax > STICK) now.add("right");
      if (ay < -0.6) now.add("up");
    }
    padHit = new Set([...now].filter((n) => !padHeld.has(n)));
    padHeld = now;
    if (padHit.size) setMode("gamepad");
  },
  /** 프레임 끝에 불러서 "막 누름"을 지워요. */
  endFrame() {
    keyHit.clear();
    touchHit.clear();
    padHit.clear();
  },
};
