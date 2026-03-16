/**
 * AI Writing Assistant — client plugin entry point.
 *
 * The AI menu items are injected into the editor's formatting toolbar
 * via a direct patch to app/editor/menus/formatting.tsx.
 * This file is required for Outline's plugin loader to recognize the plugin.
 */

// This file intentionally left minimal — the AI feature is wired in via
// app/editor/menus/formatting.tsx and plugins/ai/client/getAIMenuItems.tsx
export {};
