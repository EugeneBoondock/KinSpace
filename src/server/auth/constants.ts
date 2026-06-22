// Light, dependency-free auth constants safe to import from the edge middleware
// (importing session.ts there would pull the D1/Drizzle layer into the bundle).
export const SESSION_COOKIE = 'kinspace_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
