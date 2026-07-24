/**
 * Character counting for TOPIK writing tasks — one specification shared by the
 * client (live counter + submit gating) and mirrored by the server (which is
 * authoritative on submission). The rule, kept deliberately simple so both
 * sides agree exactly:
 *
 *   1. Normalize the text to Unicode NFC.
 *   2. Normalize line endings (\r\n and \r) to a single \n.
 *   3. Count Unicode code points — Korean syllables, Latin letters, digits,
 *      punctuation, spaces, and line breaks all count as one each.
 *
 * We intentionally count code points (via the string iterator) rather than
 * UTF-16 units so a precomposed Hangul syllable is one character.
 */
export function countTopikChars(text: string): number {
  const normalized = text.normalize("NFC").replace(/\r\n?/g, "\n");
  return [...normalized].length;
}
