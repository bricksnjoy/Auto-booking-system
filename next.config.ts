import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos of bills and salary slips are sent through server actions. The
      // default 1MB turns away an ordinary phone photo; Vercel itself refuses
      // request bodies over 4.5MB, so this stays just under that.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
