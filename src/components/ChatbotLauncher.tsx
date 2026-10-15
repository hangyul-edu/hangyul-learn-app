import { useState } from "react";
import { ChatbotBottomSheet } from "./ChatbotBottomSheet";
import chatbotFab from "../assets/brand/chatbot-fab.svg";

/**
 * The floating chatbot button (Figma 1825:29302) and the shared chatbot sheet
 * it opens in place — not a separate route. Used by Personalized Learning and
 * the Classes tab.
 */
export function ChatbotLauncher({
  source,
  label,
}: {
  source: "lecture" | "personalized_learning";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="plearn__fab" onClick={() => setOpen(true)} aria-label={label}>
        <img className="plearn__fab-art" src={chatbotFab} alt="" aria-hidden="true" />
      </button>
      <ChatbotBottomSheet open={open} source={source} onClose={() => setOpen(false)} />
    </>
  );
}
