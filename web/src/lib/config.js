// Baked in at build time (Dockerfile ARG). Empty in dev: requests go through Vite's proxy.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// What shared output (curl) shows as base URL, even in dev.
export const PUBLIC_API_URL = API_URL || 'https://argos-api.northernarchive.com'
