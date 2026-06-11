import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

// The embeddable chat route may be framed by these origins (comma-separated).
// Empty → only same-origin framing. CSP `frame-ancestors` is the authoritative
// control (the legacy `X-Frame-Options: ALLOW-FROM` can't allowlist a
// cross-origin parent, and Next doesn't send X-Frame-Options by default).
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  ...(process.env.EMBED_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
].join(" ");

const nextConfig: NextConfig = {
  // Serve the SPA for any deep-linked client route (e.g. /chat, /records/deal)
  // on a hard reload, while leaving API routes, Next internals, static assets
  // (any path with a file extension), and the real /embed route untouched.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/((?!api/|_next/|embed|.*\\..*).*)", destination: "/" }],
    };
  },
  // Allow the /embed route to be framed by the allowlisted parent origins.
  async headers() {
    return [
      {
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${EMBED_FRAME_ANCESTORS};` },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
