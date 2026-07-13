import { useParams } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { POLICIES, type PolicyId } from "../lib/policies";

/** Renders the body of a legal document. Reused by the route screen and the
 *  sign-up agreement sheet so both stay in sync. */
export function PolicyBody({ id }: { id: PolicyId }) {
  const doc = POLICIES[id];
  return (
    <div className="policy">
      {doc.intro && <p className="policy__intro">{doc.intro}</p>}
      <p className="policy__updated">시행일 {doc.updated}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="policy__section">
          <h3 className="policy__heading">{s.heading}</h3>
          {s.body.map((p, i) => (
            <p key={i} className="policy__para">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

const TITLES: Record<PolicyId, string> = {
  terms: POLICIES.terms.title,
  privacy: POLICIES.privacy.title,
  "third-party": POLICIES["third-party"].title,
};

/** Standalone /policy/:doc screen. */
export function Policy() {
  const { doc } = useParams<{ doc: string }>();
  const id = (doc && doc in POLICIES ? doc : "terms") as PolicyId;
  return (
    <Screen title={TITLES[id]} back>
      <PolicyBody id={id} />
    </Screen>
  );
}
