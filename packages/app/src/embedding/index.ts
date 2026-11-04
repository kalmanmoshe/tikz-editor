/** Shell-independent building blocks; consumers own their layout and platform adapter. */
export { CanvasPanel } from "../ui/canvas-panel/CanvasPanel";
export { SourcePanel } from "../ui/source-panel/SourcePanel";
export { useEditorStore } from "../store/store";
export { deleteSelection } from "../ui/editor-commands";
export { editorActiveElement, editorOwnsEvent } from "./host";
export { createEditorSession } from "./session";
export { useEditorComputation } from "./useEditorComputation";
export type { EditorSession, EditorSessionOptions } from "./session";
export type { EditorHostOptions } from "./host";
export type { EditorPlatform } from "../platform/types";
export type { ToolMode } from "../store/types";
export { sourceEditorHistoryFor } from "./source-history";
export type { SourceEditorHistory } from "./source-history";
