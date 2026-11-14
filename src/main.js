// 게임 시작점: 화면 준비, 장면 전환(타이틀 → 캐릭터 만들기 → 맵), 대화, 맵 이동, 죽음, 저장, 매 프레임 루프.
// PC(키보드), 휴대폰·태블릿(터치), 게임패드를 모두 받아요.

import { createRenderer } from "./engine/render.js";
import { input } from "./engine/input.js";
import { createTouchUI } from "./engine/touch.js";
import { createUI } from "./game/ui.js";
import { TitleScene, CreateScene } from "./game/title.js";
import { World, TUTORIAL_END } from "./game/world.js";
import { drawHud } from "./game/hud.js";
import { mapById } from "./game/maps.js";
import { makeStory } from "./game/story.js";
import { createProfile, loadProfile, saveProfile, clearSave } from "./game/profile.js";

const canvas = document.getElementById("game");
const r = createRenderer(canvas);
const touch = createTouchUI(document.getElementById("touch"));
const ui = createUI(document.getElementById("ui"), canvas);

let scene = "title"; // title | create | world
let title = new TitleScene();
let create = null;
let world = null;
let profile = null;
let story = null;
let banner = null;
let fade = 0; // 맵이 바뀔 때 검은 화면에서 밝아져요
let last = performance.now();

const save = () => {
  if (!profile) return;
  if (world && world.profile === profile && !world.player.dead) profile.hp = world.player.hp;
  saveProfile(profile);
};

// ---- 타이틀
async function titleFlow() {
  scene = "title";
  world = null;
  title = new TitleScene();
  const saved = loadProfile();
  const opts = saved
    ? [{ label: `이어하기 · ${saved.name}`, value: "cont" }, { label: "새로 시작", value: "new" }]
    : [{ label: "시작하기", value: "new" }];
  const v = await ui.menu(null, null, opts);
  if (v === "cont") {
    profile = saved;
    enterMap(profile.map, "left");
    return;
  }
  if (saved) {
    const ok = await ui.menu("새로 시작할까요?", `저장된 캐릭터 '${saved.name}'의 기록이 지워져요.`, [
      { label: "아니요", value: false },
      { label: "네, 새로 시작", value: true },
    ]);
    if (!ok) return titleFlow();
  }
  createFlow();
}

// ---- 캐릭터 만들기: 이름 → 고유번호·태생 특성(보이지 않음). 주인공은 여자 한 명이에요
async function createFlow() {
  scene = "create";
  create = new CreateScene();
  const gender = "f";
  const name = await ui.askName("리아");
  if (name === null) return titleFlow();
  clearSave();
  profile = createProfile(gender, name);
  save();
  enterMap("village", "left");
  await runStory("opening");
}

// ---- 맵 들어가기
function enterMap(id, entry) {
  scene = "world";
  profile.map = id;
  if (world && world.profile === profile) profile.hp = world.player.dead ? null : world.player.hp; // 쓰러졌으면 가득 차서 다시 시작
  world = new World(profile, id, entry);
  world.onEvent = onWorldEvent;
  story = makeStory({ ui, p: profile, event: (n) => world.event(n), save });
  const m = mapById(id);
  banner = { text: m.name, t: 2.6 };
  fade = 0.6;
  save();
}

function onWorldEvent(kind, v) {
  if (kind === "toast") ui.toast(v, 2.6);
  if (kind === "tutorial") {
    if (v === TUTORIAL_END) {
      ui.toast("연습 끝! 오른쪽 길로 가면 왕국 가는 길이에요 →", 4);
      banner = { text: "원정 시작", sub: "목표: 루멘 왕성으로 가서 국왕을 만나요", t: 3.2 };
    } else ui.toast("잘했어요!", 1.2);
    save();
  }
}

async function runStory(id) {
  if (!story[id]) return;
  world.player.locked = true;
  try {
    await story[id]();
  } finally {
    if (world) world.player.locked = false;
    save();
  }
}

async function pauseMenu() {
  const v = await ui.menu("일시정지", null, [
    { label: "계속하기", value: "resume" },
    { label: "타이틀로 (자동 저장돼요)", value: "title" },
  ], "resume");
  if (v === "title") {
    save();
    titleFlow();
  }
}


// 다른 앱으로 가거나 화면이 꺼지면 자동으로 일시정지
const pauseIfPlaying = () => {
  if (scene === "world" && !ui.busy && world?.state === "play") pauseMenu();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseIfPlaying();
    input.releaseAll();
    save();
  }
});
const portrait = matchMedia("(orientation: portrait) and (pointer: coarse) and (max-width: 700px)"); // style.css #rotate 와 같은 조건
portrait.addEventListener?.("change", (e) => e.matches && pauseIfPlaying());

/** 한 프레임: dt 초만큼 진행하고 그려요. 브라우저의 requestAnimationFrame 이나 점검 도구(window.game.step)가 불러요. */
const uiRoot = document.getElementById("ui");
function tick(dt) {
  if (uiRoot.dataset.scene !== scene) uiRoot.dataset.scene = scene; // 장면마다 메뉴 위치가 달라요 (style.css)
  input.poll();
  ui.update(dt);

  if (scene === "title") {
    touch.setScene("menu");
    title.update(dt);
    title.draw(r);
  } else if (scene === "create") {
    touch.setScene("menu");
    create.update(dt);
    create.draw(r);
  } else if (world) {
    const playing = !ui.busy && world.state === "play";
    touch.setScene(playing ? "play" : "menu");
    touch.setNear(world.near);
    if (playing && input.hit("pause")) pauseMenu();
    else if (!ui.busy) world.update(dt);
    if (banner) banner.t -= dt;

    // 대화 시작
    if (world.talk && !ui.busy) {
      const id = world.talk;
      world.talk = null;
      // 말 거는 상대가 주인공 뒤에 가려지지 않게 한 걸음 떨어져서 마주 봐요
      const npc = world.npcs.find((n) => n.id === id), p = world.player;
      if (npc && Math.abs(p.x - npc.x) < 34) p.x = npc.x + (Math.sign(p.x - npc.x) || -1) * 34; // 두 캐릭터 폭만큼
      if (npc) {
        p.facing = Math.sign(npc.x - p.x) || p.facing;
        npc.face = -p.facing;
      }
      runStory(id);
    }
    // 맵 끝에 닿음 → 다음 맵
    if (world.exit) {
      const { to, entry } = world.exit;
      enterMap(to, entry);
    }
    // 쓰러짐 → 돈 1/5 잃고 이 맵 입구에서 다시
    if (world.state === "dead" && world.deadT > 2.2) {
      const lost = Math.floor(profile.gold / 5);
      profile.gold -= lost;
      profile.stats.deaths = (profile.stats.deaths ?? 0) + 1;
      enterMap(world.mapId, world.entry);
      ui.toast(lost > 0 ? `돈 ${lost}G를 잃었어요…` : "다시 일어났어요", 3);
    }

    world.draw(r);
    r.present(world.shake());
    drawHud(r.ctx, world, input.mode, banner);
  }
  if (fade > 0) {
    fade -= dt;
    r.ctx.fillStyle = `rgba(0,0,0,${Math.max(0, fade / 0.6)})`;
    r.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  input.endFrame();
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}
// 자동 플레이 점검(tools/playcheck)이 시계를 잡고 있으면 스스로 돌지 않고, 점검 도구가 한 칸씩 진행시켜요
if (!window.GAME_CLOCK) requestAnimationFrame(frame);
// 자동 점검에서만: ?start=road 처럼 주면 튜토리얼을 마친 시험용 캐릭터로 그 맵에서 바로 시작해요
const startMap = window.GAME_CLOCK && new URLSearchParams(location.search).get("start");
if (startMap && mapById(startMap)) {
  profile = createProfile("f", "리아");
  profile.tutorial = TUTORIAL_END;
  profile.gold = 40;
  enterMap(startMap, "left");
} else titleFlow();

// 개발용: 브라우저 콘솔에서 상태를 볼 수 있어요 (window.game.world, game.profile)
// 자동 플레이 점검용: step(n) 으로 1/60초씩 진행, scene("play" = 맵에서 플레이 중), state(지금 상황 요약)
window.game = {
  get world() { return world; },
  get profile() { return profile; },
  get scene() { return scene === "world" ? (ui.busy ? "talk" : "play") : scene; },
  get state() {
    const p = world?.player;
    return {
      map: world?.mapId ?? null, ui: ui.kind, x: p ? Math.round(p.x) : null, hp: p ? Math.ceil(p.hp) : null,
      gold: profile?.gold ?? null, tutorial: profile?.tutorial ?? null, act: p?.state?.() ?? null,
      margin: p ? p.hp / p.maxHp : null,
      sx: p && world.drawCamX != null ? Math.round(p.x) - world.drawCamX : null, // 화면 속 주인공 x (흔들림 점검용)
    };
  },
  step(n = 1) {
    if (n === 0) tick(0); // 진행 없이 지금 모습만 다시 그리기
    for (let i = 0; i < n; i++) tick(1 / 60);
  },
  ui,
  input,
  enterMap,
};
