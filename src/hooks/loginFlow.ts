import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import type { TokenResponse } from "../lib/types";

/** Social signup's terms step — after a first social login, before the profile. */
export const SOCIAL_TERMS_PATH = "/signup/terms";

/** Apply tokens, load the profile, and route by the server's next_step. */
export function useLoginFlow() {
  const { applyTokens, bootstrapMe } = useAuth();
  const nav = useNavigate();
  return async function completeLogin(token: TokenResponse, autoLogin: boolean) {
    applyTokens(token, autoLogin);
    const me = await bootstrapMe();
    const step = token.next_step;
    if (step === "terms_agreement" || me.terms_agreement_pending) {
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
