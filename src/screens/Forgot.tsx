import { useLocation } from "react-router-dom";
import { FindEmail } from "./FindEmail";
import { FindPassword } from "./FindPassword";

/**
 * `/forgot` dispatcher. Both recovery flows have their own faithful full-screen
 * layouts; this routes to the right one based on the navigation-state `mode`
 * ("email" — find email; "password" — find password). Callers (Login, the
 * email-recovery result) navigate to `/forgot` with the desired mode.
 */
export function Forgot() {
  const location = useLocation();
  const mode = (location.state as { mode?: "email" | "password" } | null)?.mode;
  return mode === "password" ? <FindPassword /> : <FindEmail />;
}
