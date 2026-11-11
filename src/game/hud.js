// 화면 위 글씨와 UI (한글). 큰 캔버스(1280x720)에 직접 그려요.

const FONT = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";

// 기기별 안내 문구 (input.mode: keyboard | touch | gamepad)
const KEY = {
  keyboard: { attack: "J", skill: "K" },
  gamepad: { attack: "X", skill: "Y" },
};
export function controlsHint(mode) {
  if (mode === "touch") return "◀ ▶ 이동 · 점프 · 공격 · 스킬 버튼을 눌러요";
  if (mode === "gamepad") return "스틱 이동   A 점프   X 공격   Y 스킬   Start 일시정지";
  return "← → 이동   ↑/Space 점프   J 공격   K 스킬   Esc 일시정지";
}
function endLines(mode, paused) {
  if (mode === "touch") return []; // 터치는 화면 아래 버튼으로 골라요
  if (mode === "gamepad") return [paused ? "Start: 계속   Y: 처음부터   View: 직업 선택" : "Y: 다시 하기   View: 직업 선택"];
  return [paused ? "Esc: 계속   R: 처음부터   Enter: 직업 선택" : "R: 다시 하기   Enter: 직업 선택"];
}

function text(ctx, s, x, y, { size = 22, color = "#f4f1ea", align = "left", weight = 700, shadow = true } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(s, x + 2, y + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function panel(ctx, x, y, w, h, a = 0.55) {
  ctx.fillStyle = `rgba(10, 8, 18, ${a})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function slot(ctx, x, y, key, name, cd, cdMax, color) {
  panel(ctx, x, y, 210, 54);
  ctx.fillStyle = color;
  ctx.fillRect(x + 10, y + 11, 32, 32);
  text(ctx, key, x + 26, y + 28, { size: 20, color: "#141018", align: "center", shadow: false, weight: 800 });
  text(ctx, name, x + 54, y + 28, { size: 20 });
  if (cd > 0.05 && cdMax > 0.2) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x + 2, y + 2, 206 * (cd / cdMax), 50);
    text(ctx, cd.toFixed(1), x + 186, y + 28, { size: 18, color: "#ffd84a", align: "right" });
  }
}

export function drawHud(ctx, world, paused, mode = "keyboard") {
  const W = ctx.canvas.width, H = ctx.canvas.height, p = world.player, cls = world.cls;

  // 체력
  panel(ctx, 20, 18, 380, 70);
  text(ctx, cls.name, 36, 40, { size: 22, color: cls.color });
  const bx = 36, by = 58, bw = 348, bh = 18, k = p.hp / p.maxHp;
  ctx.fillStyle = "#2a1620";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = k > 0.35 ? "#d6304a" : "#ff6a3a";
  ctx.fillRect(bx, by, bw * k, bh);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(bx, by, bw * k, 4);
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw - 6, 40, { size: 18, align: "right" });

  // 점수·웨이브
  panel(ctx, W - 300, 18, 280, 70);
  text(ctx, `점수 ${world.score}`, W - 36, 40, { size: 22, align: "right", color: "#ffd84a" });
  text(ctx, `웨이브 ${world.waveIndex}/${world.totalWaves}   남은 적 ${world.enemies.length}`, W - 36, 68, { size: 17, align: "right", color: "#cfc8e8" });

  // 스킬 칸 (터치 화면은 버튼 자체에 대기시간이 보여서 그리지 않아요)
  if (mode !== "touch") {
    const k = KEY[mode] ?? KEY.keyboard;
    slot(ctx, 20, H - 74, k.attack, cls.attack.name, p.cd.attack, cls.attack.cooldown, cls.color);
    slot(ctx, 240, H - 74, k.skill, cls.skill.name, p.cd.skill, cls.skill.cooldown, cls.color);
  }

  if (world.banner) {
    const a = Math.min(1, world.banner.t / 0.4);
    ctx.globalAlpha = a;
    panel(ctx, W / 2 - 330, 110, 660, 56, 0.6);
    text(ctx, world.banner.text, W / 2, 138, { size: 24, align: "center" });
    ctx.globalAlpha = 1;
  }

  if (paused) overlay(ctx, "일시정지", endLines(mode, true));
  else if (world.state === "over") overlay(ctx, "쓰러졌어요…", [`점수 ${world.score} · 처치 ${world.kills}`, ...endLines(mode)], "#ff6a6a");
  else if (world.state === "clear")
    overlay(ctx, "스테이지 클리어!", [`점수 ${world.score} · 처치 ${world.kills} · ${world.time.toFixed(1)}초`, ...endLines(mode)], "#ffd84a");
}

function overlay(ctx, title, lines, color = "#f4f1ea") {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = "rgba(6, 4, 12, 0.62)";
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, H / 2 - 50, { size: 56, align: "center", color, weight: 800 });
  lines.forEach((l, i) => text(ctx, l, W / 2, H / 2 + 22 + i * 40, { size: 24, align: "center" }));
}

export function drawTitleHud(ctx, classes, sel, slots, mode = "keyboard") {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  text(ctx, "픽셀 원정대", W / 2, 84, { size: 64, align: "center", color: "#ffd84a", weight: 800 });
  text(ctx, "직업을 골라 주세요", W / 2, 140, { size: 24, align: "center", color: "#cfc8e8" });
  // 캐릭터는 땅(y 600) 위에 서 있고 머리가 y 450 쯤이라, 이름은 그 위에 써요
  classes.forEach((c, i) => {
    const x = slots[i], on = i === sel;
    if (on) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x - 128, 352, 256, 258);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 128, 352, 256, 258);
    }
    text(ctx, `${i + 1}. ${c.name}`, x, 382, { size: 30, align: "center", color: on ? c.color : "#9a94b4", weight: 800 });
    text(ctx, `체력 ${c.hp} · 이동 ${c.speed}`, x, 414, { size: 17, align: "center", color: on ? "#f4f1ea" : "#7a7494" });
  });
  const c = classes[sel];
  panel(ctx, W / 2 - 420, 622, 840, 90, 0.7);
  text(ctx, c.desc, W / 2, 643, { size: 21, align: "center" });
  const k = KEY[mode];
  const ak = k ? `${k.attack} ` : "공격 ", sk = k ? `${k.skill} ` : "스킬 ";
  text(ctx, `${ak}${c.attack.name}   ·   ${sk}${c.skill.name} (${c.skill.cooldown}초)`, W / 2, 669, { size: 19, align: "center", color: c.color });
  const hint = mode === "touch" ? "캐릭터를 눌러 고르고, 한 번 더 누르면 시작해요"
    : mode === "gamepad" ? "← → 로 고르고 A 로 시작"
    : "← → 또는 1·2·3 으로 고르고 Enter 로 시작";
  text(ctx, hint, W / 2, 694, { size: 17, align: "center", color: "#9a94b4" });
}
