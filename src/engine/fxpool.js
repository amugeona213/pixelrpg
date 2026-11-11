// 한 번 터지고 사라지는 이펙트들(타격 불꽃, 데미지 숫자, 폭발...)을 모아 관리해요.

import { createFx } from "./px.js";

export class FxPool {
  constructor() {
    this.list = [];
  }
  spawn(mod, opts = {}) {
    const fx = createFx(mod, opts);
    this.list.push(fx);
    return fx;
  }
  update(dt) {
    for (const f of this.list) f.update(dt);
    this.list = this.list.filter((f) => !f.done());
  }
  draw(frame, layer) {
    for (const f of this.list) f.draw(frame, layer);
  }
  clear() {
    this.list.length = 0;
  }
}
