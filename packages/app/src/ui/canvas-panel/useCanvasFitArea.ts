import { useLayoutEffect, useState, type RefObject } from "react";

type Rect = { x: number; y: number; width: number; height: number };

// Keep all free rectangles until the end so a later obstacle cannot make an
// earlier greedy choice hide a larger usable area.
export function unobstructedFitArea(width: number, height: number, obstacles: Rect[]): Rect {
  let regions: Rect[] = [{ x: 0, y: 0, width, height }];
  for (const obstacle of obstacles) {
    regions = regions.flatMap(region => {
      const left = Math.max(region.x, obstacle.x);
      const top = Math.max(region.y, obstacle.y);
      const right = Math.min(region.x + region.width, obstacle.x + obstacle.width);
      const bottom = Math.min(region.y + region.height, obstacle.y + obstacle.height);
      if (left >= right || top >= bottom) return [region];
      return [
        { ...region, width: left - region.x },
        { ...region, x: right, width: region.x + region.width - right },
        { ...region, height: top - region.y },
        { ...region, y: bottom, height: region.y + region.height - bottom }
      ].filter(rect => rect.width > 0 && rect.height > 0);
    });
  }
  return regions.reduce((best, rect) => rect.width * rect.height > best.width * best.height ? rect : best,
    { x: 0, y: 0, width: 0, height: 0 });
}

export function useCanvasFitArea(viewportRef: RefObject<HTMLDivElement | null>, size: { width: number; height: number }): Rect {
  const [area, setArea] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const surface = viewport?.closest('[data-canvas-fit-surface]');
    if (!viewport || !surface) return;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      const obstacles = Array.from(surface.querySelectorAll('[data-canvas-fit-obstacle]')).map(element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left - bounds.left - 4, y: rect.top - bounds.top - 4, width: rect.width + 8, height: rect.height + 8 };
      });
      const next = unobstructedFitArea(viewport.clientWidth, viewport.clientHeight, obstacles);
      setArea(previous => previous?.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect();
      resize.observe(viewport);
      surface.querySelectorAll('[data-canvas-fit-obstacle]').forEach(element => { resize.observe(element); });
      measure();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(surface, { childList: true });
    observe();
    return () => { resize.disconnect(); mutations.disconnect(); };
  }, [viewportRef, size.width, size.height]);
  return area ?? { x: 0, y: 0, ...size };
}
