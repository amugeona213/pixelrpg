// 화면 출력. 게임은 320x180 픽셀 프레임 하나에 그리고, 마지막에 4배로 키워 큰 캔버스에 올려요.
// 배경은 bg 배열에 따로 칠하고, 캐릭터·이펙트는 frame 에 그려요. composite 가 둘을 합쳐요.

import { createFrame, clearFrame, composite } from "./px.js";
import { VIEW_W, VIEW_H, SCALE } from "../config.js";

export function createRenderer(canvas) {
  canvas.width = VIEW_W * SCALE;
  canvas.height = VIEW_H * SCALE;
  const ctx = canvas.getContext("2d");
  const low = document.createElement("canvas");
  low.width = VIEW_W;
  low.height = VIEW_H;
  const lctx = low.getContext("2d");
  const img = lctx.createImageData(VIEW_W, VIEW_H);
  const frame = createFrame(VIEW_W, VIEW_H);
  const bg = new Uint32Array(VIEW_W * VIEW_H);

  // 창 크기에 맞춰 화면을 키워요 (16:9 비율 유지). 휴대폰은 주소창이 들어가고 나와서 visualViewport 를 써요.
  function fit() {
    const vw = window.visualViewport?.width ?? innerWidth;
    const vh = window.visualViewport?.height ?? innerHeight;
    const k = Math.min(vw / canvas.width, vh / canvas.height);
    const kk = k >= 1 ? Math.floor(k * 4) / 4 : k;
    canvas.style.width = `${Math.floor(canvas.width * kk)}px`;
    canvas.style.height = `${Math.floor(canvas.height * kk)}px`;
  }
  addEventListener("resize", fit);
  addEventListener("orientationchange", () => setTimeout(fit, 250));
  window.visualViewport?.addEventListener("resize", fit);
  fit();

  return {
    ctx,
    frame,
    bg,
    /** 화면을 누른 위치(clientX, clientY)를 큰 캔버스 좌표(1280x720)로 바꿔요. */
    toCanvas(cx, cy) {
      const b = canvas.getBoundingClientRect();
      return [((cx - b.left) / b.width) * canvas.width, ((cy - b.top) / b.height) * canvas.height];
    },
    /** 새 프레임 시작: 카메라 위치를 정하고 그림을 지워요. */
    begin(camX, camY = 0) {
      frame.ox = Math.round(camX);
      frame.oy = Math.round(camY);
      clearFrame(frame);
    },
    /** 프레임을 화면에 올려요. shake: 흔들림 [x, y] (게임 픽셀 단위). */
    present(shake = [0, 0]) {
      composite(frame, img.data, bg);
      lctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#07060b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(low, shake[0] * SCALE, shake[1] * SCALE, canvas.width, canvas.height);
    },
  };
}
