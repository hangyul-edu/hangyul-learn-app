import type { ReactNode } from "react";

/**
 * Renders an FAQ answer with structured formatting preserved — paragraphs,
 * line breaks, bullet / numbered lists, bold emphasis, and safe links.
 *
 * Backend answers are plain text today but may contain light Markdown, so we
 * parse a small, safe subset and build real React elements. We deliberately
 * avoid `dangerouslySetInnerHTML`: nothing from the API is turned into raw
 * HTML, so there is no injection surface. Only `http(s)` / `mailto` links are
 * rendered as anchors; anything else stays plain text.
 */

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return null;
}

/** Parse `**bold**` and `[label](url)` markdown into React nodes. */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  // Combined pass over links and bold, whichever comes first.
  const tokens: { start: number; end: number; node: ReactNode }[] = [];
  for (const m of text.matchAll(LINK_RE)) {
    const href = safeHref(m[2]);
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: href ? (
        <a key={`${keyPrefix}-l${key++}`} href={href} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>
      ) : (
        m[1] // unsupported scheme → drop the link, keep the label text
      ),
    });
  }
  for (const m of text.matchAll(BOLD_RE)) {
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: <strong key={`${keyPrefix}-b${key++}`}>{m[1]}</strong>,
    });
  }
  tokens.sort((a, b) => a.start - b.start);

  for (const t of tokens) {
    if (t.start < cursor) continue; // overlapping match — skip
    if (t.start > cursor) nodes.push(text.slice(cursor, t.start));
    nodes.push(t.node);
    cursor = t.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Split a paragraph's lines into <br/>-joined inline content. */
function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br${i}`} />);
    out.push(...parseInline(line, `${keyPrefix}-${i}`));
  });
  return out;
}

export function AnswerBody({ text }: { text: string }) {
  // Normalise CRLF, then split into blocks on blank lines.
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;
        const key = `blk${bi}`;

        if (lines.every((l) => BULLET_RE.test(l))) {
          return (
            <ul key={key} className="faq__answer-list">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(BULLET_RE, "$1"), `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => NUMBERED_RE.test(l))) {
          return (
            <ol key={key} className="faq__answer-list">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(NUMBERED_RE, "$1"), `${key}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={key} className="faq__answer-p">
            {renderLines(lines, key)}
          </p>
        );
      })}
    </>
  );
}
