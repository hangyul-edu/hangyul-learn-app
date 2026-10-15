import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { Button } from "./kit";
import { Spinner } from "./Spinner";

export { Spinner } from "./Spinner";

export function LoadingState({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <div className="state">
      <Spinner large />
      <div className="state__text">{text ?? t("ui.loading")}</div>
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
  const { t } = useTranslation();
  return (
    <div className="state">
      <div className="state__emoji">😵</div>
      <div className="state__title">{t("ui.errorTitle")}</div>
      <div className="state__text">{message}</div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
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
  const { t } = useTranslation();
  if (loading && data === undefined) return <>{skeleton ?? <LoadingState />}</>;
  if (error && data === undefined)
    return <ErrorState message={(error as Error)?.message || t("ui.errorBody")} onRetry={onRetry} />;
  if (data === undefined) return null;
  if (isEmpty && isEmpty(data)) return <>{empty ?? <EmptyState title={t("ui.emptyTitle")} />}</>;
  return <>{children(data)}</>;
}
