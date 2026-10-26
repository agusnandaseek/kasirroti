/**
 * Shared tracking-code helpers that are safe to import from client components.
 * Codes are exactly 5 characters from an unambiguous alphabet: no I, O, 0, or 1.
 */
export const TRACKING_CODE_LENGTH = 5;

export function normalizeTrackingCode(input: string) {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isTrackingCodeFormat(code: string) {
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code);
}
