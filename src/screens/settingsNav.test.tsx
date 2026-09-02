import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../i18n";
import { settingsOrigin } from "../lib/settingsNav";

vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

const { learning, updateLearningCategory, updateLearningOrder } = vi.hoisted(() => ({
  learning: vi.fn(),
  updateLearningCategory: vi.fn(),
  updateLearningOrder: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  settingsApi: { learning, updateLearningCategory, updateLearningOrder },
}));

import { PersonalizedSettings } from "./PersonalizedSettings";
import { TrackSettings } from "./TrackSettings";

const PREFS = {
  categories: [
    { category: "conversation", level: 2, daily_goal: 5, max_level: 10, display_order: 1 },
    { category: "topik", level: 1, daily_goal: 5, max_level: 6, display_order: 2 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  learning.mockResolvedValue(PREFS);
});

/** The screen that opened Practice Settings — Home or Personalized Learning. */
function Origin({ name }: { name: string }) {
  const nav = useNavigate();
  return (
    <>
      <div>ORIGIN[{name}]</div>
      {/* exactly how Home.tsx / Personalized.tsx open it */}
      <button onClick={() => nav("/recommend/settings", { state: settingsOrigin(name === "home" ? "/home" : "/recommend") })}>
        open-settings
      </button>
    </>
  );
}
function StackProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function renderFlow(origin: "home" | "recommend") {
  const path = origin === "home" ? "/home" : "/recommend";
  const router = createMemoryRouter(
    [
      { path, element: <><Origin name={origin} /><StackProbe /></> },
      { path: "/recommend/settings", element: <><PersonalizedSettings /><StackProbe /></> },
      { path: "/recommend/settings/:category", element: <><TrackSettings /><StackProbe /></> },
    ],
    { initialEntries: [path] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return router;
}

const back = () => userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
const openChild = async (which: 0 | 1) => {
  const rows = await screen.findAllByRole("button", { name: /레벨|목표|급/ });
  await userEvent.click(rows[which]);
};

describe.each(["home", "recommend"] as const)("Practice Settings back — opened from %s", (origin) => {
  const originPath = origin === "home" ? "/home" : "/recommend";

  it("returns to the originating screen", async () => {
    renderFlow(origin);
    await userEvent.click(screen.getByRole("button", { name: "open-settings" }));
    await screen.findByRole("button", { name: "뒤로 가기" });
    await back();
    expect(await screen.findByText(`ORIGIN[${origin}]`)).toBeInTheDocument();
  });

  it("still returns to the originating screen after repeated trips into a child settings page", async () => {
    const router = renderFlow(origin);
    await userEvent.click(screen.getByRole("button", { name: "open-settings" }));

    for (const which of [0, 1, 0] as const) {
      await openChild(which);
      await screen.findByRole("button", { name: "뒤로 가기" });
      await back(); // child -> Practice Settings
      await screen.findByText("/recommend/settings");
      // The mechanism, not just the destination: leaving a child POPS. A push
      // here is what stranded the origin and bounced the two pages forever.
      expect(router.state.historyAction).toBe("POP");
    }

    await back(); // Practice Settings -> origin
    expect(await screen.findByText(`ORIGIN[${origin}]`)).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent(originPath);
  });

  it("leaving a child never makes that child the next back destination", async () => {
    const router = renderFlow(origin);
    await userEvent.click(screen.getByRole("button", { name: "open-settings" }));
    await openChild(0);
    await screen.findByRole("button", { name: "뒤로 가기" });
    const depthInChild = router.state.location.key;
    await back();
    await screen.findByText("/recommend/settings");

    // The child entry is behind us, not ahead: one more back leaves settings
    // entirely instead of bouncing back in.
    await back();
    expect(await screen.findByText(`ORIGIN[${origin}]`)).toBeInTheDocument();
    expect(router.state.location.key).not.toBe(depthInChild);
  });
});

describe("Practice Settings back — opened cold (no origin)", () => {
  it("a child opened directly replaces itself with the list, which then leaves settings", async () => {
    const router = createMemoryRouter(
      [
        { path: "/home", element: <><div>ORIGIN[home]</div><StackProbe /></> },
        { path: "/recommend/settings", element: <><PersonalizedSettings /><StackProbe /></> },
        { path: "/recommend/settings/:category", element: <><TrackSettings /><StackProbe /></> },
      ],
      { initialEntries: ["/recommend/settings/conversation"] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <I18nProvider language="ko">
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nProvider>,
    );
    await screen.findByRole("button", { name: "뒤로 가기" });

    await back(); // child -> list
    expect(await screen.findByText("/recommend/settings")).toBeInTheDocument();
    // REPLACE, never PUSH: a push here put the list ON TOP of the child, so the
    // list's own back popped straight back into it and the two looped.
    expect(router.state.historyAction).toBe("REPLACE");

    await back(); // list -> home, also by replace
    expect(await screen.findByText("ORIGIN[home]")).toBeInTheDocument();
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByText("/recommend/settings/conversation")).not.toBeInTheDocument();
  });
});
