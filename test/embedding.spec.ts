// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createEditorSession, type EditorSession } from "../packages/app/src/embedding/session";
import { editorHost, editorThemeRoot, editorOwnsEvent, editorDocumentationEnabled, setEditorHost } from "../packages/app/src/embedding/host";
import { getActiveEditorPlatform } from "../packages/app/src/platform/current";

let session: EditorSession | null = null;
afterEach(() => {
  session?.dispose();
  session = null;
  setEditorHost(null);
  document.body.replaceChildren();
});

describe("editor embedding boundaries", () => {
  it("preserves document defaults when no host is configured", () => {
    expect(editorHost()).toBe(document.body);
    expect(editorThemeRoot()).toBe(document.documentElement);
    expect(editorDocumentationEnabled()).toBe(true);
  });

  it("uses caller-owned source and platform, then restores the previous platform", () => {
    const previous = getActiveEditorPlatform();
    const root = document.createElement("div");
    const source = String.raw`\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}`;
    const platform = { id: "test-embedding", persistence: { load: () => null, save: () => {} } };
    session = createEditorSession({ source, platform, host: { root, documentationEnabled: false } });
    expect(session.getSource()).toBe(source);
    expect(getActiveEditorPlatform()).toBe(platform);
    expect(editorHost()).toBe(root);
    expect(editorThemeRoot()).toBe(root);
    expect(editorDocumentationEnabled()).toBe(false);
    session.dispose();
    session.dispose();
    expect(getActiveEditorPlatform()).toBe(previous);
    expect(editorHost()).toBe(document.body);
    expect(editorDocumentationEnabled()).toBe(true);
  });

  it("rejects a second session without replacing the first document", () => {
    const options = { source: "first document", platform: getActiveEditorPlatform(), host: { root: document.createElement("div") } };
    session = createEditorSession(options);
    expect(() => createEditorSession({ ...options, source: "second document" })).toThrow("Only one embedded editor session");
    expect(session.getSource()).toBe("first document");
  });

  it("limits keyboard ownership to events from the configured host", () => {
    const root = document.createElement("div");
    const input = root.appendChild(document.createElement("input"));
    const outside = document.createElement("input");
    document.body.append(root, outside);
    setEditorHost({ root });
    const ownership: boolean[] = [];
    const listener = (event: Event) => { ownership.push(editorOwnsEvent(event)); };
    document.addEventListener("keydown", listener);
    try {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true, composed: true }));
      outside.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true, composed: true }));
    } finally { document.removeEventListener("keydown", listener); }
    expect(ownership).toEqual([true, false]);
  });
});
