# postcss-tailwind-opacity-fallback

[English](./README.md) | [中文](./README.zh-CN.md)

让你在 Tailwind v4 中继续使用 `bg-*/NN`、`text-*/NN` 等透明度写法，同时为旧版 Safari 生成 `rgba(...)` fallback，而无需把写法手动改成 `bg-xxx-opacity` 这种“拆分式”类名。

## 开发初衷

Tailwind v4 的 `*/NN` 透明度实现经常依赖现代 CSS 颜色能力（典型是 `color-mix()`）。
但在较低版本 Safari 中，`color-mix()` 不被支持，导致最终渲染只剩下**不透明的回退色**，从而破坏 UI 的“轻透明”设计（hover 背景、focus ring、淡边框、浅色文字等）。

这个插件的目标是：**保留 Tailwind 的原始能力与写法，同时补上一层旧 Safari 可用的 `rgba(...)` 回退**。

## 为什么这对 Tauri + 低版本 macOS 很重要

在 macOS 上，Tauri 会使用系统自带的 WebView（WebKit）来渲染前端页面。低版本 macOS 的 WebKit 引擎往往相当于较旧的 Safari，可能不支持 `color-mix()` 这类现代颜色能力。

当你的 UI 依赖 Tailwind v4 的 `bg-primary/20`、`text-white/60` 等透明度类时，在旧 macOS 的 Tauri 窗口里就可能退化成“不透明回退色”，导致视觉效果不一致。本插件通过生成 Safari/WebKit 可用的 `rgba(...)` fallback 来解决这类问题。

## 解决的问题

- 开发者继续写：`bg-primary/20`、`text-primary/60`、`border-ring/50` 等
- 在旧 Safari 下仍能看到正确的透明效果（通过 `rgba(...)` fallback）

## 不解决什么（Non-goals）

- 本插件**不会**在运行时 polyfill `color-mix()`
- 本插件**不会**把 `color-mix(in oklab, var(--x) ...)` 这类“带 CSS 变量的混色”在构建期强行计算成单一静态颜色（变量是运行时值，构建期通常无法可靠求值）

## 安装

```bash
pnpm add -D postcss-tailwind-opacity-fallback
```

## 使用（Vite）

```ts
// vite.config.ts
import { defineConfig } from "vite";
import postcssPresetEnv from "postcss-preset-env";
import tailwindOpacityFallback from "postcss-tailwind-opacity-fallback";

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        // 建议放在其它“会生成/改写颜色”的插件之后
        tailwindOpacityFallback(),
        postcssPresetEnv({ stage: 0 }),
      ],
    },
  },
});
```

## 支持范围

- `background-color`（`bg-*`）
- `color`（`text-*`）
- `border-color`（`border-*`）
- `outline-color`（`outline-*` / `outline-ring/*`）
- `fill` / `stroke`（SVG 相关）
- 以及一部分 Tailwind 内部用到的颜色自定义属性（`--tw-ring-color` / `--tw-gradient-from` 等）

## 重要约束：CSS 变量颜色需要 `--*-rgb`（dark 也要）

当透明度写法最终落到 `var(--primary)` 这类 **CSS 变量颜色**时，构建期通常无法可靠计算混色（特别是 `oklch()` / `color(display-p3 ...)`）。

因此该插件采用稳定回退形式：

- `rgba(var(--primary-rgb), 0.2)`

也就是说：你应该为“会被 /NN 使用”的主题色同时维护 `--*-rgb`，并在 `.dark` 下也维护一份：

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

