// 게임 전체에서 쓰는 숫자. 밸런스를 바꿀 때는 여기와 src/game/classes.js 를 먼저 보세요.

export const VIEW_W = 320;          // 게임 화면의 픽셀 해상도 (가로)
export const VIEW_H = 180;          // 게임 화면의 픽셀 해상도 (세로)
export const SCALE = 4;             // 화면에 그릴 때 키우는 배율 (320x180 → 1280x720)

export const WORLD_W = 1800;        // 스테이지 길이 (px)
export const GROUND_Y = 150;        // 땅 높이 (발이 닿는 y)
export const GRAVITY = 720;         // 중력 (px/s²)
export const MAX_FALL = 420;        // 최대 낙하 속도

export const PLAYER_INVULN = 0.9;   // 맞은 뒤 무적 시간 (초)
export const HEART_DROP = 0.2;      // 적이 하트를 떨어뜨릴 확률
export const HEART_HEAL = 25;       // 하트 회복량
