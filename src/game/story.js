// 대사와 이야기. NPC·표지판 id 마다 대화 함수가 있어요.
// 글 안의 표시:
//   {name}        주인공 이름          {name:이/가}  이름 + 알맞은 조사 (은/는, 을/를, 아/야, 으로/로 ...)
//   {call}        이 NPC 가 주인공을 부르는 말. 이름을 들은 NPC 는 이름으로, 아니면 "젊은이" 같은 말로 불러요.
// NPC 는 처음엔 주인공 이름을 몰라요. 대화에서 이름을 말하면 profile.knows[npc] = true 가 돼요.

import { josa, manaOpen } from "./profile.js";

// NPC 가 이름을 모를 때 부르는 말
const STRANGER = { guard: "젊은이", guard2: "젊은이", maid: "원정대원님", king: "젊은이" };

export function makeStory(ctx) {
  const { ui, p } = ctx;
  const face = (f) => `assets/portraits/${p.gender}-${f}.png`;
  const fmt = (s, npc) =>
    s
      .replace(/\{name:([^}]+)\}/g, (_, pair) => josa(p.name, pair))
      .replace(/\{name\}/g, p.name)
      .replace(/\{call\}/g, () => (npc && p.knows[npc] ? (npc === "elder" ? josa(p.name, "아/야") : `${p.name} 님`) : STRANGER[npc] ?? "젊은이"));
  // 말하는 사람별 줄임말
  const N = (npc, who) => (s) => ui.say(who, fmt(s, npc));
  const me = (s, f = "neutral") => ui.say(p.name, fmt(s), { face: face(f) });
  const nar = (s) => ui.say(null, fmt(s));

  const S = {
    // ---- 새 게임 시작
    async opening() {
      await nar("해가 지기 전, 도토리 마을 끝 언덕.");
      await nar("오늘은 견습 원정대원 {name:이/가} 왕성으로 떠나는 날이다.");
      await me("좋아, 떠나기 전에 몸부터 풀어 볼까.", "determined");
    },

    // ---- 도토리 마을
    async signVillage() {
      await nar("「← 도토리 마을　　　왕국 가는 길 →」\n「밤길 조심! 고블린과 슬라임 출몰 주의」");
      ctx.event("readSign");
    },
    async elder() {
      const say = N("elder", "촌장");
      if (p.tutorial < 4) {
        await say("{call}, 몸은 다 풀었느냐? 떠나기 전에 연습을 마치고, 저 표지판도 꼭 읽어 보거라.");
        return;
      }
      if (p.tutorial < 99) {
        await say("{call}, 드디어 떠나는구나.");
        await say("왕성의 폐하께서 원정대원을 부르셨다. 고대 유적에 잠든 유물 'PIXEL'을 찾으신다더구나.");
        await me("PIXEL…? 그게 뭔데요?", "surprised");
        await say("나도 잘 모른다. 다만 세상의 모든 빛과 색이 그 안에서 나왔다는 옛이야기가 있지.");
        if (manaOpen(p)) await say("…그러고 보니 너는 어릴 적부터 가끔 손끝이 반짝이곤 했지. 왕성에 가면 그 이야기를 해 보거라.");
        await say("가는 길에 고블린과 슬라임이 나온다. 낡은 검이라도 잘 휘두르면 충분할 게다.");
        await say("오른쪽 길을 따라가면 왕국 가는 길이다. 몸조심하거라.");
        await me("다녀오겠습니다!", "determined");
        ctx.event("tutorialDone");
        return;
      }
      await say("왕성은 오른쪽 길 끝에 있다. 서두르거라, {call}.");
    },

    // ---- 왕국 가는 길
    async signRoad() {
      await nar("「← 도토리 마을　　　루멘 왕성 →」");
    },
    async signCastle() {
      await nar("「루멘 왕성 — 조금만 더!」");
    },

    // ---- 왕성
    async guard() {
      const say = N("guard", "경비병");
      if (p.flags.guardMet) {
        await say("{call}, 폐하께서는 안쪽 끝 옥좌에 계시오.");
        return;
      }
      await say("거기 {call}, 멈추시오!");
      await say("…아, 그 견습 원정대 복장. 폐하께서 부르신 원정대원이로군. 이름이 무엇이오?");
      const tell = await ui.ask("경비병", "이름이 무엇이오?", [
        { label: "이름을 말한다", value: true },
        { label: "말하지 않는다", value: false },
      ]);
      if (tell) {
        await me("{name}입니다.");
        p.knows.guard = true;
        await say("{call}이시군. 들어가시오. 폐하께서는 안쪽 끝에 계시오.");
      } else {
        await me("…….", "tired");
        await say("뭐, 상관없소. 폐하께서는 안쪽 끝에 계시오.");
      }
      p.flags.guardMet = true;
      ctx.save();
    },
    async guard2() {
      await N("guard2", "경비병")("폐하 앞에서는 예의를 갖추시오, {call}.");
    },
    async maid() {
      const say = N("maid", "시녀");
      await say("어머, 원정대원님이세요? 왕성 상점과 여관은 아직 준비 중이에요.");
      await say("원정을 떠나실 때쯤엔 문을 열 거예요. 그때 꼭 들러 주세요!");
    },
    async king() {
      const say = N("king", "국왕");
      if (p.flags.kingMet) {
        await say("{call}, 준비는 되었는가? 원정길은 곧 열릴 걸세.");
        await nar("(다음 업데이트에서 안개 숲으로 가는 원정이 시작돼요.)");
        return;
      }
      await say("오오, 그대가 도토리 마을의 견습 원정대원인가.");
      await say("먼 길 오느라 수고했네. 그대의 이름은 무엇인가?");
      await me("{name}입니다, 폐하.", "determined");
      p.knows.king = true;
      await say("{name}. 좋은 이름이로군.");
      await say("듣게. 왕국 동쪽 끝, 고대 유적 깊은 곳에 유물 'PIXEL'이 잠들어 있네.");
      await say("요즘 세상의 색이 조금씩 바래고 몬스터가 늘어나고 있지. PIXEL만이 그것을 되돌릴 수 있다네.");
      await say("{name}, 그대에게 원정을 명하노라. PIXEL을 찾아 이 왕성으로 가져오게.");
      await me("명을 받들겠습니다!", "determined");
      await say("빈손으로 보낼 수는 없지. 원정에 가져갈 무기를 고르게.");
      for (;;) {
        const w = await ui.ask("국왕", "원정에 가져갈 무기를 고르게.", [
          { label: "검", value: "sword" },
          { label: "활 (화살 50발)", value: "bow" },
          { label: "지팡이", value: "staff" },
        ]);
        if (w === "staff" && !manaOpen(p)) {
          await say("음… 자네는 마나가 없는 것 같은데?");
          await say("지팡이는 마나가 깨어난 자만 쓸 수 있네. 다른 것을 고르게.");
          continue;
        }
        p.weapon = w;
        if (w === "sword") await say("검이로군. 기본에 충실한 것이 가장 강한 법이지.");
        if (w === "bow") {
          p.arrows = 50;
          await say("활이로군. 화살 50발도 함께 가져가게. 화살은 쏘면 다시 주울 수 없으니 아껴 쓰게.");
        }
        if (w === "staff") {
          await say("오오… 그대에게서 마나가 느껴지는군! 마탑의 마법사들도 놀라겠어.");
          await me("마나가… 저한테요?", "surprised");
        }
        break;
      }
      await say("길은 험할 걸세. 준비가 되면 떠나게. 왕국의 운명이 그대에게 달렸네.");
      p.flags.kingMet = true;
      ctx.event("kingMet");
      await nar("(M1 끝! 다음 업데이트에서 무기 바꾸기와 안개 숲 원정이 이어져요.)");
    },
  };
  return S;
}
