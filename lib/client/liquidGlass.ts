/**
 * Liquid Glass optics, ported from Chris Kube's "Liquid Glass in the Browser:
 * Refraction with CSS and SVG" (https://kube.io/blog/liquid-glass-css-svg/).
 *
 * A glass shape is a rounded rectangle whose rim (the bezel) is a curved
 * surface. A ray coming straight down through the bezel bends by Snell's law,
 * so the pixel you see there comes from further in or out. We trace that once
 * along a single radius (1D), then sweep it round the shape into an SVG
 * displacement map (R = x shift, G = y shift, 128 = none) that
 * <feDisplacementMap> uses on the backdrop. A second map lights the rim.
 */

/** Bezel profiles: height (0..1) at a given distance (0 = outer edge, 1 = flat top). */
export const SURFACES = {
  /** Quarter circle: strong bend at the very edge. */
  convexCircle: (x: number) => Math.sqrt(1 - (1 - x) ** 2),
  /** Squircle: softer transition into the flat top, Apple's preferred look. */
  convexSquircle: (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4),
  /** Concave dish: rays spread outward. */
  concave: (x: number) => 1 - Math.sqrt(1 - (1 - x) ** 2),
  /** Raised lip that dips into a dish: convex at the rim, concave inside. */
  lip: (x: number) => {
    const convex = Math.pow(1 - Math.pow(1 - x * 2, 4), 1 / 4);
    const concave = 1 - Math.sqrt(1 - (1 - x) ** 2) + 0.1;
    const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    return convex * (1 - smootherstep) + concave * smootherstep;
  },
} satisfies Record<string, (x: number) => number>;

export type SurfaceName = keyof typeof SURFACES;

/**
 * Sideways travel (px) of a vertical ray entering the bezel at each of
 * `samples` evenly spaced distances from the edge. Positive = pulled inward.
 */
export function bezelDisplacements(glassThickness: number, bezelWidth: number, surface: (x: number) => number, refractiveIndex = 1.5, samples = 128): number[] {
  const eta = 1 / refractiveIndex;
  const out = new Array<number>(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = surface(x);
    // Surface normal from the numerical derivative of the profile.
    const dx = x < 1 ? 0.0001 : -0.0001;
    const derivative = (surface(x + dx) - y) / dx;
    const magnitude = Math.sqrt(derivative * derivative + 1);
    const nx = -derivative / magnitude;
    const ny = -1 / magnitude;
    // Snell refraction of the incident ray (0, 1) through that normal.
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) {
      out[i] = 0; // total internal reflection
      continue;
    }
    const kSqrt = Math.sqrt(k);
    const rx = -(eta * dot + kSqrt) * nx;
    const ry = eta - (eta * dot + kSqrt) * ny;
    // Keep travelling until the ray hits the back of the glass.
    const remaining = y * bezelWidth + glassThickness;
    out[i] = rx * (remaining / ry);
  }
  return out;
}

/**
 * Signed position of a pixel's centre relative to the nearest corner centre
 * (0 on straight runs). Sampling centres keeps left/right rims symmetric.
 */
function cornerOffset(p: number, size: number, radius: number) {
  const c = p + 0.5;
  if (c < radius) return c - radius;
  if (c > size - radius) return c - (size - radius);
  return 0;
}

export type GlassShape = { width: number; height: number; radius: number; bezelWidth: number; dpr?: number };

/**
 * RGBA displacement map for a rounded rectangle. Returns pixels plus the
 * largest displacement in CSS px, which becomes feDisplacementMap's `scale`.
 */
export function displacementMap(shape: GlassShape, profile: number[]) {
  const dpr = shape.dpr ?? 1;
  const w = Math.max(1, Math.round(shape.width * dpr));
  const h = Math.max(1, Math.round(shape.height * dpr));
  const radius = Math.min(shape.radius, shape.width / 2, shape.height / 2) * dpr;
  const bezel = Math.min(shape.bezelWidth * dpr, radius);
  const maxDisplacement = Math.max(1e-6, ...profile.map(Math.abs));
  const data = new Uint8ClampedArray(w * h * 4);
  // Neutral grey-teal: R = G = 128 means "no shift".
  new Uint32Array(data.buffer).fill(0xff008080);

  const rSq = radius ** 2;
  const rPlusOneSq = (radius + 1) ** 2;
  const rMinusBezelSq = (radius - bezel) ** 2;
  for (let py = 0; py < h; py++) {
    const y = cornerOffset(py, h, radius);
    for (let px = 0; px < w; px++) {
      const x = cornerOffset(px, w, radius);
      const dSq = x * x + y * y;
      if (dSq > rPlusOneSq || dSq < rMinusBezelSq) continue;
      const d = Math.sqrt(dSq);
      // Anti-alias the one-pixel ring just outside the shape.
      const opacity = dSq < rSq ? 1 : 1 - (d - radius) / (Math.sqrt(rPlusOneSq) - radius);
      const fromSide = radius - d;
      const sample = profile[Math.max(0, Math.min(profile.length - 1, ((fromSide / bezel) * profile.length) | 0))] ?? 0;
      const cos = d === 0 ? 0 : x / d;
      const sin = d === 0 ? 0 : y / d;
      const i = (py * w + px) * 4;
      data[i] = 128 + ((-cos * sample) / maxDisplacement) * 127 * opacity;
      data[i + 1] = 128 + ((-sin * sample) / maxDisplacement) * 127 * opacity;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data, maxDisplacement };
}

/**
 * Rim light: a thin bright band where the bezel faces `angle` (or its
 * opposite), strongest right at the edge, like light catching a glass lip.
 */
export function specularMap(shape: GlassShape, angle = Math.PI / 3, rimWidth = 1.5) {
  const dpr = shape.dpr ?? 1;
  const w = Math.max(1, Math.round(shape.width * dpr));
  const h = Math.max(1, Math.round(shape.height * dpr));
  const radius = Math.min(shape.radius, shape.width / 2, shape.height / 2) * dpr;
  const band = Math.min(shape.bezelWidth * dpr, radius);
  const rim = rimWidth * dpr;
  const lx = Math.cos(angle);
  const ly = Math.sin(angle);
  const data = new Uint8ClampedArray(w * h * 4);

  const rPlusSq = (radius + dpr) ** 2;
  const rMinusBandSq = (radius - band) ** 2;
  for (let py = 0; py < h; py++) {
    const y = cornerOffset(py, h, radius);
    for (let px = 0; px < w; px++) {
      const x = cornerOffset(px, w, radius);
      const dSq = x * x + y * y;
      if (dSq > rPlusSq || dSq < rMinusBandSq || dSq === 0) continue;
      const d = Math.sqrt(dSq);
      const fromSide = radius - d;
      const opacity = d <= radius ? 1 : 1 - (d - radius) / dpr;
      const facing = Math.abs((x / d) * lx + (-y / d) * ly);
      const t = Math.max(0, 1 - fromSide / rim);
      const coefficient = facing * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
      const i = (py * w + px) * 4;
      const c = 255 * coefficient;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = c * coefficient * opacity;
    }
  }
  return { width: w, height: h, data };
}

export type GlassOptics = {
  surface?: SurfaceName;
  glassThickness?: number;
  bezelWidth?: number;
  refractiveIndex?: number;
};

export type GlassMaps = { displacement: string; specular: string; maxDisplacement: number };

const cache = new Map<string, GlassMaps>();

function toDataUrl(img: { width: number; height: number; data: Uint8ClampedArray }) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.toDataURL();
}

/** Both maps as data URLs, memoised per shape (many buttons share a size). Browser only. */
export function glassMaps(width: number, height: number, radius: number, optics: GlassOptics = {}): GlassMaps {
  const { surface = "convexSquircle", glassThickness = 60, bezelWidth = 16, refractiveIndex = 1.5 } = optics;
  // The maps are smooth, so 2x is plenty even on 3x phones and keeps big panels cheap.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bezel = Math.min(bezelWidth, radius, width / 2, height / 2);
  const key = [Math.round(width), Math.round(height), radius, surface, glassThickness, bezel, refractiveIndex, dpr].join(":");
  const hit = cache.get(key);
  if (hit) return hit;
  const profile = bezelDisplacements(glassThickness, bezel, SURFACES[surface], refractiveIndex);
  const shape = { width, height, radius, bezelWidth: bezel, dpr };
  const map = displacementMap(shape, profile);
  const maps = { displacement: toDataUrl(map), specular: toDataUrl(specularMap(shape)), maxDisplacement: map.maxDisplacement };
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  cache.set(key, maps);
  return maps;
}

/**
 * SVG filters as `backdrop-filter` only render in Chromium; Safari and Firefox
 * parse them but draw nothing, so those get the frosted CSS fallback instead.
 */
export function supportsSvgBackdrop() {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData?.brands;
  return !!brands?.some((b) => b.brand === "Chromium" || b.brand === "Google Chrome");
}
