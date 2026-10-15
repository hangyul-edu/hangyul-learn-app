import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/auth";

/**
 * 로그아웃: the confirmation, then success or failure. The session is revoked
 * server-side first; local cleanup (hardSignOut) waits until the success
 * modal is dismissed — the More screen stays frozen behind the overlay in the
 * meantime. revokeSession resolves on success AND on an already-expired
 * session (4xx, normalized as logged out); it throws only for temporary
 * failures (5xx / network), which keep the member signed in.
 */
export function useLogoutFlow() {
  const nav = useNavigate();
  const { revokeSession, hardSignOut } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const finishedRef = useRef(false);

  async function confirm() {
    if (loading) return; // guard duplicate taps / requests
    setLoading(true);
    try {
      await revokeSession();
      setLoading(false);
      setConfirmOpen(false); // no stacking under the success modal
      setDoneOpen(true);
    } catch {
      setLoading(false);
      setConfirmOpen(false); // replace confirmation with the failure modal
      setFailOpen(true);
    }
  }

  // 확인 on the success modal: the single terminal action, run once.
  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // hardSignOut clears tokens, current-user, and every user-scoped query cache.
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  return {
    confirmOpen,
    open: () => setConfirmOpen(true),
    cancel: () => !loading && setConfirmOpen(false),
    loading,
    confirm,
    doneOpen,
    finish,
    failOpen,
    closeFail: () => setFailOpen(false),
  };
}
