import type { ReactNode } from "react";

/**
 * Small, safe Markdown renderer used for server-authored rich text (notice
 * bodies). It builds real React elements — never `dangerouslySetInnerHTML` —
 * so untrusted content has no HTML/script injection surface. Emoji and Korean
 * pass through untouched.
 *
 * Supported: paragraphs, blank-line separation, manual line breaks, `#`..`###`
 * headings, bold (`**`), italic (`*` / `_`), unordered lists (`-`/`*`/`•`),
 * ordered lists (`1.`), inline links (`[text](url)`), and bare autolinks.
 * Only `http(s)` / `mailto` URLs become anchors; anything else stays plain text.
 */

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^\s*(#{1,3})\s+(.*)$/;

function safeHref(url: string): string | null {
  const t = url.trim();
  return /^https?:\/\//i.test(t) || /^mailto:/i.test(t) ? t : null;
}

/**
 * Inline rules, tried in order at each position. Emphasis rules parse their
 * own inner content recursively (so a link can sit inside bold, etc.). Ordering
 * matters: links/bold are matched before single-asterisk italic so adjacent
 * markers never cross-contaminate.
 */
interface InlineRule {
  re: RegExp;
  render: (m: RegExpExecArray, key: string) => ReactNode;
}

const INLINE_RULES: InlineRule[] = [
  {
    // [label](url)
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    render: (m, key) => {
      const href = safeHref(m[2]);
      // Unsupported scheme → drop the link, keep the visible label text.
      return href ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>
      ) : (
        m[1]
      );
    },
  },
  {
    // bare http(s) autolink
    re: /https?:\/\/[^\s<]+[^\s<.,:;!?)]/,
    render: (m, key) => (
      <a key={key} href={m[0]} target="_blank" rel="noopener noreferrer">
        {m[0]}
      </a>
    ),
  },
  {
    // **bold**
    re: /\*\*([^*]+)\*\*/,
    render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
  },
  {
    // *italic* or _italic_
    re: /\*([^*\n]+)\*|_([^_\n]+)_/,
    render: (m, key) => <em key={key}>{parseInline(m[1] ?? m[2], key)}</em>,
  },
];

/** Find the earliest-matching inline rule in `text`, if any. */
function firstInlineMatch(text: string): { rule: InlineRule; m: RegExpExecArray } | null {
  let best: { rule: InlineRule; m: RegExpExecArray } | null = null;
  for (const rule of INLINE_RULES) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.m.index)) best = { rule, m };
  }
  return best;
}

/** Parse inline markdown into React nodes (iterative left-to-right scan). */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest) {
    const found = firstInlineMatch(rest);
    if (!found) {
      out.push(rest);
      break;
    }
    const { rule, m } = found;
    if (m.index > 0) out.push(rest.slice(0, m.index));
    out.push(rule.render(m, `${keyPrefix}-${i++}`));
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function renderParagraph(lines: string[], key: string): ReactNode {
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) nodes.push(<br key={`${key}-br${i}`} />);
    const heading = line.match(HEADING_RE);
    if (heading) {
      nodes.push(
        <strong key={`${key}-h${i}`} className="md__heading">
          {parseInline(heading[2], `${key}-h${i}`)}
        </strong>,
      );
    } else {
      nodes.push(...parseInline(line, `${key}-${i}`));
    }
  });
  return (
    <p key={key} className="md__p">
      {nodes}
    </p>
  );
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;
        const key = `b${bi}`;

        if (lines.every((l) => BULLET_RE.test(l))) {
          return (
            <ul key={key} className="md__list">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(BULLET_RE, "$1"), `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => NUMBERED_RE.test(l))) {
          return (
            <ol key={key} className="md__list">
              {lines.map((l, li) => (
                <li key={li}>{parseInline(l.replace(NUMBERED_RE, "$1"), `${key}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return renderParagraph(lines, key);
      })}
    </div>
  );
}
