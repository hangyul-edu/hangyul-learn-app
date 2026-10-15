import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { supportApi } from "../api/endpoints";
import { errorMessage, isNotFound, retryUnlessNotFound } from "../lib/http";
import { EmptyState, ErrorState } from "../components/ui/states";
import { FaqHeader } from "../components/faq/FaqPieces";
import { SupportChatButton } from "../components/faq/SupportChatButton";
import { AnswerBody } from "../components/faq/AnswerBody";

export function FaqDetail() {
  const { t, language } = useTranslation();
  const { faqId = "" } = useParams();

  // Load the full FAQ by its stable id — the detail page is self-sufficient
  // (direct link / refresh / deep link work), it never relies on route state.
  const faq = useQuery({
    // Language is part of the key so switching it re-fetches this FAQ in the
    // newly selected language instead of showing the cached one.
    queryKey: ["faq", faqId, language],
    queryFn: () => supportApi.faq(faqId, language),
    enabled: !!faqId,
    retry: retryUnlessNotFound,
  });

  const notFound = isNotFound(faq.error);

  return (
    <div className="faq faq--detail">
      <FaqHeader />

      <div className="faq__scroll">
        <div className="faq__detail">
          {faq.isLoading ? (
            <FaqDetailSkeleton />
          ) : notFound ? (
            <EmptyState
              emoji="🗑️"
              title={t("faq.notFoundTitle")}
              text={t("faq.notFoundBody")}
            />
          ) : faq.isError ? (
            <ErrorState message={errorMessage(faq.error)} onRetry={() => faq.refetch()} />
          ) : faq.data ? (
            <>
              <h2 className="faq__detail-q">
                <span className="faq__detail-q-prefix" aria-hidden="true">Q.</span>
                <span>{faq.data.question}</span>
              </h2>
              <div className="faq__answer">
                <AnswerBody text={faq.data.answer} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <SupportChatButton />
    </div>
  );
}

function FaqDetailSkeleton() {
  return (
    <div className="faq__detail-skeleton" aria-hidden="true">
      <div className="skeleton" style={{ height: 26, width: "82%", borderRadius: 8 }} />
      <div className="skeleton" style={{ height: 26, width: "56%", borderRadius: 8, marginTop: 8 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 18, marginTop: 20 }} />
    </div>
  );
}
