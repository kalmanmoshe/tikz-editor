import { useEditorStore, flushPendingWorkspaceSave } from "../store/store";
import { makeInitialState } from "../store/reducer";
import { getActiveEditorPlatform, setActiveEditorPlatform } from "../platform/current";
import type { EditorPlatform } from "../platform/types";
import { setEditorHost, type EditorHostOptions } from "./host";

export interface EditorSessionOptions {
  source: string;
  platform: EditorPlatform;
  host: EditorHostOptions;
}

export interface EditorSession {
  getSource(): string;
  /** Unmount editor components before disposing their session. */
  dispose(): void;
}

let sessionActive = false;

/**
 * Initialize the existing editor store for a host-provided document and platform.
 * The upstream store is currently a singleton, so only one session is supported.
 * This function does not mount UI, define commands, choose tools, or save files.
 */
export function createEditorSession(options: EditorSessionOptions): EditorSession {
  if (sessionActive) throw new Error("Only one embedded editor session can be active at a time.");
  const previousPlatform = getActiveEditorPlatform();
  sessionActive = true;
  try {
    setEditorHost(options.host);
    setActiveEditorPlatform(options.platform);
    useEditorStore.setState(makeInitialState());
    useEditorStore.getState().dispatch({ type: "CODE_EDITED", source: options.source });
  } catch (error_) {
    setEditorHost(null);
    setActiveEditorPlatform(previousPlatform);
    sessionActive = false;
    throw error_;
  }
  let disposed = false;
  return {
    getSource: () => useEditorStore.getState().source,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { flushPendingWorkspaceSave(); }
      finally {
        setEditorHost(null);
        setActiveEditorPlatform(previousPlatform);
        sessionActive = false;
      }
    }
  };
}
