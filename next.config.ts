import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (.docx parsing) and its deps are CommonJS with dynamic requires;
  // keep them out of the server bundle and load from node_modules at runtime.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
