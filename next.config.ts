import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Keep native deps out of the bundle (ssh2 ships `.node` bindings).
  serverExternalPackages: ["ssh2-sftp-client", "ssh2", "better-sqlite3"],
};

export default nextConfig;
