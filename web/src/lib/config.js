// Baked in at build time (Dockerfile ARG). Empty in dev: requests go through Vite's proxy.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// Base URL shown in shared output (curl, endpoint). In dev, the proxied local origin.
export const PUBLIC_API_URL = API_URL || globalThis.location?.origin || ''
