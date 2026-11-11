// 터치 화면용 조작 버튼 (휴대폰·태블릿). HTML 버튼을 게임 화면 위에 올려요.
//   왼쪽: ◀ ▶ 이동 패드 (손가락을 떼지 않고 좌우로 미끄러져도 돼요)
//   오른쪽: 스킬 · 공격 · 점프
//   위: 일시정지, 전체화면
//   장면마다 바뀌는 메뉴 버튼: 직업 선택 / 일시정지 / 게임 끝
// 터치 기기에서만 보여요 (마우스·키보드로 하면 숨어요).

import { input } from "./input.js";

// 손가락을 버튼 밖으로 미끄러져도 계속 그 버튼으로 받게 해요. 실패해도(일부 브라우저) 누르기는 꼭 처리해요.
const capture = (el, id) => {
  try {
    el.setPointerCapture(id);
  } catch {}
};

const MENUS = {
  title: [["◀", "left"], ["시작", "confirm", "primary"], ["▶", "right"]],
  paused: [["계속하기", "pause", "primary"], ["처음부터", "restart"], ["직업 선택", "menu"]],
  over: [["다시 하기", "restart", "primary"], ["직업 선택", "menu"]],
  clear: [["다시 하기", "restart", "primary"], ["직업 선택", "menu"]],
  play: [],
};

export function createTouchUI(root) {
  root.innerHTML = `
    <div class="t-play">
      <div class="t-pad" aria-label="이동">
        <span class="t-pad-l">◀</span><span class="t-pad-r">▶</span>
      </div>
      <div class="t-actions">
        <button class="t-btn t-skill" data-hold="skill" aria-label="스킬"><span class="t-label">스킬</span><span class="t-cd"></span></button>
        <button class="t-btn t-attack" data-hold="attack" aria-label="공격"><span class="t-label">공격</span></button>
        <button class="t-btn t-jump" data-hold="jump" aria-label="점프"><span class="t-label">점프</span></button>
      </div>
      <button class="t-top t-pause" data-tap="pause" aria-label="일시정지">Ⅱ</button>
    </div>
    <button class="t-top t-fs" aria-label="전체화면">⛶</button>
    <div class="t-menu"></div>`;

  const pad = root.querySelector(".t-pad");
  const menu = root.querySelector(".t-menu");
  const cdEl = root.querySelector(".t-cd");
  const skillBtn = root.querySelector(".t-skill");
  const fsBtn = root.querySelector(".t-fs");
  let scene = null;

  // ---- 이동 패드: 손가락마다 지금 누르는 방향을 기억해요
  const padDir = new Map();
  const dirAt = (e) => {
    const r = pad.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? "left" : "right";
  };
  const setDir = (id, d) => {
    const old = padDir.get(id);
    if (old === d) return;
    if (old) input.release(old);
    if (d) {
      input.press(d);
      padDir.set(id, d);
    } else padDir.delete(id);
    pad.classList.toggle("on-l", [...padDir.values()].includes("left"));
    pad.classList.toggle("on-r", [...padDir.values()].includes("right"));
  };
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    capture(pad, e.pointerId);
    setDir(e.pointerId, dirAt(e));
  });
  pad.addEventListener("pointermove", (e) => {
    if (padDir.has(e.pointerId)) setDir(e.pointerId, dirAt(e));
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) pad.addEventListener(ev, (e) => setDir(e.pointerId, null));

  // ---- 누르고 있는 버튼 (점프, 공격, 스킬)
  for (const b of root.querySelectorAll("[data-hold]")) {
    const name = b.dataset.hold, ids = new Set();
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      capture(b, e.pointerId);
      if (ids.has(e.pointerId)) return;
      ids.add(e.pointerId);
      input.press(name);
      b.classList.add("on");
    });
    const up = (e) => {
      if (!ids.delete(e.pointerId)) return;
      input.release(name);
      if (!ids.size) b.classList.remove("on");
    };
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, up);
  }

  // ---- 한 번 누르는 버튼 (일시정지, 메뉴)
  root.addEventListener("pointerdown", (e) => {
    const t = e.target.closest("[data-tap]");
    if (!t) return;
    e.preventDefault();
    input.tap(t.dataset.tap);
  });

  // ---- 전체화면 (지원하는 기기만. 아이폰 사파리는 지원하지 않아서 숨겨요)
  const de = document.documentElement;
  if (!de.requestFullscreen) fsBtn.hidden = true;
  fsBtn.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await de.requestFullscreen({ navigationUI: "hide" });
        await screen.orientation?.lock?.("landscape").catch(() => {});
      }
    } catch {}
  });

  // ---- 터치 기기에서만 보이기
  // 휴대폰·태블릿(주 입력이 손가락)은 처음부터 터치 모드. 터치스크린 노트북은 실제로 화면을 만질 때 바뀌어요.
  const show = (on) => root.classList.toggle("shown", on);
  if (matchMedia("(pointer: coarse)").matches) {
    show(true);
    input.setMode("touch");
  }
  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") {
      show(true);
      input.setMode("touch");
    }
  }, { capture: true });
  input.onMode((m) => {
    if (m !== "touch") {
      show(false);
      input.releaseAll();
    } else show(true);
  });
  // 길게 눌러 생기는 메뉴·확대를 막아요
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    /** 장면이 바뀌면 메뉴 버튼과 조작 버튼을 바꿔요. */
    setScene(s) {
      if (s === scene) return;
      scene = s;
      root.dataset.scene = s;
      menu.innerHTML = (MENUS[s] ?? [])
        .map(([label, tap, cls]) => `<button class="t-mbtn ${cls ?? ""}" data-tap="${tap}">${label}</button>`)
        .join("");
      if (s !== "play") {
        input.releaseAll();
        for (const id of [...padDir.keys()]) setDir(id, null);
        root.querySelectorAll(".t-btn.on").forEach((b) => b.classList.remove("on"));
      }
    },
    /** 스킬 버튼에 남은 대기시간을 보여줘요. */
    setCooldown(left, max) {
      const k = max > 0 ? Math.max(0, Math.min(1, left / max)) : 0;
      skillBtn.style.setProperty("--cd", k.toFixed(3));
      cdEl.textContent = left > 0.05 ? left.toFixed(1) : "";
      skillBtn.classList.toggle("cooling", left > 0.05);
    },
    setLabels(attack, skill) {
      root.querySelector(".t-attack .t-label").textContent = attack;
      root.querySelector(".t-skill .t-label").textContent = skill;
    },
    get visible() {
      return root.classList.contains("shown");
    },
  };
}
