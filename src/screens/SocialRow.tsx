import { GoogleIcon, AppleIcon, KakaoIcon } from "../components/brand/AuthBrand";
import { useSocialLogin } from "../hooks/socialLogin";
import type { SocialProvider } from "../lib/types";

const PROVIDERS: { id: SocialProvider; label: string; bg: string; color: string; icon: JSX.Element }[] = [
  { id: "google", label: "Google", bg: "#fff", color: "#3c4043", icon: <GoogleIcon size={18} /> },
  { id: "apple", label: "Apple", bg: "#111", color: "#fff", icon: <AppleIcon size={18} /> },
  { id: "kakao", label: "Kakao", bg: "#FEE500", color: "#3c1e1e", icon: <KakaoIcon size={18} /> },
];

/**
 * Compact social-sign-in row used on the login screen. The auth flow itself
 * lives in `useSocialLogin`; this is just the presentation.
 */
export function SocialRow() {
  const social = useSocialLogin();
  return (
    <>
      <div className="grid-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className="btn"
            style={{ background: p.bg, color: p.color, border: "1px solid var(--border)", height: 52 }}
            onClick={() => social.start(p.id)}
            aria-label={`${p.label} 계정으로 계속하기`}
          >
            {p.icon}
            <span style={{ fontSize: 13 }}>{p.label}</span>
          </button>
        ))}
      </div>
      {social.element}
    </>
  );
}
