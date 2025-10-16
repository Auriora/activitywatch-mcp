/**
 * Environment configuration utilities
 */

/**
 * Whether the server requires authentication (OAuth tokens or similar).
 * Controlled by REQUIRE_AUTH env var. Any truthy value like "true", "1", "yes" enables it.
 */
export function isAuthRequired(): boolean {
  const value = process.env.REQUIRE_AUTH ?? '';
  return /^(1|true|yes|on)$/i.test(value.trim());
}
