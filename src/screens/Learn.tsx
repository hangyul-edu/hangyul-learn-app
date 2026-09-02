import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { TopBar } from "../components/layout/Screen";
import { Card } from "../components/ui/kit";

export function Learn() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="screen">
      <TopBar title={t("learn.title")} />
      <div className="screen__body screen__body--nav">
        <div className="stack" style={{ gap: 14 }}>
          <Card variant="brand" onClick={() => nav("/learn/conversation")} padLg>
            <div className="row">
              <span style={{ fontSize: 40 }}>💬</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 19 }}>{t("learn.conversation")}</div>
                <div style={{ opacity: 0.9, fontSize: 13 }}>{t("learn.conversationDesc")}</div>
              </div>
              <span style={{ fontSize: 22 }}>›</span>
            </div>
          </Card>

          <Card onClick={() => nav("/learn/topik")} padLg className="card--soft">
            <div className="row">
              <span style={{ fontSize: 40 }}>📝</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 19 }}>{t("learn.topik")}</div>
                <div className="muted" style={{ fontSize: 13 }}>{t("learn.topikDesc")}</div>
              </div>
              <span className="listrow__chev">›</span>
            </div>
          </Card>

          <div className="section-title">{t("learn.more")}</div>
          <button className="listrow" onClick={() => nav("/courses")}>
            <span style={{ fontSize: 24 }}>🎬</span>
            <div className="listrow__main">
              <div className="listrow__title">{t("learn.courses")}</div>
              <div className="listrow__sub">{t("learn.coursesDesc")}</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/exams")}>
            <span style={{ fontSize: 24 }}>🎓</span>
            <div className="listrow__main">
              <div className="listrow__title">{t("learn.exams")}</div>
              <div className="listrow__sub">{t("learn.examsDesc")}</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/recommend/sentences")}>
            <span style={{ fontSize: 24 }}>✨</span>
            <div className="listrow__main">
              <div className="listrow__title">{t("learn.recommendations")}</div>
              <div className="listrow__sub">{t("learn.recommendationsDesc")}</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/ai")}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div className="listrow__main">
              <div className="listrow__title">{t("learn.aiTutor")}</div>
              <div className="listrow__sub">{t("learn.aiTutorDesc")}</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
          <button className="listrow" onClick={() => nav("/saved")}>
            <span style={{ fontSize: 24 }}>🔖</span>
            <div className="listrow__main">
              <div className="listrow__title">{t("learn.saved")}</div>
              <div className="listrow__sub">{t("learn.savedDesc")}</div>
            </div>
            <span className="listrow__chev">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
