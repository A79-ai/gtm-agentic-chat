import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Serve the SPA for any deep-linked client route (e.g. /chat, /records/deal)
  // on a hard reload, while leaving API routes, Next internals, and static
  // assets (any path with a file extension) untouched.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/((?!api/|_next/|.*\\..*).*)", destination: "/" },
      ],
    };
  },
};

export default withWorkflow(nextConfig);
