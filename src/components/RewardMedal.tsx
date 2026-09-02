import medalArt from "../assets/brand/reward-medal.png";

/**
 * The 106px reward badge shared by the review-complete (TAL-047, 794:76248) and
 * session-complete (TAL-033, 1938:28527) modals: a dashed ring around the
 * ribboned medal, exported from Figma. The points pill (794:76258) rides its
 * top-right corner and is server-authoritative — never hardcoded.
 */
export function RewardMedal({ points }: { points: number }) {
  return (
    <div className="scomp__medal" aria-hidden="true">
      <img className="scomp__medal-img" src={medalArt} alt="" width={106} height={106} />
      <span className="scomp__points">+{points}P</span>
    </div>
  );
}
