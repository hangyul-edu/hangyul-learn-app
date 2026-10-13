import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import type { Me, NextStep, TokenResponse } from "../lib/types";

/** Social signup's terms step — after the phone step, before the profile. */
export const SOCIAL_TERMS_PATH = "/signup/terms";
/** Social signup's phone step — first after a social sign-in for an account
 *  with no phone (a new one, or an existing one that never had a number). */
export const SOCIAL_PHONE_PATH = "/setup/phone";

/** The screen for a journey step the server returned (`next_step`). */
export function pathForStep(step: NextStep): string {
  switch (step) {
    case "terms_agreement":
      return SOCIAL_TERMS_PATH;
    case "phone_verification":
      return SOCIAL_PHONE_PATH;
    case "profile_registration":
      return "/setup/profile";
    case "onboarding":
      return "/setup/onboarding";
    default:
      return "/home";
  }
}

/** Where a signed-in member's setup continues, read from their profile — for a
 *  step that has just finished and has no `next_step` of its own. */
export function nextSetupPath(me: Me): string {
  if (me.phone_verification_pending) return SOCIAL_PHONE_PATH;
  if (me.terms_agreement_pending) return SOCIAL_TERMS_PATH;
  if (!me.nickname) return "/setup/profile";
  if (!me.onboarding_completed) return "/setup/onboarding";
  return "/home";
}

/** Apply tokens, load the profile, and route by the server's next_step. */
export function useLoginFlow() {
  const { applyTokens, bootstrapMe } = useAuth();
  const nav = useNavigate();
  return async function completeLogin(token: TokenResponse, autoLogin: boolean) {
    applyTokens(token, autoLogin);
    const me = await bootstrapMe();
    const step = token.next_step;
    if (step === "phone_verification" || me.phone_verification_pending) {
      nav(SOCIAL_PHONE_PATH, { replace: true });
    } else if (step === "terms_agreement" || me.terms_agreement_pending) {
      nav(SOCIAL_TERMS_PATH, { replace: true });
    } else if (step === "profile_registration" || !me.nickname) {
      nav("/setup/profile", { replace: true });
    } else if (step === "onboarding") {
      nav("/setup/onboarding", { replace: true });
    } else {
      nav("/home", { replace: true });
    }
  };
}
