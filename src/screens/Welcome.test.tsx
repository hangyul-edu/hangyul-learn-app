/**
 * The sign-in landing's social options: Facebook is implemented but not
 * launched (lib/launch.ts), so only Kakao and LINE sit in the circle row,
 * next to the Google and Apple buttons.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { Welcome } from "./Welcome";

const start = vi.fn();
vi.mock("../hooks/socialLogin", () => ({ useSocialLogin: () => ({ start }) }));

function renderWelcome() {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("Welcome social login options", () => {
  it("does not offer Facebook", () => {
    renderWelcome();
    expect(screen.queryByLabelText("Facebook으로 계속하기")).not.toBeInTheDocument();
  });

  it("keeps Google, Apple, Kakao and LINE, with Kakao and LINE in the circle row", () => {
    const { container } = renderWelcome();
    for (const label of ["Google로 계속하기", "Apple로 계속하기", "Kakao로 계속하기", "LINE으로 계속하기"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    const circles = container.querySelectorAll(".auth__socials .auth__circle");
    expect(Array.from(circles, (c) => c.getAttribute("aria-label"))).toEqual(["Kakao로 계속하기", "LINE으로 계속하기"]);
  });
});
