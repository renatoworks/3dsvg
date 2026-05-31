/**
 * =============================================================================
 * SVG Preprocessing
 * =============================================================================
 *
 * Transforms SVG markup before it reaches Three.js SVGLoader. Resolves
 * gradient `url(#id)` fill/stroke references to concrete colors so every
 * shape is visible to the loader, which cannot reliably handle gradients.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Gradient stop → color extraction
// ---------------------------------------------------------------------------

/** Parse a single `<stop>` element and return its color (ignoring opacity). */
function parseStopColor(stopEl: string): string | null {
  // Try stop-color attribute first
  const attrMatch = stopEl.match(/stop-color\s*=\s*["']([^"']+)["']/);
  if (attrMatch) return attrMatch[1];

  // Try inline style
  const styleMatch = stopEl.match(/style\s*=\s*["'][^"']*stop-color\s*:\s*([^;"']+)/);
  if (styleMatch) return styleMatch[1].trim();

  return null;
}

// ---------------------------------------------------------------------------
// Build gradient-id → color map
// ---------------------------------------------------------------------------

export interface GradientMap {
  [id: string]: string;
}

/**
 * Scan `<defs>` for `<linearGradient>` and `<radialGradient>` elements and
 * return a map from gradient `id` to its first opaque stop color (or the
 * first stop color regardless of opacity if no opaque stop exists).
 */
export function buildGradientMap(svgString: string): GradientMap {
  const map: GradientMap = {};

  // Match both linearGradient and radialGradient, capturing id and body
  const gradientRe =
    /<(linearGradient|radialGradient)\s[^>]*?id\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/g;

  let m: RegExpExecArray | null;
  while ((m = gradientRe.exec(svgString)) !== null) {
    const id = m[2];
    const body = m[3];

    // Collect all <stop> elements within this gradient
    const stopRe = /<stop\s[^/]*?\/?\s*>/g;
    let stopMatch: RegExpExecArray | null;
    let firstColor: string | null = null;
    let firstOpaqueColor: string | null = null;

    while ((stopMatch = stopRe.exec(body)) !== null) {
      const color = parseStopColor(stopMatch[0]);
      if (!color) continue;

      if (!firstColor) firstColor = color;

      // Check if this stop is opaque (stop-opacity missing or 1)
      const opacityAttr = stopMatch[0].match(/stop-opacity\s*=\s*["']([^"']+)["']/);
      const opacityStyle = stopMatch[0].match(/style\s*=\s*["'][^"']*stop-opacity\s*:\s*([^;"']+)/);
      const opacity = opacityAttr
        ? parseFloat(opacityAttr[1])
        : opacityStyle
          ? parseFloat(opacityStyle[1])
          : 1;

      if (opacity > 0.5 && !firstOpaqueColor) {
        firstOpaqueColor = color;
      }
    }

    const resolved = firstOpaqueColor ?? firstColor;
    if (resolved) {
      map[id] = resolved;
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Replace url(#id) references with resolved colors
// ---------------------------------------------------------------------------

/**
 * Replace `fill="url(#id)"` and `stroke="url(#id)"` attribute values with
 * the resolved solid color from the gradient map.  Also handles the same
 * patterns inside inline `style="…"` attributes.
 */
export function resolveGradientURLs(svgString: string, gradientMap: GradientMap): string {
  if (Object.keys(gradientMap).length === 0) return svgString;

  // Replace fill="url(#id)" and stroke="url(#id)" attributes
  let result = svgString.replace(
    /(fill|stroke)\s*=\s*["']url\(#([^)]+)\)["']/g,
    (full, attr, id) => {
      const color = gradientMap[id];
      return color ? `${attr}="${color}"` : full;
    },
  );

  // Replace url(#id) inside style="..." attribute values
  result = result.replace(
    /style\s*=\s*["']([^"']*)["']/g,
    (full, styleContent: string) => {
      const updated = styleContent.replace(
        /(fill|stroke)\s*:\s*url\(#([^)]+)\)/g,
        (match, prop, id) => {
          const color = gradientMap[id];
          return color ? `${prop}:${color}` : match;
        },
      );
      return updated !== styleContent ? `style="${updated}"` : full;
    },
  );

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preprocess an SVG string so that gradient `url(#…)` fills and strokes are
 * replaced with concrete colors.  This makes every shape visible to parsers
 * (like Three.js SVGLoader) that do not resolve gradient references.
 */
/**
 * Returns `true` when the SVG contains at least one `<linearGradient>` or
 * `<radialGradient>` element — a quick check used to decide whether the
 * engine should rasterize the SVG to a texture for faithful rendering.
 */
export function hasGradients(svgString: string): boolean {
  return /<(linearGradient|radialGradient)\s/.test(svgString);
}

/**
 * Preprocess an SVG string so that gradient `url(#…)` fills and strokes are
 * replaced with concrete colors.  This makes every shape visible to parsers
 * (like Three.js SVGLoader) that do not resolve gradient references.
 */
export function preprocessSVG(svgString: string): string {
  const gradientMap = buildGradientMap(svgString);
  return resolveGradientURLs(svgString, gradientMap);
}
