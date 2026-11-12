// 대화창·선택지·메뉴·이름 입력. 한글이 또렷하게 보이도록 게임 그림(canvas) 위에 HTML 로 올려요.
// 모든 기기에서 조작돼요:
//   키보드: Enter/Space/E/J 로 넘기기, ↑↓ 로 고르기     터치·마우스: 대화창이나 버튼을 눌러요
//   게임패드: A 로 넘기기·고르기, 십자키 ↑↓
// 대화는 async 함수로 써요:  await ui.say("촌장", "어서 오게.", { face: "neutral" })

import { input } from "../engine/input.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NEXT = ["confirm", "interact", "attack"];

export function createUI(root, canvas) {
  root.innerHTML = `
    <div class="ui-dialog" hidden>
      <img class="ui-face" alt="" hidden>
      <div class="ui-who"></div>
      <div class="ui-text"></div>
      <div class="ui-next">▼</div>
    </div>
    <div class="ui-menu" hidden><div class="ui-title"></div><div class="ui-sub"></div><div class="ui-opts"></div></div>
    <form class="ui-name" hidden autocomplete="off">
      <div class="ui-title">이름을 정해 주세요</div>
      <input class="ui-input" maxlength="8" enterkeyhint="done" spellcheck="false">
      <div class="ui-hint">한글·영문 1~8글자</div>
      <div class="ui-opts"><button type="button" class="ui-opt" data-v="back">뒤로</button><button type="submit" class="ui-opt on">확인</button></div>
    </form>
    <div class="ui-toast" hidden></div>`;
  const dlg = $(".ui-dialog", root), who = $(".ui-who", dlg), txt = $(".ui-text", dlg), face = $(".ui-face", dlg);
  const menu = $(".ui-menu", root), nameForm = $(".ui-name", root), nameIn = $(".ui-input", root), toastEl = $(".ui-toast", root);

  // 게임 화면(canvas) 위에 정확히 겹치게 (화면 크기가 바뀌면 다시 맞춰요)
  function fit() {
    const b = canvas.getBoundingClientRect();
    Object.assign(root.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
    root.style.setProperty("--u", `${b.width / 320}px`);
  }
  addEventListener("resize", fit);
  window.visualViewport?.addEventListener("resize", fit);
  new ResizeObserver(fit).observe(canvas);
  fit();

  let job = null; // 지금 진행 중인 것: { kind, ... , done(v) }

  // ---- 대화
  let typing = null;
  function showLine(name, text, opt) {
    dlg.hidden = false;
    dlg.classList.toggle("nar", !name);
    who.textContent = name ?? "";
    who.hidden = !name;
    if (opt.face) {
      face.src = opt.face;
      face.hidden = false;
    } else face.hidden = true;
    dlg.classList.toggle("has-face", !!opt.face);
    // 한 글자씩 나와요 (넘기기 키를 누르면 바로 다 나와요)
    txt.textContent = "";
    typing = { text, i: 0, t: 0 };
  }
  dlg.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (job?.kind === "say") advance();
  });
  function advance() {
    if (typing && typing.i < typing.text.length) {
      typing.i = typing.text.length;
      txt.textContent = typing.text;
      return;
    }
    const j = job;
    job = null;
    dlg.hidden = true;
    j.done();
  }

  // ---- 선택지 메뉴 (대화 중 선택지, 일시정지, 타이틀)
  let sel = 0, optEls = [];
  function openMenu(title, sub, options, { keepDialog = false, cancel = null } = {}) {
    menu.hidden = false;
    menu.classList.toggle("in-dialog", keepDialog);
    $(".ui-title", menu).textContent = title ?? "";
    $(".ui-title", menu).hidden = !title;
    $(".ui-sub", menu).textContent = sub ?? "";
    $(".ui-sub", menu).hidden = !sub;
    $(".ui-opts", menu).innerHTML = options.map((o, i) => `<button type="button" class="ui-opt" data-i="${i}">${esc(o.label ?? o)}</button>`).join("");
    optEls = [...menu.querySelectorAll(".ui-opt")];
    sel = 0;
    mark();
    return new Promise((done) => (job = { kind: "menu", options, cancel, done }));
  }
  const mark = () => optEls.forEach((b, i) => b.classList.toggle("on", i === sel));
  menu.addEventListener("click", (e) => {
    const b = e.target.closest(".ui-opt");
    if (!b || job?.kind !== "menu") return;
    sel = Number(b.dataset.i);
    pick();
  });
  function pick() {
    const j = job;
    job = null;
    menu.hidden = true;
    dlg.hidden = true;
    j.done(j.options[sel]?.value ?? sel);
  }

  // ---- 이름 입력
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = nameIn.value.trim().replace(/\s+/g, " ");
    if (!v) {
      nameIn.focus();
      return;
    }
    finishName(v);
  });
  $("[data-v=back]", nameForm).addEventListener("click", () => finishName(null));
  // 입력칸에서 Enter = 확인 (한글 조합 중인 Enter 는 글자 확정이라 넘어가요)
  nameIn.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.code === "Enter") && !e.isComposing) {
      e.preventDefault();
      nameForm.requestSubmit();
    }
  });
  function finishName(v) {
    if (job?.kind !== "name") return;
    const j = job;
    job = null;
    nameForm.hidden = true;
    nameIn.blur();
    j.done(v);
  }

  // ---- 알림 (잠깐 떴다 사라지는 글)
  let toastT = 0;

  return {
    get busy() { return !!job; },
    get kind() { return job?.kind ?? null; },
    fit,
    /** 대사 한 줄. name 이 없으면 해설(이야기 글). opt.face: 얼굴 그림 주소 */
    say(name, text, opt = {}) {
      showLine(name, text, opt);
      return new Promise((done) => (job = { kind: "say", done }));
    },
    /** 대사 + 선택지. options: [{ label, value }] → 고른 value */
    async ask(name, text, options, opt = {}) {
      showLine(name, text, opt);
      typing.i = text.length;
      txt.textContent = text;
      return openMenu(null, null, options, { keepDialog: true });
    },
    /** 화면 가운데 메뉴. cancel: Esc(일시정지 키)로 닫을 때 돌려줄 값 */
    menu(title, sub, options, cancel = null) {
      return openMenu(title, sub, options, { cancel });
    },
    /** 이름 입력 → 이름 또는 null(뒤로) */
    askName(def = "") {
      nameForm.hidden = false;
      nameIn.value = def;
      setTimeout(() => {
        nameIn.focus();
        nameIn.select();
      }, 30);
      return new Promise((done) => (job = { kind: "name", done }));
    },
    toast(text, t = 2.2) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      toastT = t;
    },
    /** 매 프레임: 키보드·게임패드로 대화 넘기기, 메뉴 고르기 */
    update(dt) {
      if (toastT > 0 && (toastT -= dt) <= 0) toastEl.hidden = true;
      if (typing && typing.i < typing.text.length) {
        typing.t += dt;
        const n = Math.min(typing.text.length, Math.floor(typing.t * 45));
        if (n !== typing.i) {
          typing.i = n;
          txt.textContent = typing.text.slice(0, n);
        }
      }
      if (!job) return;
      if (job.kind === "say") {
        if (NEXT.some((n) => input.hit(n)) || input.hit("jump")) advance();
      } else if (job.kind === "menu") {
        if (input.hit("up") || input.hit("left")) (sel = (sel + optEls.length - 1) % optEls.length), mark();
        if (input.hit("down") || input.hit("right")) (sel = (sel + 1) % optEls.length), mark();
        if (NEXT.some((n) => input.hit(n))) pick();
        else if (input.hit("pause") && job.cancel !== null) {
          const j = job;
          job = null;
          menu.hidden = true;
          dlg.hidden = true;
          j.done(j.cancel);
        }
      } else if (job.kind === "name") {
        // 확인: 게임패드 A, 또는 입력칸 밖에서 누른 Enter (입력칸 안의 Enter 는 브라우저가 바로 제출해요)
        if (input.hit("confirm")) nameForm.requestSubmit();
      }
    },
  };
}
