import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";

describe("Markdown renderer", () => {
  it("renders blank-line-separated blocks as separate paragraphs", () => {
    const { container } = render(<Markdown text={"First paragraph.\n\nSecond paragraph."} />);
    const ps = container.querySelectorAll("p.md__p");
    expect(ps).toHaveLength(2);
    expect(ps[0]).toHaveTextContent("First paragraph.");
    expect(ps[1]).toHaveTextContent("Second paragraph.");
  });

  it("renders bold and italic emphasis", () => {
    const { container } = render(<Markdown text={"a **bold** and *italic* text"} />);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
  });

  it("renders unordered and ordered lists", () => {
    const { container } = render(<Markdown text={"- one\n- two"} />);
    const ul = container.querySelector("ul.md__list");
    expect(ul?.querySelectorAll("li")).toHaveLength(2);
    expect(ul).toHaveTextContent("one");

    const ordered = render(<Markdown text={"1. first\n2. second"} />);
    expect(ordered.container.querySelector("ol.md__list")?.querySelectorAll("li")).toHaveLength(2);
  });

  it("preserves manual line breaks within a paragraph", () => {
    const { container } = render(<Markdown text={"line one\nline two"} />);
    expect(container.querySelector("p.md__p br")).toBeTruthy();
  });

  it("renders safe links and opens them in a new tab", () => {
    render(<Markdown text={"see [our site](https://example.com)"} />);
    const link = screen.getByRole("link", { name: "our site" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("drops links with an unsupported URL scheme, keeping the label text", () => {
    render(<Markdown text={"before [click me](ftp://example.com) after"} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/click me/)).toBeInTheDocument();
  });

  it("preserves emoji", () => {
    render(<Markdown text={"🎉 축하합니다"} />);
    expect(screen.getByText(/🎉 축하합니다/)).toBeInTheDocument();
  });
});
