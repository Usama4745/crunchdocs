import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (.docx import) is CommonJS with dynamic requires; keep it out of
  // the server bundle and load from node_modules at runtime.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
