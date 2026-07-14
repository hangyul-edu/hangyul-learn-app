import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/Screen";
import { Card } from "../components/ui/kit";

export function Learn() {
  const nav = useNavigate();
  return (
    <div className="screen">
      <TopBar title="학습" />
      <div className="screen__body screen__body--nav">
        <div className="stack" style={{ gap: 14 }}>
          <Card variant="brand" onClick={() => nav("/learn/conversation")} padLg>
            <div className="row">
              <span style={{ fontSize: 40 }}>💬</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 19 }}>회화 학습</div>
                <div style={{ opacity: 0.9, fontSize: 13 }}>문장을 듣고 따라 말하며 배워요</div>
              </div>
              <span style={{ fontSize: 22 }}>›</span>
            </div>
          </Card>

          <Card onClick={() => nav("/learn/topik")} padLg className="card--soft">
            <div className="row">
              <span style={{ fontSize: 40 }}>📝</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 19 }}>TOPIK 학습</div>
                <div className="muted" style={{ fontSize: 13 }}>급수별 문제로 실전 감각을</div>
              </div>
              <span className="listrow__chev">›</span>
            </div>
          </Card>

          <div className="section-title">더 배우기</div>
          <button className="listrow" onClick={() => nav("/courses")}>
            <span style={{ fontSize: 24 }}>🎬</span>
            <div className="listrow__main">
              <div className="listrow__title">강의</div>
              <div className="listrow__sub">코스별 영상 강의로 차근차근</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/exams")}>
            <span style={{ fontSize: 24 }}>🎓</span>
            <div className="listrow__main">
              <div className="listrow__title">TOPIK 기출 모의고사</div>
              <div className="listrow__sub">실제 기출로 실전 감각 키우기</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/recommend/sentences")}>
            <span style={{ fontSize: 24 }}>✨</span>
            <div className="listrow__main">
              <div className="listrow__title">AI 추천 문장</div>
              <div className="listrow__sub">원하는 상황의 맞춤 문장 받기</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/ai")}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div className="listrow__main">
              <div className="listrow__title">AI 튜터와 대화</div>
              <div className="listrow__sub">상황별 문장을 추천받고 대화해요</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/saved")}>
            <span style={{ fontSize: 24 }}>🔖</span>
            <div className="listrow__main">
              <div className="listrow__title">저장 · 복습</div>
              <div className="listrow__sub">즐겨찾기와 오답을 모아봐요</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
