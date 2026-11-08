import { requireArrayValue } from "@tikz-editor/core/utils/collections";
import type { WorldPoint } from "../coords/types";

export const distance = (a: WorldPoint, b: WorldPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

export function strokeLength(points: readonly WorldPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(requireArrayValue(points, i - 1), requireArrayValue(points, i));
  }
  return length;
}

export function segmentDistance(point: WorldPoint, start: WorldPoint, end: WorldPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

/** Iterative Ramer–Douglas–Peucker simplification, retaining stroke order. */
export function simplifyStroke(points: readonly WorldPoint[], tolerance: number): WorldPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Set([0, points.length - 1]);
  const pending: [number, number][] = [[0, points.length - 1]];
  while (pending.length) {
    const range = pending.pop();
    if (!range) break;
    const [start, end] = range;
    let furthest = -1;
    let maxDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const error = segmentDistance(requireArrayValue(points, i), requireArrayValue(points, start), requireArrayValue(points, end));
      if (error > maxDistance) { maxDistance = error; furthest = i; }
    }
    if (furthest < 0) continue;
    keep.add(furthest);
    pending.push([start, furthest], [furthest, end]);
  }
  return [...keep].sort((a, b) => a - b).map(i => requireArrayValue(points, i));
}
