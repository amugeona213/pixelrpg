// 맵 하나: 주인공, 적, NPC, 표지판, 동전, 이펙트, 카메라, 맵 끝(다음 맵으로), 튜토리얼, 죽음.
// 맵이 바뀌면 main.js 가 새 World 를 만들어요 (world.exit 를 보고).

import { createFx, hitSpark, damageNumber, poof, collectBurst, torch, coinSpin, PAL } from "../engine/px.js";
import { FxPool } from "../engine/fxpool.js";
import { input } from "../engine/input.js";
import { VIEW_W, GROUND_Y } from "../config.js";
import { Player } from "./player.js";
import { makeEnemy } from "./enemies.js";
import { Npc, Prop } from "./npc.js";
import { mapById } from "./maps.js";
import { setLevel, drawBackground } from "./level.js";
import { overlap, clamp } from "./physics.js";

const rnd = () => 1 + Math.floor(Math.random() * 9999);
const TALK_RANGE = 24;

// 튜토리얼 단계 (profile.tutorial): 0 걷기 → 1 상자 위로 점프 → 2 허수아비 3번 → 3 표지판 → 4 촌장 → 99 끝
export const TUTORIAL_END = 99;

export class World {
  /**
   * profile: 캐릭터 정보 (돈·진행 상황이 여기에 바로 바뀌어요)
   * entry: "left" | "right" — 어느 쪽 입구로 들어왔는지 (죽으면 이 입구로 돌아와요)
   */
  constructor(profile, mapId, entry = "left") {
    this.profile = profile;
    this.mapId = mapId;
    this.map = mapById(mapId);
    this.entry = entry;
    setLevel(this.map);
    this.width = this.map.width;
    const startX = entry === "right" ? this.width - 30 : 30;
    this.player = new Player(profile, startX);
    this.player.facing = entry === "right" ? -1 : 1;
    this.startX = startX;
    this.enemies = this.map.enemies.map(makeEnemy);
    this.npcs = this.map.npcs.map((d) => new Npc(d, GROUND_Y));
    this.props = this.map.props.map((d) => new Prop(d, GROUND_Y));
    this.coins = [];
    this.fx = new FxPool();
    this.torches = (this.map.torches ?? []).map((x, i) => createFx(torch, { x, y: GROUND_Y - 6, seed: i + 3 }));
    this.camX = clamp(startX - VIEW_W / 2, 0, this.width - VIEW_W);
    this.hitstop = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.time = 0;
    this.near = null;      // 지금 말을 걸 수 있는 NPC·물건
    this.exit = null;      // 맵 끝에 닿으면 { to, entry }
    this.talk = null;      // 대화를 시작해 달라는 요청 (main.js 가 처리) id
    this.state = "play";   // play | dead
    this.deadT = 0;
    this.blockMsgT = 0;
    this.onEvent = null;   // 튜토리얼·이야기 이벤트를 main.js 에 알려요
  }

  get tutorial() { return this.map.tutorial && this.profile.tutorial < TUTORIAL_END; }
  count(k) { this.profile.stats[k] = (this.profile.stats[k] ?? 0) + 1; }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.blockMsgT = Math.max(0, this.blockMsgT - dt);
    if (this.player.frozen) {
      this.player.updateFrozen(dt);
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.time += dt;
    const p = this.player;
    p.update(dt, this);
    this.limitEdges();

    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    for (const n of this.npcs) n.update(dt, p);
    this.updateCoins(dt);
    this.fx.update(dt);
    for (const t of this.torches) t.update(dt);

    // 말 걸기·조사
    this.near = null;
    if (p.alive && p.onGround) {
      let best = TALK_RANGE;
      for (const o of [...this.npcs, ...this.props]) {
        const d = Math.abs(o.x - p.x);
        if (d < best) (best = d), (this.near = o);
      }
    }
    if (this.near && input.hit("interact")) this.talk = this.near.id;

    this.updateTutorial();

    if (this.state === "play" && p.dead) this.state = "dead";
    if (this.state === "dead") this.deadT += dt;

    // 카메라: 바라보는 쪽을 조금 더 보여줘요
    const target = clamp(p.x - VIEW_W * 0.42 + p.facing * 24, 0, this.width - VIEW_W);
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
  }

  // ---- 맵 끝: 다음·이전 맵으로. 아직 못 가는 곳이면 막고 안내해요
  limitEdges() {
    const p = this.player, m = this.map;
    if (p.x >= this.width - 10) {
      const msg = this.tutorial ? "아직 준비가 덜 됐어요. 연습을 마치고 촌장님께 인사하세요." : !m.next ? m.gate : null;
      if (msg) this.block(this.width - 12, msg);
      else this.exit = { to: m.next, entry: "left" };
    } else if (p.x <= 10 && m.prev) this.exit = { to: m.prev, entry: "right" };
  }
  block(x, msg) {
    const p = this.player;
    p.x = Math.min(p.x, x);
    p.vx = Math.min(0, p.vx);
    if (this.blockMsgT <= 0) this.onEvent?.("toast", msg);
    this.blockMsgT = 2.5;
  }

  // ---- 튜토리얼 진행
  updateTutorial() {
    if (!this.tutorial) return;
    const pr = this.profile, p = this.player;
    const step = (n) => {
      pr.tutorial = n;
      this.onEvent?.("tutorial", n);
    };
    if (pr.tutorial === 0 && Math.abs(p.x - this.startX) > 50) step(1);
    if (pr.tutorial === 1 && p.standingOn?.kind === "crate") step(2);
    if (pr.tutorial === 2 && (this.enemies.find((e) => e.type === "scarecrow")?.hits ?? 0) >= 3) step(3);
  }
  /** 이야기에서 오는 신호 (story.js 의 ctx.event) */
  event(name) {
    const pr = this.profile;
    if (name === "readSign" && this.tutorial && pr.tutorial === 3) {
      pr.tutorial = 4;
      this.onEvent?.("tutorial", 4);
    }
    if (name === "tutorialDone") {
      pr.tutorial = TUTORIAL_END;
      this.onEvent?.("tutorial", TUTORIAL_END);
    }
  }

  // ---- 전투
  meleeHit(player, def) {
    const h = def.hitbox, f = player.facing;
    const box = {
      x0: f > 0 ? player.x + h.x0 : player.x - h.x1,
      x1: f > 0 ? player.x + h.x1 : player.x - h.x0,
      y0: player.y + h.y0,
      y1: player.y + h.y1,
    };
    const m = player.mods;
    for (const e of this.enemies) {
      if (e.dead || !overlap(box, e.box())) continue;
      const crit = Math.random() < m.crit;
      const dmg = Math.round(def.damage * m.melee * (crit ? 1.5 : 1) * (0.9 + Math.random() * 0.2));
      this.damageEnemy(e, dmg, f, def.knock, null, crit);
    }
  }

  damageEnemy(e, dmg, dir, knock, palette, crit = false) {
    e.hurt(dmg, dir, knock);
    const [cx, cy] = e.center();
    this.fx.spawn(hitSpark, { x: Math.round(cx - dir * 4), y: Math.round(cy + 10), height: 10, flip: dir < 0, seed: rnd(), ...(palette ? { palette } : {}) });
    if (e.dummy) return; // 허수아비는 숫자가 안 떠요
    this.fx.spawn(damageNumber, { x: Math.round(cx), y: Math.round(cy - 14), text: crit ? `${dmg}!` : `-${dmg}`, ...(crit ? { palette: PAL.gold } : {}), seed: rnd() });
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.count("kills");
      this.fx.spawn(poof, { x: Math.round(e.x), y: Math.round(e.type === "bat" ? e.y + 10 : e.y), seed: rnd() });
      const [a, b] = e.gold ?? [0, 0];
      const n = Math.round((a + Math.floor(Math.random() * (b - a + 1))) * this.player.mods.gold);
      if (n > 0) this.dropCoin(e.x, n);
    }
  }

  damagePlayer(dmg, dir) {
    const p = this.player;
    if (!p.hurt(dmg, dir)) return;
    this.fx.spawn(damageNumber, { x: Math.round(p.x), y: Math.round(p.y - 44), text: `-${dmg}`, palette: PAL.ice, seed: rnd() });
    this.addShake(0.22, 2);
    if (p.dead) this.fx.spawn(poof, { x: Math.round(p.x), y: Math.round(p.y), seed: rnd() });
  }

  // ---- 동전 (돈)
  dropCoin(x, amount) {
    const cx = Math.round(x);
    this.coins.push({ x: cx, y: GROUND_Y, amount, t: 0, fx: createFx(coinSpin, { x: cx, y: GROUND_Y + 8, seed: rnd() }) });
  }
  updateCoins(dt) {
    const p = this.player;
    for (const c of this.coins) {
      c.t += dt;
      c.fx.update(dt);
      // 가까이 가면 빨려 들어와요
      if (p.alive && Math.abs(p.x - c.x) < 16 && c.t > 0.3) {
        c.taken = true;
        this.profile.gold += c.amount;
        this.fx.spawn(collectBurst, { x: c.x, y: GROUND_Y - 8, palette: PAL.gold, seed: rnd() });
        this.fx.spawn(damageNumber, { x: c.x, y: GROUND_Y - 30, text: `+${c.amount}G`, palette: PAL.gold, seed: rnd() });
      }
    }
    this.coins = this.coins.filter((c) => !c.taken);
  }

  addShake(t, amp) {
    if (t >= this.shakeT) {
      this.shakeT = t;
      this.shakeAmp = amp;
    }
  }
  shake() {
    const s = this.player.shake;
    if (this.shakeT <= 0) return s;
    const k = this.shakeAmp * Math.min(1, this.shakeT / 0.2), f = Math.floor(this.shakeT * 60);
    return [s[0] + Math.round(Math.sin(f * 2.4) * k), s[1] + Math.round(Math.cos(f * 3.7) * k * 0.7)];
  }

  // ---- 그리기 (뒤에서 앞으로)
  draw(r) {
    drawBackground(r.bg, this.camX);
    r.begin(this.camX);
    const F = r.frame;
    for (const t of this.torches) t.draw(F);
    for (const o of this.props) o.draw(F);
    for (const n of this.npcs) n.draw(F);
    for (const c of this.coins) c.fx.draw(F);
    this.fx.draw(F, "back");
    for (const e of this.enemies) e.draw(F, this);
    this.player.draw(F);
    this.fx.draw(F, "front");
  }
}
