import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (.docx import) and html-to-docx (.docx export) are CommonJS with
  // dynamic requires; keep them out of the server bundle and load from
  // node_modules at runtime.
  serverExternalPackages: ["mammoth", "html-to-docx"],
};

export default nextConfig;
