import type { ReactNode } from "react";
import { Button } from "./kit";

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`spinner ${large ? "spinner--lg" : ""}`} />;
}

export function LoadingState({ text = "불러오는 중…" }: { text?: string }) {
  return (
    <div className="state">
      <Spinner large />
      <div className="state__text">{text}</div>
    </div>
  );
}

export function EmptyState({
  emoji = "🗂️",
  title,
  text,
  action,
}: {
  emoji?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <div className="state__emoji">{emoji}</div>
      <div className="state__title">{title}</div>
      {text && <div className="state__text">{text}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <div className="state__emoji">😵</div>
      <div className="state__title">문제가 생겼어요</div>
      <div className="state__text">{message}</div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function SkeletonList({ rows = 4, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div className="stack">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 16 }} />
      ))}
    </div>
  );
}

/** Renders loading / error / empty / content for an async query result. */
export function Async<T>({
  loading,
  error,
  data,
  onRetry,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  loading: boolean;
  error: unknown;
  data: T | undefined;
  onRetry?: () => void;
  isEmpty?: (d: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (loading && data === undefined) return <>{skeleton ?? <LoadingState />}</>;
  if (error && data === undefined)
    return <ErrorState message={(error as Error)?.message || "오류가 발생했어요."} onRetry={onRetry} />;
  if (data === undefined) return null;
  if (isEmpty && isEmpty(data)) return <>{empty ?? <EmptyState title="아직 항목이 없어요" />}</>;
  return <>{children(data)}</>;
}
