/** Optional DOM boundary for embedding the editor in an existing application. */
export interface EditorHostOptions {
  root: HTMLElement;
  /** Hosts without the upstream documentation assets can disable their lookup. */
  documentationEnabled?: boolean;
}

let host: EditorHostOptions | null = null;

export function setEditorHost(options: EditorHostOptions | null): void { host = options; }
export function editorHost(): HTMLElement { return host?.root ?? document.body; }
export function editorThemeRoot(): HTMLElement { return host?.root ?? document.documentElement; }
export function editorDocumentationEnabled(): boolean { return host?.documentationEnabled ?? true; }
export function editorActiveElement(): Element | null {
  const root = host?.root.getRootNode();
  return root instanceof ShadowRoot ? root.activeElement : document.activeElement;
}
export function editorOwnsEvent(event: Event): boolean {
  return !host || event.composedPath().includes(host.root);
}
