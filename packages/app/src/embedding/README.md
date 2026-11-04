# Embedding building blocks

`@tikz-editor/app/embedding` exposes existing canvas/source components, editor
state and edit commands without importing the application's docking layout.
Consumers provide their own UI, platform adapter, source document and storage.

```tsx
import {
  CanvasPanel, SourcePanel, createEditorSession, useEditorComputation,
} from "@tikz-editor/app/embedding";
import "@tikz-editor/app/embedding/styles.css";

const session = createEditorSession({ source, platform, host: { root: container } });

function EditorContent() {
  const error = useEditorComputation(reportError);
  return <><CanvasPanel /><SourcePanel />{error && <p>{error}</p>}</>;
}

// Mount EditorContent in your React root. Read session.getSource() when needed.
// On close: unmount that React root first, then call session.dispose().
```

The render hook connects the existing store to the existing single-flight
parse/evaluate/render pipeline. It cancels scheduled work on unmount. Source
patches and visual editing still use the upstream reducer and core edit actions.

The host boundary directs popup portals, cursor classes and theme observation
to the supplied element. Without an embedded session, the original document
defaults apply. Hosts without the upstream documentation assets can explicitly
set `documentationEnabled: false`; the default remains enabled.

Session setup does not mount React, choose tools, set a theme, define a default
document, access a clipboard, save files or define application commands. Those
are consumer responsibilities. Consumers also own CSS containment and layout.

The current store and platform are singletons: only one embedded session is
supported, and it should not share an active full-app editor in the same bundle.
Session disposal is idempotent and restores the previous platform. This API
exposes the current architecture; it does not yet provide independent stores
for multiple simultaneous editors.

`sourceEditorHistoryFor(element)` supplies undo, redo and focus controls for a
mounted SourcePanel containing that element. Hosts can route toolbar actions to
source history without importing or depending on CodeMirror internals.
