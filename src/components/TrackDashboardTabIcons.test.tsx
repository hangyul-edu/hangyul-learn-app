import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { TrackDashboard } from "./TrackDashboard";
import type { DashboardTrack } from "../lib/types";
// Compared by the imported asset, not its file name: vite may inline a small
// SVG as a data: URL, which carries no name.
import speakingSelected from "../assets/brand/tab-ic-speaking-selected.svg";
import speakingUnselected from "../assets/brand/tab-ic-speaking-unselected.svg";
import pencil from "../assets/brand/tab-ic-pencil.svg";

/* The learning-mode tab glyphs, against TAL-001 (Conversation selected) and
   TAL-002 (Conversation unselected).

   Conversation is the only glyph that changes with selection: unselected it
   sits on the #FFA662 tab with WHITE strokes, selected it sits on a white tab
   with #FF5A00 strokes. Home and Personalized both render this component, so
   these assertions cover the tab strip on both screens at once — which is the
   property that keeps them from drifting apart. */

const track = (category: "conversation" | "topik", name: string): DashboardTrack =>
  ({
    track_id: `t_${category}`,
    category,
    display_order: 1,
    name,
    level: 1,
    level_label: "Lv.1",
    next_lesson_id: null,
    goal: { key: "daily", label: "하루 목표", target: 5, current: 0, achieved: false },
  }) as unknown as DashboardTrack;

const TRACKS = [track("conversation", "회화"), track("topik", "TOPIK")];

/* TrackDashboard labels the tabs from the design frames, not from the server's
   untranslated track name, so these are the accessible names to query by. */
const CONVERSATION = "실전 회화";
const TOPIK = "TOPIK";

function renderTabs(tab: number) {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <TrackDashboard
          tracks={TRACKS}
          active={TRACKS[tab]}
          tab={tab}
          onTab={() => {}}
          onSettings={() => {}}
          ratio={0}
          current={0}
          target={5}
          done={false}
          onStart={() => {}}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
}

/** The glyph <img> inside the tab with the given accessible name. The image is
    aria-hidden (decorative), so it is reached through the DOM, not by role. */
function glyphSrc(name: string): string {
  const tab = screen.getByRole("tab", { name });
  const img = tab.querySelector("img.home__tab-ic");
  if (!img) throw new Error(`no glyph in the "${name}" tab`);
  return img.getAttribute("src") ?? "";
}

describe("learning-mode tab glyphs", () => {
  it("uses the white-stroked Conversation glyph when Conversation is NOT selected", () => {
    // TOPIK selected — the TAL-002 state the design pins.
    renderTabs(1);

    expect(glyphSrc(CONVERSATION)).toBe(speakingUnselected);
    expect(glyphSrc(CONVERSATION)).not.toBe(speakingSelected);
  });

  it("uses the orange-stroked Conversation glyph when Conversation IS selected", () => {
    // TAL-001. Guards the other half: a white glyph here would vanish into the
    // white selected tab.
    renderTabs(0);

    expect(glyphSrc(CONVERSATION)).toBe(speakingSelected);
    expect(glyphSrc(CONVERSATION)).not.toBe(speakingUnselected);
  });

  it("swaps the glyph as the selection moves", async () => {
    const user = userEvent.setup();
    let current = 0;
    const { rerender } = render(
      <I18nProvider language="ko">
        <MemoryRouter>
          <TrackDashboard
            tracks={TRACKS}
            active={TRACKS[0]}
            tab={0}
            onTab={(i) => {
              current = i;
            }}
            onSettings={() => {}}
            ratio={0}
            current={0}
            target={5}
            done={false}
            onStart={() => {}}
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(glyphSrc(CONVERSATION)).toBe(speakingSelected);

    await user.click(screen.getByRole("tab", { name: TOPIK }));
    expect(current).toBe(1);

    rerender(
      <I18nProvider language="ko">
        <MemoryRouter>
          <TrackDashboard
            tracks={TRACKS}
            active={TRACKS[1]}
            tab={1}
            onTab={() => {}}
            onSettings={() => {}}
            ratio={0}
            current={0}
            target={5}
            done={false}
            onStart={() => {}}
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(glyphSrc(CONVERSATION)).toBe(speakingUnselected);
  });

  it("keeps the TOPIK glyph the same in both states", () => {
    // TAL-001 and TAL-002 export an identical pencil, so a second variant here
    // would be invention rather than alignment.
    const { unmount } = renderTabs(0);
    const whenUnselected = glyphSrc(TOPIK);
    unmount();

    renderTabs(1);
    expect(glyphSrc(TOPIK)).toBe(whenUnselected);
    expect(whenUnselected).toBe(pencil);
  });
});
