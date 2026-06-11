// SSRF guard for user-supplied MCP server URLs. Connecting to arbitrary MCP
// servers is a core feature, but the server-side fetch must not be pointed at
// internal/loopback/cloud-metadata addresses.
//
// This is a hostname / IP-literal blocklist (private, loopback, link-local,
// CGNAT, cloud metadata). It deliberately does NOT resolve DNS, so a *public*
// hostname that resolves to a private IP is not caught here — an acceptable
// baseline for a "connect your own server" feature. Add DNS resolution if you
// need defense-in-depth against DNS-rebinding.

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function ipv4Octets(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) {
    return null;
  }
  const octets = m.slice(1, 5).map(Number);
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

/** True if the URL is malformed, not http(s), or points at a reserved address. */
export function isBlockedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return true;
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  // IPv6 loopback / link-local (fe80::/10) / unique-local (fc00::/7)
  if (
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }
  const v4 = ipv4Octets(host);
  if (v4 && isPrivateIpv4(v4)) {
    return true;
  }
  return false;
}

/** Throws if the URL is not a safe public http(s) target. */
export function assertPublicUrl(raw: string): void {
  if (isBlockedUrl(raw)) {
    throw new Error("URL not allowed: points at a private or reserved address.");
  }
}
