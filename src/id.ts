/**
 * Generates a reasonably unique client-side ID.
 * crypto.randomUUID() is unavailable on some browsers when the app is opened
 * over plain HTTP from a LAN IP, so this helper includes safe fallbacks.
 */
export function createId(): string {
  const cryptoObj = globalThis.crypto

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}
