import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { readSavedTab, rememberSavedTab, useSavedReturn, type SavedOrigin } from "./savedReturn";

const ORIGIN: SavedOrigin = { savedKey: "k-saved", tab: "problem", source: "wrong" };

function Review({ origin }: { origin: SavedOrigin | null }) {
  const back = useSavedReturn("problem");
  return (
    <>
      <div data-testid="origin">{JSON.stringify(origin)}</div>
      <button onClick={back}>leave</button>
    </>
  );
}
function SavedProbe() {
  const loc = useLocation();
  return <div data-testid="saved">{JSON.stringify(loc.state)}</div>;
}

function renderReview(entries: (string | { pathname: string; state?: unknown })[]) {
  const router = createMemoryRouter(
    [
      { path: "/saved", element: <SavedProbe /> },
      { path: "/home", element: <div>HOME</div> },
      {
        path: "/review/question/:quizId",
        element: <ReviewRoute />,
      },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  return render(<RouterProvider router={router} />);
}
function ReviewRoute() {
  const origin = (useLocation().state as SavedOrigin | null) ?? null;
  return <Review origin={origin} />;
}

describe("useSavedReturn", () => {
  it("re-arms the tab hint from the session's own route state, then pops back", async () => {
    // Simulates a refresh mid-session: the module hint is gone (or points at a
    // different entry), so only the origin carried in the route state can put
    // the user back on the category they came from.
    rememberSavedTab("k-someone-else", "sentence");
    renderReview(["/saved", { pathname: "/review/question/q1", state: ORIGIN }]);

    await userEvent.click(screen.getByRole("button", { name: "leave" }));

    expect(readSavedTab("k-saved")).toBe("problem");
    expect(await screen.findByTestId("saved")).toBeInTheDocument(); // popped to /saved
  });

  it("keeps the source feed (오답 vs 찜한) on the origin it hands back", async () => {
    renderReview([
      "/saved",
      { pathname: "/review/question/q1", state: { ...ORIGIN, source: "bookmark" } },
    ]);
    expect(JSON.parse(screen.getByTestId("origin").textContent!)).toMatchObject({
      tab: "problem",
      source: "bookmark",
    });
  });

  it("with no origin (cold deep link) opens the tab the route itself implies", async () => {
    // Nothing of ours is behind this entry, so pop would leave the app. The
    // fallback must follow the item type, never a fixed Conversation default.
    renderReview([{ pathname: "/review/question/q1" }]);
    await userEvent.click(screen.getByRole("button", { name: "leave" }));
    expect(JSON.parse((await screen.findByTestId("saved")).textContent!)).toEqual({ tab: "quiz" });
  });

  it("a sentence review with no origin falls back to the Sentences tab", async () => {
    function SentenceReview() {
      const back = useSavedReturn("sentence");
      return <button onClick={back}>leave</button>;
    }
    const router = createMemoryRouter(
      [
        { path: "/saved", element: <SavedProbe /> },
        { path: "/review/sentence/:id", element: <SentenceReview /> },
      ],
      { initialEntries: [{ pathname: "/review/sentence/s1" }] },
    );
    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole("button", { name: "leave" }));
    expect(JSON.parse((await screen.findByTestId("saved")).textContent!)).toEqual({ tab: "sentence" });
  });
});
