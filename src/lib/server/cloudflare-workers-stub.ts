// The Node.js/Docker build has no Cloudflare runtime bindings. Vite replaces
// this module with Cloudflare's built-in `cloudflare:workers` module for the
// Cloudflare build target.
export const env: Record<string, unknown> = {};
