import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import type { TokenResponse } from "../lib/types";

/** Apply tokens, load the profile, and route by the server's next_step. */
export function useLoginFlow() {
  const { applyTokens, bootstrapMe } = useAuth();
  const nav = useNavigate();
  return async function completeLogin(token: TokenResponse, autoLogin: boolean) {
    applyTokens(token, autoLogin);
    const me = await bootstrapMe();
    const step = token.next_step;
    if (step === "profile_registration" || !me.nickname) {
      nav("/setup/profile", { replace: true });
    } else if (step === "onboarding") {
      nav("/setup/onboarding", { replace: true });
    } else {
      nav("/home", { replace: true });
    }
  };
}
