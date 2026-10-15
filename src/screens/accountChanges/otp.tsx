import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";

/**
 * The clock of a requested code: seconds left before it expires and before a
 * resend is allowed, both recomputed from the server's timestamps (so they
 * survive re-renders and backgrounding) rather than decremented blindly. It
 * stops once the code is confirmed (`token`), so no timer is left ticking.
 */
export function useOtpClock({
  vid,
  expiresAt,
  resendAt,
  token,
}: {
  vid: string | null;
  expiresAt: string | null;
  resendAt: string | null;
  token: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!vid || !expiresAt || token) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [vid, expiresAt, token]);

  const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const resendIn = resendAt ? Math.max(0, Math.floor((new Date(resendAt).getTime() - now) / 1000)) : 0;
  return { remaining, resendIn, expired: !!vid && remaining <= 0 && !token };
}

/** The teal MM:SS inside the code field, announced as minutes and seconds. */
export function CodeTimer({ remaining, label }: { remaining: number; label: string }) {
  const { t } = useTranslation();
  return (
    <span
      className="pchg__timer"
      role="timer"
      aria-label={t("accountChanges.remainingA11y", { m: Math.floor(remaining / 60), s: remaining % 60 })}
    >
      {label}
    </span>
  );
}
