import { requireArrayValue } from "@tikz-editor/core/utils/collections";
import { pt, worldPoint } from "@tikz-editor/core/coords/index";
import type { ElementTemplate } from "@tikz-editor/core/edit/element-templates";
import type { WorldPoint } from "../coords/types";
import { distance, segmentDistance, strokeLength } from "./recognition-geometry";
import { recognizePolygon } from "./polygon-recognition";

import { RECOGNITION_SETTINGS as SETTINGS } from "./recognition-settings";
type ShapeTemplate = Extract<ElementTemplate, { kind: "line" | "rectangle" | "ellipse" }>;
export type FreehandRecognition =
  | { kind: "shape"; at: WorldPoint; template: ShapeTemplate }
  | { kind: "polygon"; at: WorldPoint; vertices: WorldPoint[] };

type StrokeBounds = {
  left: number; right: number; bottom: number; top: number;
  width: number; height: number; diagonal: number;
  at: WorldPoint; corner: WorldPoint;
};

/** Try simple shapes first; preserve ink when no geometric fit is convincing. */
export function recognizeFreehand(points: readonly WorldPoint[], zoom: number): FreehandRecognition | null {
  if (points.length < SETTINGS.minInputPoints || !Number.isFinite(zoom) || zoom <= 0) return null;
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const line = recognizeLine(points, zoom);
  if (line) return line;

  const bounds = measureBounds(points);
  if (!isClosedOutline(points, bounds, zoom)) return null;
  const rectangle = recognizeRectangle(points, bounds);
  if (rectangle) return rectangle;

  const vertices = recognizePolygon(points, bounds.diagonal, zoom);
  if (vertices) return { kind: "polygon", at: requireArrayValue(vertices, 0), vertices };
  return recognizeEllipse(points, bounds);
}

function recognizeLine(points: readonly WorldPoint[], zoom: number): FreehandRecognition | null {
  const start = requireArrayValue(points, 0);
  const end = requireArrayValue(points, points.length - 1);
  const chord = distance(start, end);
  if (chord * zoom < SETTINGS.minShapeSizePx || strokeLength(points) / chord >= SETTINGS.line.maxLengthRatio) return null;
  const tolerance = Math.max(SETTINGS.line.minTolerancePx / zoom, chord * SETTINGS.line.toleranceRatio);
  if (points.some(p => segmentDistance(p, start, end) >= tolerance)) return null;
  return { kind: "shape", at: start, template: { kind: "line", to: end } };
}

function measureBounds(points: readonly WorldPoint[]): StrokeBounds {
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const point of points) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    bottom = Math.min(bottom, point.y);
    top = Math.max(top, point.y);
  }
  const width = right - left;
  const height = top - bottom;
  return { left, right, bottom, top, width, height, diagonal: Math.hypot(width, height),
    at: worldPoint(pt(left), pt(bottom)), corner: worldPoint(pt(right), pt(top)) };
}

function isClosedOutline(points: readonly WorldPoint[], bounds: StrokeBounds, zoom: number): boolean {
  if (points.length < SETTINGS.minOutlinePoints || Math.min(bounds.width, bounds.height) * zoom < SETTINGS.minShapeSizePx) return false;
  const gap = distance(requireArrayValue(points, 0), requireArrayValue(points, points.length - 1));
  return gap <= bounds.diagonal * SETTINGS.maxClosureGapRatio;
}

function recognizeRectangle(points: readonly WorldPoint[], bounds: StrokeBounds): FreehandRecognition | null {
  const { left, right, bottom, top, width, height } = bounds;
  const edgeError = points.reduce((sum, p) => sum + Math.min(
    (p.x - left) / width, (right - p.x) / width,
    (p.y - bottom) / height, (top - p.y) / height
  ), 0) / points.length;
  const corners: [number, number][] = [[left, bottom], [left, top], [right, bottom], [right, top]];
  const coversCorners = corners.every(([x, y]) => points.some(p => Math.hypot((p.x - x) / width, (p.y - y) / height) < SETTINGS.rectangle.cornerCoverageRatio));
  if (edgeError >= SETTINGS.rectangle.maxMeanEdgeError || !coversCorners || strokeLength(points) >= SETTINGS.rectangle.maxLengthToSideSum * (width + height)) return null;
  return { kind: "shape", at: bounds.at, template: { kind: "rectangle", corner: bounds.corner } };
}

function recognizeEllipse(points: readonly WorldPoint[], bounds: StrokeBounds): FreehandRecognition | null {
  const { left, right, bottom, top, width, height } = bounds;
  const centerX = (left + right) / 2;
  const centerY = (bottom + top) / 2;
  const radialError = points.reduce((sum, p) => {
    const radius = Math.hypot((p.x - centerX) / (width / 2), (p.y - centerY) / (height / 2));
    return sum + (radius - 1) ** 2;
  }, 0) / points.length;
  // Ramanujan's approximation for an ellipse's circumference.
  const perimeter = Math.PI * (3 * (width + height) / 2 - Math.sqrt((3 * width + height) * (width + 3 * height)) / 2);
  const lengthRatio = strokeLength(points) / perimeter;
  if (radialError >= SETTINGS.ellipse.maxMeanSquaredRadialError || lengthRatio <= SETTINGS.ellipse.minLengthRatio || lengthRatio >= SETTINGS.ellipse.maxLengthRatio) return null;
  return { kind: "shape", at: bounds.at, template: { kind: "ellipse", corner: bounds.corner } };
}
