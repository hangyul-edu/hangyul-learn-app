import mascotTangerine from "../../assets/brand/ask-mascot-tangerine.svg";
import mascotDot868 from "../../assets/brand/ask-mascot-dot-868.svg";
import mascotDot878 from "../../assets/brand/ask-mascot-dot-878.svg";
import mascotDot879 from "../../assets/brand/ask-mascot-dot-879.svg";
import mascotDot881 from "../../assets/brand/ask-mascot-dot-881.svg";

/**
 * The 45px tutor mascot that opens 물어보기: a white disc with the tangerine
 * (turned 9.31°) and its four highlights clipped to it, inside a 3px ring
 * running #FFDC7E → #FFAC00 → #FF6700 — the same ring as the chatbot button
 * on the Classes and Personalized tabs (chatbot-fab.svg), so the tutor looks
 * the same wherever it appears (the player, COU-014..019's practice screens).
 *
 * Decorative: the button that holds it carries the label.
 */
export function AskMascot() {
  return (
    <span className="lecp__mascot" aria-hidden="true">
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
