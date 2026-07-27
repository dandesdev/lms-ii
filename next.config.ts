import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // DevTools toggle to inspect static shells vs streamed dynamic content.
    instantNavigationDevToolsToggle: true,
  },
};

export default nextConfig;
