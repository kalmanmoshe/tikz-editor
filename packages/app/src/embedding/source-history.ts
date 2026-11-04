import { EditorView } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";

/** History controls for a mounted SourcePanel, without exposing CodeMirror internals. */
export interface SourceEditorHistory {
  undo(): boolean;
  redo(): boolean;
  focus(): void;
}

export function sourceEditorHistoryFor(element: Element | null): SourceEditorHistory | null {
  const editor = element?.closest(".cm-editor");
  if (!(editor instanceof HTMLElement)) return null;
  const view = EditorView.findFromDOM(editor);
  if (!view) return null;
  return {
    undo: () => undo(view),
    redo: () => redo(view),
    focus: () => { view.focus(); }
  };
}
