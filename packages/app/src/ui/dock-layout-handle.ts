import type { DockLayoutHandle } from "./DockLayout";
let activeDockHandle: DockLayoutHandle | null = null;
export function getDockLayoutHandle(): DockLayoutHandle | null { return activeDockHandle; }
export function setDockLayoutHandle(handle: DockLayoutHandle | null): void { activeDockHandle = handle; }
