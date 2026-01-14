import type { Plugin } from "postcss";

export type Rgb = { r: number; g: number; b: number };

export type TailwindOpacityFallbackOptions = {
  /**
   * Which CSS properties should be rewritten (defaults include bg/text/border/outline + svg fill/stroke).
   */
  properties?: string[];
  /**
   * Also rewrite some Tailwind internal custom props like `--tw-ring-color`, `--tw-gradient-from`, etc.
   */
  includeTailwindCustomProps?: boolean;
};

const DEFAULT_PROPERTIES = [
  "background-color",
  "color",
  "border-color",
  "outline-color",
  "fill",
  "stroke",
  "caret-color",
  "text-decoration-color",
  "column-rule-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
];

const DEFAULT_TAILWIND_CUSTOM_PROPS = [
  "--tw-ring-color",
  "--tw-border-color",
  "--tw-outline-color",
  "--tw-inset-ring-color",
  "--tw-shadow-color",
  "--tw-inset-shadow-color",
  "--tw-drop-shadow-color",
  "--tw-gradient-from",
  "--tw-gradient-via",
  "--tw-gradient-to",
];

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexToRgb(hex: string): Rgb | null {
  const h = hex.replace("#", "").trim();
  if (![3, 4, 6, 8].includes(h.length)) return null;

  const expand = (c: string) => c + c;
  const hh =
    h.length === 3 || h.length === 4
      ? expand(h[0]) + expand(h[1]) + expand(h[2])
      : h.slice(0, 6);

  const r = Number.parseInt(hh.slice(0, 2), 16);
  const g = Number.parseInt(hh.slice(2, 4), 16);
  const b = Number.parseInt(hh.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function parseRgbFuncToRgb(value: string): Rgb | null {
  // Supports:
  // - rgb(255, 0, 0)
  // - rgba(255, 0, 0, .2)
  // - rgb(255 0 0 / .2)
  const v = value.trim();
  if (!/^rgba?\(/i.test(v)) return null;

  // Loose parse: just take the first 3 numbers.
  const l = v.indexOf("(");
  const rParen = v.lastIndexOf(")");
  if (l < 0 || rParen < 0 || rParen <= l) return null;
  const inner = v.slice(l + 1, rParen);
  const nums = inner.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 3) return null;

  const r = Number.parseFloat(nums[0]);
  const g = Number.parseFloat(nums[1]);
  const b = Number.parseFloat(nums[2]);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  // h: 0..360, s/l: 0..1
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hh < 60) [r1, g1, b1] = [c, x, 0];
  else if (hh < 120) [r1, g1, b1] = [x, c, 0];
  else if (hh < 180) [r1, g1, b1] = [0, c, x];
  else if (hh < 240) [r1, g1, b1] = [0, x, c];
  else if (hh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: clampByte((r1 + m) * 255),
    g: clampByte((g1 + m) * 255),
    b: clampByte((b1 + m) * 255),
  };
}

function parseHslFuncToRgb(value: string): Rgb | null {
  // Supports:
  // - hsl(210, 50%, 40%)
  // - hsla(210, 50%, 40%, .2)
  // - hsl(210 50% 40% / .2)
  const m = value.match(/^hsla?\(\s*(.+?)\s*\)$/i);
  if (!m) return null;
  const inner = m[1].trim();
  const [left] = inner.split("/").map((s) => s.trim());
  const parts = left.includes(",")
    ? left.split(",").map((s) => s.trim())
    : left.split(/\s+/).map((s) => s.trim());
  if (parts.length < 3) return null;

  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1].replace("%", "")) / 100;
  const l = Number.parseFloat(parts[2].replace("%", "")) / 100;
  if ([h, s, l].some((x) => Number.isNaN(x))) return null;
  return hslToRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
}

function parseColorToRgb(value: string): Rgb | null {
  const v = value.trim();
  if (!v) return null;
  if (v === "transparent") return null;

  if (v.startsWith("#")) return parseHexToRgb(v);
  if (/^rgba?\(/i.test(v)) return parseRgbFuncToRgb(v);
  if (/^hsla?\(/i.test(v)) return parseHslFuncToRgb(v);

  // Not handling oklch()/lab()/color(display-p3...) etc. here.
  return null;
}

function parseLooseRgbFromString(value: string): Rgb | null {
  const v = value.trim();
  if (!/rgba?\(/i.test(v)) return null;
  const l = v.indexOf("(");
  const rParen = v.lastIndexOf(")");
  if (l < 0 || rParen < 0 || rParen <= l) return null;
  const inner = v.slice(l + 1, rParen);
  const nums = inner.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 3) return null;
  const r = Number.parseFloat(nums[0]);
  const g = Number.parseFloat(nums[1]);
  const b = Number.parseFloat(nums[2]);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
}

function extractOpacityFromSelector(selector: string): number | null {
  // Tailwind v4 selector examples:
  // - `.text-white\/60`
  // - `.hover\:bg-primary\/10:hover`
  // Also support unescaped `/NN`.
  const matches: RegExpMatchArray[] = [];
  for (const re of [/\\\/(\d{1,3})(?!\d)/g, /\/(\d{1,3})(?!\d)/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(selector))) matches.push(m);
  }
  if (matches.length === 0) return null;
  const raw = matches[matches.length - 1]![1];
  const pct = Number.parseInt(raw, 10);
  if (Number.isNaN(pct)) return null;
  return Math.max(0, Math.min(100, pct)) / 100;
}

function isRootLikeSelector(selector: string) {
  return selector.includes(":root") || selector.includes(":host");
}

function isDarkSelector(selector: string) {
  return selector.includes(".dark");
}

function makeRgbVarName(varName: string) {
  return `${varName}-rgb`;
}

function readVarNameFromVarFunc(value: string): string | null {
  const m = value.trim().match(/^var\(--([a-zA-Z0-9_-]+)\)$/);
  return m ? m[1] : null;
}

export default function tailwindOpacityFallback(
  options: TailwindOpacityFallbackOptions = {},
): Plugin {
  const properties = options.properties ?? DEFAULT_PROPERTIES;
  const includeTailwindCustomProps = options.includeTailwindCustomProps ?? true;
  const allProps = new Set([
    ...properties,
    ...(includeTailwindCustomProps ? DEFAULT_TAILWIND_CUSTOM_PROPS : []),
  ]);

  return {
    postcssPlugin: "tailwind-opacity-fallback",
    Once(root) {
      const availableRgbVars = new Set<string>();
      const darkVarRgb = new Map<string, Rgb>();

      // 1) Inject `--*-rgb` next to `--*` in `:root/:host` and `.dark` rules (when parseable).
      root.walkRules((rule) => {
        const sel = rule.selector ?? "";
        const isTarget = isRootLikeSelector(sel) || isDarkSelector(sel);
        if (!isTarget) return;

        const existingProps = new Set<string>();
        const decls: Array<{
          prop: string;
          value: string;
          after: (x: any) => void;
        }> = [];

        rule.walkDecls((decl) => {
          existingProps.add(decl.prop);
          decls.push(decl);
        });

        for (const decl of decls) {
          if (!decl.prop.startsWith("--")) continue;

          const name = decl.prop.slice(2);
          if (name.endsWith("-rgb")) continue;

          const rgb =
            parseColorToRgb(decl.value) ?? parseLooseRgbFromString(decl.value);
          if (!rgb) continue;

          const rgbVar = makeRgbVarName(name);
          const rgbProp = `--${rgbVar}`;
          if (existingProps.has(rgbProp)) {
            availableRgbVars.add(rgbVar);
            continue;
          }

          decl.after({ prop: rgbProp, value: `${rgb.r}, ${rgb.g}, ${rgb.b}` });
          existingProps.add(rgbProp);
          availableRgbVars.add(rgbVar);
        }
      });

      // 1.5) Record `.dark` RGB values, used to generate constant rgba overrides (optional but helps with some build pipelines).
      root.walkRules((rule) => {
        const sel = rule.selector ?? "";
        if (!isDarkSelector(sel)) return;

        rule.walkDecls((decl) => {
          if (!decl.prop.startsWith("--")) return;
          const name = decl.prop.slice(2);
          if (name.endsWith("-rgb")) return;

          const rgb =
            parseColorToRgb(decl.value) ?? parseLooseRgbFromString(decl.value);
          if (!rgb) return;
          darkVarRgb.set(name, rgb);
        });
      });

      // 2) Rewrite */NN fallback values from `var(--x)` => `rgba(var(--x-rgb), a)`.
      root.walkRules((rule) => {
        const alpha = extractOpacityFromSelector(rule.selector ?? "");
        if (alpha === null) return;

        const canGenerateDarkOverride = !isDarkSelector(rule.selector ?? "");
        const touched: Array<{ prop: string; varName: string }> = [];

        rule.walkDecls((decl) => {
          if (!allProps.has(decl.prop)) return;
          const varName = readVarNameFromVarFunc(decl.value);
          if (!varName) return;

          const rgbVar = makeRgbVarName(varName);
          if (!availableRgbVars.has(rgbVar)) return;

          decl.value = `rgba(var(--${rgbVar}), ${alpha})`;
          touched.push({ prop: decl.prop, varName });
        });

        // 2.5) Optionally add `.dark ...` constant rgba override when dark RGB is known.
        // This helps in environments that might drop unused custom props on `.dark`.
        if (!canGenerateDarkOverride || touched.length === 0) return;

        const darkTouched = touched
          .map((t) => ({ ...t, rgb: darkVarRgb.get(t.varName) }))
          .filter((t): t is { prop: string; varName: string; rgb: Rgb } =>
            Boolean(t.rgb),
          );
        if (darkTouched.length === 0) return;

        const selectors = (rule.selector ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (selectors.length === 0) return;

        const darkSelector = selectors
          .map((s) => (s.includes(".dark") ? s : `.dark ${s}`))
          .join(", ");

        const darkRule = rule.clone({ selector: darkSelector });
        darkRule.walkDecls((decl) => {
          for (const t of darkTouched) {
            if (decl.prop !== t.prop) continue;
            decl.value = `rgba(${t.rgb.r}, ${t.rgb.g}, ${t.rgb.b}, ${alpha})`;
          }
        });

        rule.after(darkRule);
      });
    },
  };
}

tailwindOpacityFallback.postcss = true;

