# postcss-tailwind-opacity-fallback

[English](./README.md) | [中文](./README.zh-CN.md)

Generate Safari-safe `rgba(...)` fallbacks for Tailwind v4 `*/NN` opacity utilities (e.g. `bg-*/20`, `text-*/60`), without changing how developers write classes.

## Motivation

Tailwind v4 implements `*/NN` opacity utilities using modern color features (often `color-mix()`).
Older Safari versions do **not** support `color-mix()`, so the computed color may fall back to a **fully opaque** value — visually breaking designs that depend on opacity (hover states, focus rings, subtle borders, etc.).

This plugin rewrites the **fallback** portion of generated rules to use `rgba(...)`, which is widely supported.

## Why this matters for Tauri on older macOS

On macOS, Tauri uses the system WebView (WebKit) to render your frontend. On older macOS versions, the embedded WebKit engine can behave like an older Safari and may not support modern color features such as `color-mix()`.

If your UI relies on Tailwind v4 utilities like `bg-primary/20` or `text-white/60`, those styles can degrade to opaque fallbacks inside the Tauri window on older macOS. This plugin helps by generating Safari/WebKit-friendly `rgba(...)` fallbacks.

## What this solves

- Keep writing Tailwind utilities like `bg-primary/20`, `text-primary/60`, `border-ring/50`.
- Make those styles render correctly on older Safari by adding `rgba(...)` fallbacks.

## Non-goals

- This plugin does **not** polyfill `color-mix()` at runtime.
- It does **not** evaluate `color-mix(in oklab, var(--x) ...)` into a single static color (CSS variables are runtime values).

## 安装

```bash
pnpm add -D postcss-tailwind-opacity-fallback
```

## Usage (Vite)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import postcssPresetEnv from "postcss-preset-env";
import tailwindOpacityFallback from "postcss-tailwind-opacity-fallback";

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        // Place it after other plugins that may generate/transform colors.
        tailwindOpacityFallback(),
        postcssPresetEnv({ stage: 0 }),
      ],
    },
  },
});
```

## Supported properties

- `background-color`（`bg-*`）
- `color`（`text-*`）
- `border-color`（`border-*`）
- `outline-color`（`outline-*` / `outline-ring/*`）
- `fill` / `stroke`（SVG 相关）
- 以及一部分 Tailwind 内部用到的颜色自定义属性（`--tw-ring-color` / `--tw-gradient-from` 等）

## Important: CSS variables need `--*-rgb` (also in `.dark`)

When the final color is a CSS variable like `var(--primary)`, build tools usually cannot reliably pre-compute a mixed color (especially with `oklch()` / `color(display-p3 ...)`).

So this plugin uses a stable fallback form:

- `rgba(var(--primary-rgb), 0.2)`

That means you should provide `--*-rgb` for theme colors that will be used with `*/NN`, and also provide a `.dark` version:

```css
:root {
  --primary: #fa8c5f;
  --primary-rgb: 250, 140, 95;
}

.dark {
  --primary: rgb(229, 229, 229);
  --primary-rgb: 229, 229, 229;
}
```

## API

```ts
import tailwindOpacityFallback from "postcss-tailwind-opacity-fallback";

tailwindOpacityFallback({
  properties?: string[];
  includeTailwindCustomProps?: boolean;
});
```

## License
MIT

