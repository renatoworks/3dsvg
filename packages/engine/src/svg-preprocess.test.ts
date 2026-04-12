import { describe, it, expect } from "vitest";
import {
  buildGradientMap,
  resolveGradientURLs,
  preprocessSVG,
  hasGradients,
} from "./svg-preprocess";

// ---------------------------------------------------------------------------
// buildGradientMap
// ---------------------------------------------------------------------------

describe("buildGradientMap", () => {
  it("extracts linear gradient stop colors", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="g0" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#f00"/>
            <stop offset="1" stop-color="#f00" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ g0: "#f00" });
  });

  it("extracts radial gradient stop colors", () => {
    const svg = `
      <svg>
        <defs>
          <radialGradient id="rg1" cx="50%" cy="50%">
            <stop stop-color="blue"/>
            <stop offset="1" stop-color="blue" stop-opacity="0"/>
          </radialGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ rg1: "blue" });
  });

  it("prefers first opaque stop over transparent ones", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="g0" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#f00" stop-opacity="0"/>
            <stop offset="0.5" stop-color="#0f0"/>
            <stop offset="1" stop-color="#00f" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ g0: "#0f0" });
  });

  it("falls back to first stop when all are transparent", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="g0" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#f00" stop-opacity="0"/>
            <stop offset="1" stop-color="#00f" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ g0: "#f00" });
  });

  it("handles multiple gradients", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="a" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="red"/>
          </linearGradient>
          <linearGradient id="b" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="green"/>
          </linearGradient>
          <radialGradient id="c" cx="50%" cy="50%">
            <stop stop-color="blue"/>
          </radialGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ a: "red", b: "green", c: "blue" });
  });

  it("returns empty map when no gradients exist", () => {
    const svg = `<svg><rect fill="red"/></svg>`;
    expect(buildGradientMap(svg)).toEqual({});
  });

  it("handles stop-color in inline style", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="g0" x1="0" y1="0" x2="1" y2="0">
            <stop style="stop-color:#ff0;stop-opacity:1"/>
          </linearGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ g0: "#ff0" });
  });

  it("handles gradientUnits and extra attributes", () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="g0" gradientUnits="userSpaceOnUse" x1="100" y1="300" x2="420" y2="460">
            <stop stop-color="#f00"/>
            <stop offset="1" stop-color="#f00" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>`;
    const map = buildGradientMap(svg);
    expect(map).toEqual({ g0: "#f00" });
  });
});

// ---------------------------------------------------------------------------
// resolveGradientURLs
// ---------------------------------------------------------------------------

describe("resolveGradientURLs", () => {
  const gradientMap = { g0: "#f00", g1: "#0f0", g2: "#00f" };

  it("replaces fill=\"url(#id)\" with resolved color", () => {
    const input = `<polygon fill="url(#g0)"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<polygon fill="#f00"/>`);
  });

  it("replaces stroke=\"url(#id)\" with resolved color", () => {
    const input = `<path stroke="url(#g1)"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<path stroke="#0f0"/>`);
  });

  it("replaces multiple url() references in one SVG", () => {
    const input = `<polygon fill="url(#g0)"/><polygon fill="url(#g1)"/><polygon fill="url(#g2)"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<polygon fill="#f00"/><polygon fill="#0f0"/><polygon fill="#00f"/>`);
  });

  it("leaves unknown url() references unchanged", () => {
    const input = `<polygon fill="url(#unknown)"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<polygon fill="url(#unknown)"/>`);
  });

  it("leaves solid fills unchanged", () => {
    const input = `<polygon fill="#000"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<polygon fill="#000"/>`);
  });

  it("handles url() inside style attribute", () => {
    const input = `<polygon style="fill:url(#g0);opacity:1"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<polygon style="fill:#f00;opacity:1"/>`);
  });

  it("handles stroke url() inside style attribute", () => {
    const input = `<path style="stroke:url(#g2);stroke-width:2"/>`;
    const result = resolveGradientURLs(input, gradientMap);
    expect(result).toBe(`<path style="stroke:#00f;stroke-width:2"/>`);
  });

  it("returns input unchanged when gradient map is empty", () => {
    const input = `<polygon fill="url(#g0)"/>`;
    const result = resolveGradientURLs(input, {});
    expect(result).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// hasGradients
// ---------------------------------------------------------------------------

describe("hasGradients", () => {
  it("returns true for SVG with linearGradient", () => {
    const svg = `<svg><defs><linearGradient id="g0" x1="0" y1="0" x2="1" y2="0"><stop stop-color="red"/></linearGradient></defs></svg>`;
    expect(hasGradients(svg)).toBe(true);
  });

  it("returns true for SVG with radialGradient", () => {
    const svg = `<svg><defs><radialGradient id="rg" cx="50%" cy="50%"><stop stop-color="blue"/></radialGradient></defs></svg>`;
    expect(hasGradients(svg)).toBe(true);
  });

  it("returns false for SVG with no gradients", () => {
    const svg = `<svg><rect fill="red" width="100" height="100"/></svg>`;
    expect(hasGradients(svg)).toBe(false);
  });

  it("returns false for empty SVG", () => {
    expect(hasGradients(`<svg></svg>`)).toBe(false);
  });

  it("returns true for vectorware-style SVG with many gradients", () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g0" gradientUnits="userSpaceOnUse" x1="100" y1="300" x2="420" y2="460">
      <stop stop-color="#f00"/><stop offset="1" stop-color="#f00" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="rg1" cx="50%" cy="50%">
      <stop stop-color="#0f0"/>
    </radialGradient>
  </defs>
  <polygon fill="url(#g0)"/>
</svg>`;
    expect(hasGradients(svg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// preprocessSVG (integration)
// ---------------------------------------------------------------------------

describe("preprocessSVG", () => {
  it("resolves gradient fills end-to-end", () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#ff0000"/>
      <stop offset="1" stop-color="#0000ff"/>
    </linearGradient>
  </defs>
  <rect fill="url(#grad1)" width="100" height="100"/>
</svg>`;
    const result = preprocessSVG(svg);
    expect(result).toContain('fill="#ff0000"');
    expect(result).not.toContain("url(#grad1)");
  });

  it("handles SVG with no gradients (passthrough)", () => {
    const svg = `<svg><rect fill="red" width="100" height="100"/></svg>`;
    expect(preprocessSVG(svg)).toBe(svg);
  });

  it("handles the vectorware logo pattern (gradient + mix-blend-mode)", () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g0" gradientUnits="userSpaceOnUse" x1="100" y1="300" x2="420" y2="460">
      <stop stop-color="#f00"/>
      <stop offset="1" stop-color="#f00" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="300" y1="700" x2="300" y2="300">
      <stop stop-color="#0f0"/>
      <stop offset="1" stop-color="#0f0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <polygon points="100,300 300,700 500,300" fill="#000"/>
  <polygon points="100,300 300,700 500,300" fill="url(#g0)" style="mix-blend-mode:screen"/>
  <polygon points="100,300 300,700 500,300" fill="url(#g1)" style="mix-blend-mode:screen"/>
</svg>`;

    const result = preprocessSVG(svg);

    // Gradient fills should be resolved to their stop colors
    expect(result).toContain('fill="#f00"');
    expect(result).toContain('fill="#0f0"');
    expect(result).not.toContain("url(#g0)");
    expect(result).not.toContain("url(#g1)");

    // Solid fills and other attributes preserved
    expect(result).toContain('fill="#000"');
    expect(result).toContain("mix-blend-mode:screen");
  });

  it("preserves non-gradient defs like clipPath", () => {
    const svg = `
<svg>
  <defs>
    <clipPath id="c0"><polygon points="0,0 100,0 50,100"/></clipPath>
    <linearGradient id="g0" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="red"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#c0)">
    <polygon fill="url(#g0)"/>
  </g>
</svg>`;

    const result = preprocessSVG(svg);
    // clipPath references should NOT be touched
    expect(result).toContain('clip-path="url(#c0)"');
    // gradient fill should be resolved
    expect(result).toContain('fill="red"');
  });
});
