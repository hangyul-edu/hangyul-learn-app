import { useEffect, useRef } from "react";
import { SkeletonList } from "../ui/states";
import { DetailHeader } from "../DetailHeader";

/** Shared FAQ header: back arrow left, centered "FAQ" title, no right action. */
export function FaqHeader({ onBack }: { onBack?: () => void }) {
  return <DetailHeader title="FAQ" onBack={onBack} />;
}

/** A single question row — gray rounded card, blue "Q." prefix. */
export function QuestionCard({ question, onClick }: { question: string; onClick: () => void }) {
  return (
    <button type="button" className="faq__q-card" onClick={onClick}>
      <span className="faq__q-prefix" aria-hidden="true">Q.</span>
      <span className="faq__q-text">{question}</span>
    </button>
  );
}

/**
 * Invisible sentinel that triggers `onLoadMore` when scrolled near, for cursor
 * pagination. Renders nothing (beyond a loading skeleton) once there is no
 * next page.
 */
export function LoadMoreSentinel({
  hasNext,
  isFetching,
  onLoadMore,
}: {
  hasNext: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) onLoadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, isFetching, onLoadMore]);

  if (!hasNext) return null;
  return (
    <div ref={ref} className="faq__sentinel" aria-hidden="true">
      {isFetching && <SkeletonList rows={2} height={62} />}
    </div>
  );
}
