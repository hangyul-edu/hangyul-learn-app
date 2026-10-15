import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { takePendingReauth, type PendingReauth } from "../../hooks/socialLogin";
import { useTranslation } from "../../i18n";
import { ApiError, NetworkError, errorMessage } from "../../lib/http";
import type { SocialProvider } from "../../lib/types";

// A temporary / unexpected failure (network, timeout, 5xx, unknown) gets the
// dedicated failure modal; a 4xx (wrong password / validation) stays inline in
// the password modal. We never assume success on an ambiguous error, so a lost
// response biases to "failure → retry" (never a false completion modal).
function isTemporaryFailure(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  if (e instanceof ApiError) return e.status >= 500;
  return true; // unknown, non-ApiError → treat as retryable
}

/**
 * 회원 탈퇴: the warning, then the confirmation the account supports — its
 * password, or (an account created by social login) signing in again with
 * the provider — and the completion or failure modal. Local cleanup waits
 * until the completion modal is dismissed.
 */
export function useWithdrawFlow() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { hardSignOut } = useAuth();
  const [warnOpen, setWarnOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [failOpen, setFailOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const finishedRef = useRef(false);
  // Accounts without a password (social sign-up) confirm by signing in again.
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthProviders, setReauthProviders] = useState<SocialProvider[]>([]);
  const [reauthError, setReauthError] = useState<string | null>(null);
  // Which confirmation step the failure modal's 확인 returns to.
  const [failReturn, setFailReturn] = useState<"password" | "reauth" | null>(null);
  const pendingRan = useRef(false);

  // The warning's 탈퇴: ask the server how this account confirms a deletion
  // (read-only), then advance to the password step — or, for an account
  // created by social login, to the provider re-authentication step.
  async function toConfirmStep() {
    if (methodsLoading) return;
    setMethodsLoading(true);
    try {
      const methods = await authApi.deletionMethods();
      setWarnOpen(false);
      if (methods.has_password) {
        setPwError(null);
        setPwOpen(true);
      } else {
        setReauthProviders(methods.web_providers);
        setReauthError(null);
        setReauthOpen(true);
      }
    } catch {
      setWarnOpen(false);
      setFailReturn(null);
      setFailOpen(true);
    } finally {
      setMethodsLoading(false);
    }
  }

  /** User-safe text for a failed re-authentication. */
  function reauthErrorText(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === "auth.social_identity_mismatch") return t("withdrawReauth.mismatch");
      if (e.code.startsWith("auth.reauthentication_")) return t("withdrawReauth.expired");
      return errorMessage(e);
    }
    return t("withdrawReauth.failed");
  }

  function socialErrorText(code: string): string {
    if (code === "cancelled") return t("withdrawReauth.cancelled");
    if (code === "provider_unavailable") return t("withdrawReauth.providerUnavailable");
    if (code === "invalid_state") return t("withdrawReauth.expired");
    return t("withdrawReauth.failed");
  }

  async function reopenReauth(error: string | null) {
    try {
      setReauthProviders((await authApi.deletionMethods()).web_providers);
    } catch {
      /* keep what we have; the error below still explains */
    }
    setReauthError(error);
    setReauthOpen(true);
  }

  // Back from the provider (`/auth/complete` stored the outcome): finish the
  // deletion with the single-use re-authentication code, or explain why not.
  async function withdrawWithReauth(pending: PendingReauth) {
    if ("error" in pending) {
      await reopenReauth(socialErrorText(pending.error));
      return;
    }
    setReauthError(null);
    setReauthOpen(true);
    setWithdrawing(true);
    try {
      await authApi.deleteAccount(pending);
      setWithdrawing(false);
      setReauthOpen(false);
      setDoneOpen(true);
    } catch (e) {
      setWithdrawing(false);
      if (isTemporaryFailure(e)) {
        setReauthOpen(false);
        setFailReturn("reauth");
        setFailOpen(true);
        // The code was single use; a retry needs a fresh sign-in.
        void authApi
          .deletionMethods()
          .then((m) => setReauthProviders(m.web_providers))
          .catch(() => undefined);
      } else {
        await reopenReauth(reauthErrorText(e));
      }
    }
  }

  useEffect(() => {
    if (pendingRan.current) return;
    pendingRan.current = true;
    const pending = takePendingReauth();
    if (pending) void withdrawWithReauth(pending);
    // Intentionally once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Password step's 탈퇴: server verifies the password and withdraws atomically.
  // On terminal success we show the completion modal (still a frozen, overlay-
  // blocked background) and defer local cleanup until the user dismisses it.
  async function withdraw(password: string) {
    if (withdrawing) return; // guard duplicate taps on the irreversible request
    setWithdrawing(true);
    setPwError(null);
    try {
      await authApi.deleteAccount({ password });
      setWithdrawing(false);
      setPwOpen(false); // no stacking under the completion modal
      setDoneOpen(true);
    } catch (e) {
      setWithdrawing(false);
      if (isTemporaryFailure(e)) {
        // Replace the password modal with the failure modal (one interactive
        // layer). Account + session untouched; the user can retry from 확인.
        setPwOpen(false);
        setFailReturn("password");
        setFailOpen(true);
      } else {
        setPwError(errorMessage(e)); // inline wrong-password / validation feedback
      }
    }
  }

  // 확인 on the completion modal: the single terminal action, run once.
  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // hardSignOut clears tokens, current-user, and every user-scoped query cache.
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  return {
    warnOpen,
    open: () => setWarnOpen(true),
    cancelWarn: () => setWarnOpen(false),
    methodsLoading,
    toConfirmStep,
    withdrawing,
    reauthOpen,
    reauthProviders,
    reauthError,
    cancelReauth: () => {
      if (withdrawing) return;
      setReauthOpen(false);
      setReauthError(null);
    },
    pwOpen,
    pwError,
    cancelPassword: () => {
      if (withdrawing) return;
      setPwOpen(false);
      setPwError(null);
    },
    withdraw,
    failOpen,
    // 확인 returns to the confirmation step in a clean, retry-ready state; no
    // API, no logout, no navigation.
    closeFail: () => {
      setFailOpen(false);
      if (failReturn === "password") setPwOpen(true);
      else if (failReturn === "reauth") setReauthOpen(true);
    },
    doneOpen,
    finish,
  };
}
