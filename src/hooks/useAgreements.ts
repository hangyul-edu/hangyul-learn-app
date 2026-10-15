import { useState } from "react";
import { AGREEMENTS, NO_AGREEMENTS, REQUIRED_AGREEMENTS, type AgreeKey, type Agreements } from "../lib/signupAgreements";

/** The signup agreements' ticks: one row at a time, or all at once. */
export function useAgreements() {
  const [agree, setAgree] = useState<Agreements>(NO_AGREEMENTS);
  /** Every required consent is given — signup may continue. */
  const requiredDone = REQUIRED_AGREEMENTS.every((k) => agree[k]);
  /** "Agree to all" reflects and toggles every row, optional ones included. */
  const everyAgreed = AGREEMENTS.every((a) => agree[a.key]);
  return {
    agree,
    requiredDone,
    everyAgreed,
    toggle: (key: AgreeKey) => setAgree((s) => ({ ...s, [key]: !s[key] })),
    toggleAll: () => {
      const next = !everyAgreed;
      setAgree(Object.fromEntries(AGREEMENTS.map((a) => [a.key, next])) as Agreements);
    },
  };
}
