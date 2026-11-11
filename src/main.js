// 게임 시작점: 화면 준비, 장면(직업 선택 ↔ 게임) 전환, 매 프레임 루프.
// PC(키보드), 휴대폰·태블릿(터치), 게임패드를 모두 받아요.

import { createRenderer } from "./engine/render.js";
import { input } from "./engine/input.js";
import { createTouchUI } from "./engine/touch.js";
import { Title } from "./game/title.js";
import { World } from "./game/world.js";
import { drawHud, controlsHint } from "./game/hud.js";
import { CLASSES } from "./game/classes.js";

const canvas = document.getElementById("game");
const r = createRenderer(canvas);
const touch = createTouchUI(document.getElementById("touch"));
let title = new Title();
let world = null;
let paused = false;
let last = performance.now();

function startGame(cls) {
  world = new World(cls, controlsHint(input.mode));
  paused = false;
  touch.setLabels(cls.attack.name, cls.skill.name);
}
function backToTitle() {
  title = new Title(Math.max(0, CLASSES.indexOf(world?.cls)));
  world = null;
  paused = false;
}
const pauseIfPlaying = () => {
  if (world && world.state === "play") paused = true;
};

// 직업 선택 화면: 캐릭터를 눌러서 고르고, 고른 캐릭터를 한 번 더 누르면 시작
canvas.addEventListener("pointerdown", (e) => {
  if (world) return;
  const [x, y] = r.toCanvas(e.clientX, e.clientY);
  const i = title.pick(x, y);
  if (i < 0) return;
  if (e.pointerType === "touch") input.setMode("touch");
  if (i === title.sel) input.tap("confirm");
  else title.select(i);
});

// 다른 앱으로 가거나 화면이 꺼지면 자동으로 일시정지
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseIfPlaying();
    input.releaseAll();
  }
});
// 휴대폰을 세로로 돌리면 일시정지 (세로 화면 안내가 떠요)
const portrait = matchMedia("(orientation: portrait) and (pointer: coarse) and (max-width: 700px)"); // style.css #rotate 와 같은 조건
portrait.addEventListener?.("change", (e) => e.matches && pauseIfPlaying());

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();

  if (!world) {
    touch.setScene("title");
    const picked = title.update(dt);
    if (picked) startGame(picked);
    else title.draw(r, input.mode);
  } else {
    if (input.hit("pause") && world.state === "play") paused = !paused;
    if (paused || world.state !== "play") {
      if (input.hit("restart")) startGame(world.cls);
      else if (input.hit("menu")) backToTitle();
    }
    if (world && !paused) world.update(dt);
    if (world) {
      touch.setScene(paused ? "paused" : world.state);
      touch.setCooldown(world.player.cd.skill, world.cls.skill.cooldown);
      world.draw(r);
      r.present(world.shake());
      drawHud(r.ctx, world, paused, input.mode);
    }
  }

  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 개발용: 브라우저 콘솔에서 상태를 볼 수 있어요 (window.game.world)
window.game = { get world() { return world; }, get title() { return title; }, input };
