// pixelfx 를 한 곳에서 불러와요. 게임 코드는 vendor 경로를 직접 쓰지 말고 여기서 가져가세요.

export * from "../../vendor/pixelfx/src/core/index.js";

// 이펙트 모듈 (필요한 것만)
export * as swordSlash from "../../vendor/pixelfx/src/fx/melee/sword-slash.js";
export * as spinSlash from "../../vendor/pixelfx/src/fx/melee/spin-slash.js";
export * as arrowShot from "../../vendor/pixelfx/src/fx/moves/arrow-shot.js";
export * as fireballThrow from "../../vendor/pixelfx/src/fx/moves/fireball-throw.js";
export * as arrowFx from "../../vendor/pixelfx/src/fx/projectiles/arrow.js";
export * as fireballFx from "../../vendor/pixelfx/src/fx/fire/fireball.js";
export * as smallExplosion from "../../vendor/pixelfx/src/fx/explosions/small-explosion.js";
export * as hitSpark from "../../vendor/pixelfx/src/fx/impacts/hit-spark.js";
export * as damageNumber from "../../vendor/pixelfx/src/fx/ui/damage-number.js";
export * as poof from "../../vendor/pixelfx/src/fx/spawn/poof.js";
export * as batFx from "../../vendor/pixelfx/src/fx/critters/bat.js";
export * as heartPickup from "../../vendor/pixelfx/src/fx/pickups/heart-pickup.js";
export * as collectBurst from "../../vendor/pixelfx/src/fx/pickups/collect-burst.js";
export * as torch from "../../vendor/pixelfx/src/fx/fire/torch.js";
export * as portal from "../../vendor/pixelfx/src/fx/arcane/portal.js";
export * as slimeFx from "../../vendor/pixelfx/src/fx/critters/slime.js";
export * as coinSpin from "../../vendor/pixelfx/src/fx/pickups/coin-spin.js";
