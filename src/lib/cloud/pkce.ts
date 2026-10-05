/** OAuth 2 PKCE helpers (RFC 7636), browser crypto only. */

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A random URL-safe string (43+ characters for a code verifier). */
export function randomUrlSafe(byteLength = 48): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}
