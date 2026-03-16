import { SparklesIcon } from "outline-icons";
import * as React from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { MenuItem } from "@shared/editor/types";

type AIAction =
  | "improve"
  | "fix_spelling"
  | "make_shorter"
  | "make_longer"
  | "summarize"
  | "continue"
  | "translate";

const ACTION_LABELS: Record<AIAction, string> = {
  improve: "✨ Improve writing",
  fix_spelling: "✏️ Fix spelling & grammar",
  make_shorter: "⬅️ Make shorter",
  make_longer: "➡️ Make longer",
  summarize: "📝 Summarize",
  continue: "▶️ Continue writing",
  translate: "🌐 Translate to English",
};

/**
 * Call the AI completion endpoint and return the result text.
 */
async function callAI(text: string, action: AIAction): Promise<string> {
  const response = await fetch("/api/ai.complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ text, action }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.message ?? "AI request failed");
  }

  const body = await response.json();
  return (body.data as { text: string }).text;
}

/**
 * Returns AI menu items for the formatting toolbar.
 *
 * @param state  Current ProseMirror editor state
 * @param view   EditorView — needed to dispatch replace transactions
 */
export function getAIMenuItems(
  state: EditorState,
  view: EditorView
): MenuItem[] {
  const { selection, doc } = state;
  const selectedText = doc.cut(selection.from, selection.to).textContent;

  if (!selectedText.trim()) {
    return [];
  }

  const actions: AIAction[] = [
    "improve",
    "fix_spelling",
    "make_shorter",
    "make_longer",
    "summarize",
    "continue",
    "translate",
  ];

  return actions.map((action) => ({
    name: `ai-${action}`,
    title: ACTION_LABELS[action],
    icon: <SparklesIcon />,
    visible: true,
    active: () => false,
    onClick: () => {
      void (async () => {
        try {
          const result = await callAI(selectedText, action);
          const { tr } = view.state;
          const { from, to } = view.state.selection;

          if (action === "continue") {
            // Append after the selection
            tr.insertText(" " + result, to);
          } else {
            // Replace selected text
            tr.insertText(result, from, to);
          }

          view.dispatch(tr);
          view.focus();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("AI action failed:", err);
        }
      })();
    },
  }));
}
