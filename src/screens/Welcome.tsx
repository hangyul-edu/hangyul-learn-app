import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/kit";
import { APP_NAME } from "../lib/config";
import { SocialRow } from "./SocialRow";

export function Welcome() {
  const nav = useNavigate();
  return (
    <div className="screen">
      <div className="screen__body" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div
            style={{
              width: 96,
              height: 96,
              margin: "0 auto 18px",
              borderRadius: 30,
              background: "var(--brand-gradient)",
              display: "grid",
              placeItems: "center",
              fontSize: 52,
              boxShadow: "var(--shadow-brand)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
            }}
          >
            한
          </div>
          <h1 style={{ fontSize: 30 }}>{APP_NAME}</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6 }}>
            매일 조금씩, 즐겁게 배우는 한국어.
            <br />
            회화부터 TOPIK까지 나만의 속도로.
          </p>
        </div>

        <div
          className="card card--soft"
          style={{ marginBottom: 22, display: "flex", gap: 14, alignItems: "center" }}
        >
          <div style={{ fontSize: 34 }}>🔥</div>
          <div>
            <div style={{ fontWeight: 800 }}>매일 학습 스트릭</div>
            <div className="muted" style={{ fontSize: 13 }}>친구들과 리그에서 함께 성장해요</div>
          </div>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <Button size="lg" block onClick={() => nav("/signup")}>
            이메일로 시작하기
          </Button>
          <Button variant="ghost" size="lg" block onClick={() => nav("/login")}>
            이미 계정이 있어요
          </Button>
        </div>

        <div className="row" style={{ margin: "22px 0 14px" }}>
          <div className="divider" style={{ flex: 1 }} />
          <span className="dim" style={{ fontSize: 12 }}>또는</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>
        <SocialRow />
      </div>
    </div>
  );
}
