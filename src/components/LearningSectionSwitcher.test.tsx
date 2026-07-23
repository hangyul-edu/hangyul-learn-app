import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { LearningSectionSwitcher, type LearningSection } from "./LearningSectionSwitcher";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderAt(current: LearningSection, path = "/streak") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/streak"
          element={
            <>
              <LearningSectionSwitcher current="streak" />
              <Loc />
            </>
          }
        />
        <Route
          path="/learning-management"
          element={
            <>
              <LearningSectionSwitcher current="management" />
              <Loc />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  // Guard against an unused-var lint when current isn't the route default.
  void current;
}

const trigger = () => screen.getByRole("button", { name: "학습 섹션 변경" });
const openMenu = async () => {
  await userEvent.click(trigger());
  return screen.getByRole("menu");
};

describe("LearningSectionSwitcher", () => {
  it("renders the current section label in the trigger", () => {
    renderAt("streak");
    expect(trigger()).toHaveTextContent("연속 학습");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the dropdown with exactly two options on tap", async () => {
    renderAt("streak");
    await openMenu();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "연속 학습" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "학습 관리" })).toBeInTheDocument();
  });

  it("marks the current section as selected (orange + aria-current)", async () => {
    renderAt("streak");
    await openMenu();
    const selected = screen.getByRole("menuitem", { name: "연속 학습" });
    expect(selected).toHaveClass("lsw__option--active");
    expect(selected).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: "학습 관리" })).not.toHaveAttribute("aria-current");
  });

  it("navigates to the Learning Management route when 학습 관리 is tapped", async () => {
    renderAt("streak");
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "학습 관리" }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/learning-management"));
    // Menu closed after navigation.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays put and does not navigate when the current section is tapped", async () => {
    renderAt("streak");
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "연속 학습" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("loc")).toHaveTextContent("/streak");
  });

  it("closes when the backdrop is tapped, without navigating", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/streak"]}>
        <Routes>
          <Route path="/streak" element={<><LearningSectionSwitcher current="streak" /><Loc /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(trigger());
    const overlay = container.querySelector(".lsw__overlay")!;
    await userEvent.click(overlay);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("loc")).toHaveTextContent("/streak");
  });

  it("keeps the menu open when a click lands inside the card (no propagation)", async () => {
    renderAt("streak");
    const menu = await openMenu();
    await userEvent.click(menu); // inside the card but not on an option
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    renderAt("streak");
    await openMenu();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on hardware/browser back (popstate)", async () => {
    renderAt("streak");
    await openMenu();
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("reverses the selected state on the Learning Management page", async () => {
    renderAt("management", "/learning-management");
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "학습 관리" })).toHaveClass("lsw__option--active");
    expect(screen.getByRole("menuitem", { name: "연속 학습" })).not.toHaveClass("lsw__option--active");
  });
});
