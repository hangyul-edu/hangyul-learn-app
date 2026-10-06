import mascotTangerine from "../../assets/brand/ask-mascot-tangerine.svg";
import mascotDot868 from "../../assets/brand/ask-mascot-dot-868.svg";
import mascotDot878 from "../../assets/brand/ask-mascot-dot-878.svg";
import mascotDot879 from "../../assets/brand/ask-mascot-dot-879.svg";
import mascotDot881 from "../../assets/brand/ask-mascot-dot-881.svg";

/**
 * The 45px tutor mascot that opens 물어보기: a white disc with the tangerine
 * (turned 9.31°) and its four highlights clipped to it.
 *
 * - `ring="gradient"` — the lecture player's 230:7053: a 3px outside stroke
 *   running #FFDC7E → #FFAC00 → #FF6700.
 * - `ring="solid"` — the practice screens' 511:9103 (COU-014..019): a solid
 *   3px #FFDC7E stroke.
 *
 * Decorative: the button that holds it carries the label.
 */
export function AskMascot({ ring = "gradient" }: { ring?: "gradient" | "solid" }) {
  return (
    <span className={`lecp__mascot${ring === "solid" ? " lecp__mascot--solid" : ""}`} aria-hidden="true">
      <span className="lecp__mascot-art">
        <span className="lecp__mascot-body">
          <span className="lecp__mascot-turn">
            <img src={mascotTangerine} alt="" width={45.284} height={53.099} />
          </span>
        </span>
        <img className="lecp__mascot-dot lecp__mascot-dot--868" src={mascotDot868} alt="" />
        <img className="lecp__mascot-dot lecp__mascot-dot--879" src={mascotDot879} alt="" />
        <img className="lecp__mascot-dot lecp__mascot-dot--881" src={mascotDot881} alt="" />
        <img className="lecp__mascot-dot lecp__mascot-dot--878" src={mascotDot878} alt="" />
      </span>
    </span>
  );
}
