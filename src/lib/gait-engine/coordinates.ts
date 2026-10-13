/** Explicit coordinate systems. Normalized image units are never metres. */
export type CoordSystem = "normalized_image" | "pixel" | "metric";

export interface Point { x: number; y: number; system: CoordSystem; unit: "fraction" | "px" | "m" }

export function normalizedToPixel(p: { x: number; y: number }, width: number, height: number): Point {
  if (!(width > 0 && height > 0)) throw new Error("Frame size required for pixel conversion.");
  return { x: p.x * width, y: p.y * height, system: "pixel", unit: "px" };
}

/** Metric conversion requires an explicit, documented scale (metres per pixel). */
export function pixelToMetric(p: Point, metresPerPixel: number | null): Point | null {
  if (p.system !== "pixel") throw new Error("Metric conversion expects pixel coordinates.");
  if (!metresPerPixel || !(metresPerPixel > 0)) return null;
  return { x: p.x * metresPerPixel, y: p.y * metresPerPixel, system: "metric", unit: "m" };
}

export const FRAME_SCHEMA = {
  coordinateSystem: "normalized_image",
  units: "fraction of frame width (x) / height (y); z is model-relative depth (unitless)",
  origin: "top-left of frame",
  timestampUnit: "s from decoded video start",
  landmarkOrder: "MediaPipe Pose 33-landmark topology",
} as const;
