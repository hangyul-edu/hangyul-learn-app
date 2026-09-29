import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("keeps the markup TOPIK materials use", () => {
    const html =
      "<p>다음을 읽고 <u>밑줄</u> 친 <strong>부분</strong>을 고르십시오.</p>" +
      '<table><thead><tr><th>구분</th></tr></thead><tbody><tr><td colspan="2">값</td></tr></tbody></table>' +
      "<ul><li>하나</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("strips event handlers and script-bearing elements", () => {
    const out = sanitizeHtml(
      '<p onclick="steal()">글<img src=x onerror="steal()"><script>steal()</script></p>' +
        '<iframe src="https://evil.example"></iframe><svg><script>steal()</script></svg>',
    );
    expect(out).toBe("<p>글</p>");
  });

  it("unwraps unknown elements but keeps their text", () => {
    expect(sanitizeHtml('<p><a href="javascript:steal()">링크</a> <font color="red">글</font></p>')).toBe(
      "<p>링크 글</p>",
    );
  });

  it("drops non-numeric span attributes and all other attributes", () => {
    expect(sanitizeHtml('<td colspan="2 onmouseover=x" style="background:url(x)" class="c">a</td>')).not.toMatch(
      /colspan|style|class|onmouseover/,
    );
  });
});
