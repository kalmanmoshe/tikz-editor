import { editorOverlayRoot } from "../embedding/host";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_CONTEXT_MENU_DEFINITION,
  type CanvasContextMenuDefinition,
  type CanvasContextMenuTarget
} from "../context-menu";
import type { AppMenuCommandId, AppMenuItem } from "../app-menu";
import type { CommandOrigin, CommandBindings } from "./editor-command-runtime";
import { clampContextMenuAnchor, type ContextMenuAnchor } from "./canvas-panel/context-menu-target";
import { formatAccelerator } from "./key-labels";
import css from "./CanvasContextMenu.module.css";

type ContextMenuInheritedStyle = CSSProperties & {
  "--app-ui-font-size"?: string;
  "--app-ui-scale"?: string;
};

function navigateMenu(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (!(event.target instanceof HTMLElement)) return;
  const menu = event.target.closest('[role="menu"]');
  const buttons = Array.from(menu?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    .filter((button) => !button.disabled && button.closest('[role="menu"]') === menu);
  const index = buttons.findIndex(button => button === event.target);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault(); event.stopPropagation();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  } else if (event.key === "ArrowLeft" && menu?.parentElement?.classList.contains(css.submenuPopup ?? "")) {
    event.preventDefault(); event.stopPropagation();
    const trigger = menu.parentElement.previousElementSibling;
    if (trigger instanceof HTMLButtonElement) trigger.focus();
  }
}

function positionSubmenu(element: HTMLDivElement) {
  const popup = element.querySelector<HTMLDivElement>(`.${css.submenuPopup}`);
  const ownerWindow = element.ownerDocument.defaultView;
  if (!popup || !ownerWindow) return;
  const trigger = element.getBoundingClientRect();
  const bounds = popup.getBoundingClientRect();
  const padding = 4;
  const right = element.ownerDocument.documentElement.clientWidth;
  const bottom = element.ownerDocument.documentElement.clientHeight;
  const preferredX = trigger.right + bounds.width - 2 <= right - padding
    ? trigger.right - 2 : trigger.left - bounds.width + 2;
  popup.style.left = `${Math.max(padding, Math.min(preferredX, right - bounds.width - padding))}px`;
  popup.style.top = `${Math.max(padding, Math.min(trigger.top - 5, bottom - bounds.height - padding))}px`;
}

function ContextMenuPopup({
  items,
  path,
  bindings,
  origin,
  onCommandRun
}: {
  items: readonly AppMenuItem[];
  path: string;
  bindings: CommandBindings;
  origin: CommandOrigin;
  onCommandRun: (commandId: AppMenuCommandId, origin: CommandOrigin) => void;
}) {
  const hasCheckItems = items.some(
    (item) => item.kind === "command" && bindings[item.commandId]?.checked != null
  );

  return (
    <div className={css.menu} role="menu" onKeyDown={navigateMenu}>
      {items.map((item, index) => {
        const itemKey = `${path}-${index}`;
        if (item.kind === "separator") {
          return <div key={`${itemKey}-separator`} className={css.separator} role="separator" />;
        }

        if (item.kind === "submenu") {
          return (
            <div key={`${itemKey}-submenu`} className={css.submenu}
              onPointerEnter={(event) => { positionSubmenu(event.currentTarget); }}
              onFocus={(event) => { positionSubmenu(event.currentTarget); }}>
              <button type="button"
                className={[css.item, css.submenuTrigger, hasCheckItems ? "" : css.itemNoCheck]
                  .filter(Boolean)
                  .join(" ")}
                role="menuitem"
                aria-haspopup="menu"
                onClick={(event) => { event.currentTarget.nextElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault(); event.stopPropagation();
                    event.currentTarget.nextElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
                  }
                }}
              >
                {hasCheckItems ? <span className={css.check} /> : null}
                <span className={css.label}>{item.label}</span>
                <span className={css.submenuArrow}>›</span>
              </button>

              <div className={css.submenuPopup}>
                <ContextMenuPopup
                  items={item.items}
                  path={`${itemKey}-submenu`}
                  bindings={bindings}
                  origin={origin}
                  onCommandRun={onCommandRun}
                />
              </div>
            </div>
          );
        }
        if (item.kind === "recent-files" || item.kind === "workspace-list") {
          return null;
        }

        const binding = bindings[item.commandId];
        const role = binding?.checked == null ? "menuitem" : "menuitemcheckbox";
        return (
          <button
            key={`${itemKey}-${item.commandId}`}
            type="button"
            role={role}
            aria-checked={binding?.checked}
            disabled={!binding?.enabled}
            className={[css.item, hasCheckItems ? "" : css.itemNoCheck].filter(Boolean).join(" ")}
            data-testid={`canvas-context-cmd-${item.commandId}`}
            onClick={() => {
              if (!binding?.enabled) {
                return;
              }
              onCommandRun(item.commandId, origin);
            }}
          >
            {hasCheckItems ? <span className={css.check}>{binding?.checked ? "✓" : ""}</span> : null}
            <span className={css.label}>{item.label}</span>
            <span className={css.shortcut}>{formatAccelerator(item.accelerator)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CanvasContextMenu({
  open,
  anchor,
  target,
  bindings,
  onClose,
  onCommandRun,
  containerRef,
  origin = "context-menu",
  definition = CANVAS_CONTEXT_MENU_DEFINITION
}: {
  open: boolean;
  anchor: ContextMenuAnchor;
  target: CanvasContextMenuTarget;
  bindings: CommandBindings;
  onClose: () => void;
  onCommandRun: (commandId: AppMenuCommandId, origin: CommandOrigin) => void;
  containerRef: RefObject<HTMLElement | null>;
  origin?: CommandOrigin;
  definition?: CanvasContextMenuDefinition;
}) {
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<ContextMenuAnchor>(anchor);
  const [inheritedStyle, setInheritedStyle] = useState<ContextMenuInheritedStyle>({});

  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const menuRoot = menuRootRef.current;
    const container = containerRef.current;
    const ownerWindow = menuRoot?.ownerDocument.defaultView;
    if (!menuRoot || !container || !ownerWindow) return;

    const updatePosition = () => {
      const containerRect = container.getBoundingClientRect();
      const nextPosition = clampContextMenuAnchor(
        { x: containerRect.left + anchor.x, y: containerRect.top + anchor.y },
        { width: menuRoot.offsetWidth, height: menuRoot.offsetHeight },
        { width: menuRoot.ownerDocument.documentElement.clientWidth,
          height: menuRoot.ownerDocument.documentElement.clientHeight }
      );
      setPosition(current => current.x === nextPosition.x && current.y === nextPosition.y ? current : nextPosition);
    };
    updatePosition();
    const observer = new ownerWindow.ResizeObserver(updatePosition);
    observer.observe(menuRoot);

    const computedStyle = ownerWindow.getComputedStyle(container);
    const fontSize = computedStyle.getPropertyValue("--app-ui-font-size").trim();
    const scale = computedStyle.getPropertyValue("--app-ui-scale").trim();
    const nextInheritedStyle: ContextMenuInheritedStyle = {
      ...(fontSize ? { "--app-ui-font-size": fontSize } : {}),
      ...(scale ? { "--app-ui-scale": scale } : {})
    };
    setInheritedStyle(current =>
      current["--app-ui-font-size"] === nextInheritedStyle["--app-ui-font-size"] &&
      current["--app-ui-scale"] === nextInheritedStyle["--app-ui-scale"] ? current : nextInheritedStyle
    );
    return () => { observer.disconnect(); };
  }, [anchor.x, anchor.y, containerRef, open, target]);

  useEffect(() => {
    if (open) menuRootRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const menuRoot = menuRootRef.current;
    const ownerDocument = menuRoot?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!open || !menuRoot || !ownerDocument || !ownerWindow) return;
    const close = () => { closeRef.current(); };
    const outsideMenu = (event: Event) => !event.composedPath().includes(menuRoot);
    const onPointerDown = (event: PointerEvent) => { if (outsideMenu(event)) close(); };
    const onScroll = (event: Event) => { if (outsideMenu(event)) close(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        close(); containerRef.current?.focus({ preventScroll: true });
      }
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown);
    ownerDocument.addEventListener("scroll", onScroll, true);
    ownerWindow.addEventListener("keydown", onKeyDown, true);
    ownerWindow.addEventListener("blur", close);
    ownerWindow.addEventListener("resize", close);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown);
      ownerDocument.removeEventListener("scroll", onScroll, true);
      ownerWindow.removeEventListener("keydown", onKeyDown, true);
      ownerWindow.removeEventListener("blur", close);
      ownerWindow.removeEventListener("resize", close);
    };
  }, [containerRef, open]);

  if (!open) {
    return null;
  }

  const items = definition[target];

  const menu = (
    <div
      ref={menuRootRef}
      className={css.root}
      style={{
        ...inheritedStyle,
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onPointerDown={event => { event.stopPropagation(); }}
      onPointerMove={event => { event.stopPropagation(); }}
      onClick={event => { event.stopPropagation(); }}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      role="menu"
      data-testid="canvas-context-menu"
    >
      <ContextMenuPopup
        items={items}
        path={target}
        bindings={bindings}
        origin={origin}
        onCommandRun={(commandId, runOrigin) => {
          onCommandRun(commandId, runOrigin);
          onClose();
        }}
      />
    </div>
  );

  return typeof document === "undefined" ? menu : createPortal(menu, editorOverlayRoot());
}
