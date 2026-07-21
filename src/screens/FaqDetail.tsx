import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supportApi } from "../api/endpoints";
import { ApiError, errorMessage } from "../lib/http";
import { EmptyState, ErrorState } from "../components/ui/states";
import { FaqHeader } from "../components/faq/FaqPieces";
import { SupportChatButton } from "../components/faq/SupportChatButton";
import { AnswerBody } from "../components/faq/AnswerBody";

export function FaqDetail() {
  const { faqId = "" } = useParams();

  // Load the full FAQ by its stable id — the detail page is self-sufficient
  // (direct link / refresh / deep link work), it never relies on route state.
  const faq = useQuery({
    queryKey: ["faq", faqId],
    queryFn: () => supportApi.faq(faqId),
    enabled: !!faqId,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const notFound = faq.error instanceof ApiError && faq.error.status === 404;

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
              title="찾을 수 없는 질문이에요"
              text="삭제되었거나 주소가 올바르지 않아요."
            />
          ) : faq.isError ? (
            <ErrorState message={errorMessage(faq.error)} onRetry={() => faq.refetch()} />
          ) : faq.data ? (
            <>
              <h2 className="faq__detail-q">
                <span className="faq__q-prefix" aria-hidden="true">Q.</span>
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
