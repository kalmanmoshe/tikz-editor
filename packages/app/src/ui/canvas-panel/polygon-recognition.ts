import { pt, worldPoint } from "@tikz-editor/core/coords/index";
import { requireArrayValue } from "@tikz-editor/core/utils/collections";
import type { WorldPoint } from "../coords/types";
import { distance, segmentDistance, simplifyStroke, strokeLength } from "./recognition-geometry";
import { RECOGNITION_SETTINGS } from "./recognition-settings";

const SETTINGS = RECOGNITION_SETTINGS.polygon;
const MIN_CORNER_TURN = SETTINGS.minCornerTurnDegrees * Math.PI / 180;

/** Prefer the fewest corners that explain the ink, rather than tracing its wobble. */
export function recognizePolygon(points: readonly WorldPoint[], diagonal: number, zoom: number): WorldPoint[] | null {
  const vertices = seedCorners(points, diagonal, zoom);
  const candidates: WorldPoint[][] = [];
  while (vertices.length >= SETTINGS.minCorners) {
    if (vertices.length <= SETTINGS.maxCorners) candidates.push([...vertices]);
    removeLeastSignificantCorner(vertices);
  }
  // Test triangles first, then four corners, and so on; stop at the first good fit.
  return candidates.reverse().find(candidate => fitsStroke(points, candidate, diagonal, zoom)) ?? null;
}

function seedCorners(points: readonly WorldPoint[], diagonal: number, zoom: number): WorldPoint[] {
  const first = requireArrayValue(points, 0);
  let split = 0;
  for (let i = 1; i < points.length; i++) {
    if (distance(first, requireArrayValue(points, i)) > distance(first, requireArrayValue(points, split))) split = i;
  }
  // Two open halves let drawing begin anywhere, including halfway along a side.
  // A slightly missed join belongs to the starting corner, not a new short side.
  let end = points.length;
  const mergeDistance = diagonal * SETTINGS.endpointMergeRatio;
  while (end > 1 && distance(first, requireArrayValue(points, end - 1)) <= mergeDistance) end--;
  const ring = [...points.slice(0, end), first];
  const tolerance = Math.max(SETTINGS.seedTolerancePx / zoom, diagonal * SETTINGS.seedToleranceRatio);
  return [
    ...simplifyStroke(ring.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplifyStroke(ring.slice(split), tolerance).slice(0, -1)
  ];
}

function removeLeastSignificantCorner(vertices: WorldPoint[]): void {
  let removeIndex = 0;
  let smallestDeviation = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const { previous, current, next } = cornerPoints(vertices, i);
    const deviation = segmentDistance(current, previous, next);
    if (deviation < smallestDeviation) {
      smallestDeviation = deviation;
      removeIndex = i;
    }
  }
  vertices.splice(removeIndex, 1);
}

function fitsStroke(points: readonly WorldPoint[], vertices: WorldPoint[], diagonal: number, zoom: number): boolean {
  const ring = [...vertices, requireArrayValue(vertices, 0)];
  if (strokeLength(points) > strokeLength(ring) * SETTINGS.maxLengthRatio) return false;
  if (vertices.some((_, i) => !hasDrawnCorner(points, vertices, i))) return false;
  const errors = points.map(point => outlineDistance(point, ring));
  const meanSquaredError = errors.reduce((sum, error) => sum + error * error, 0) / errors.length;
  const rmsTolerance = Math.max(SETTINGS.minFitTolerancePx / zoom, diagonal * SETTINGS.maxRootMeanSquaredErrorRatio);
  const maxTolerance = Math.max(SETTINGS.minFitTolerancePx / zoom, diagonal * SETTINGS.maxPointErrorRatio);
  return Math.sqrt(meanSquaredError) <= rmsTolerance && errors.every(error => error <= maxTolerance);
}

function outlineDistance(point: WorldPoint, ring: WorldPoint[]): number {
  let nearest = Infinity;
  for (let i = 1; i < ring.length; i++) {
    nearest = Math.min(nearest, segmentDistance(point, requireArrayValue(ring, i - 1), requireArrayValue(ring, i)));
  }
  return nearest;
}

/** A real corner turns locally; a circle only turns gradually along its outline. */
function hasDrawnCorner(points: readonly WorldPoint[], vertices: WorldPoint[], index: number): boolean {
  const { previous, current, next } = cornerPoints(vertices, index);
  const fittedTurn = turnAngle(previous, current, next);
  if (fittedTurn < MIN_CORNER_TURN) return false;
  let nearestIndex = 0;
  for (let i = 1; i < points.length; i++) {
    if (distance(current, requireArrayValue(points, i)) < distance(current, requireArrayValue(points, nearestIndex))) nearestIndex = i;
  }
  const probeDistance = Math.min(distance(previous, current), distance(current, next)) * SETTINGS.cornerProbeSideRatio;
  const before = walkOutline(points, nearestIndex, -1, probeDistance);
  const after = walkOutline(points, nearestIndex, 1, probeDistance);
  const drawnTurn = turnAngle(before, requireArrayValue(points, nearestIndex), after);
  return drawnTurn >= fittedTurn * SETTINGS.minDrawnToFittedTurnRatio;
}

function walkOutline(points: readonly WorldPoint[], index: number, direction: number, remaining: number): WorldPoint {
  let current = requireArrayValue(points, index);
  for (let step = 0; step < points.length; step++) {
    index = (index + direction + points.length) % points.length;
    const next = requireArrayValue(points, index);
    const length = distance(current, next);
    if (length >= remaining && length > 0) {
      const t = remaining / length;
      return worldPoint(
        pt(current.x + (next.x - current.x) * t),
        pt(current.y + (next.y - current.y) * t)
      );
    }
    remaining -= length;
    current = next;
  }
  return current;
}

function cornerPoints(vertices: WorldPoint[], index: number) {
  return {
    previous: requireArrayValue(vertices, (index + vertices.length - 1) % vertices.length),
    current: requireArrayValue(vertices, index),
    next: requireArrayValue(vertices, (index + 1) % vertices.length)
  };
}

function turnAngle(previous: WorldPoint, current: WorldPoint, next: WorldPoint): number {
  const denominator = distance(previous, current) * distance(current, next);
  if (!denominator) return 0;
  const cosine = ((current.x - previous.x) * (next.x - current.x) + (current.y - previous.y) * (next.y - current.y)) / denominator;
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}
