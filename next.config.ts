import type { NextConfig } from "next";

// Baseline browser protections for every response
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Resume text extraction runs only on the server; load these from node_modules as-is
  serverExternalPackages: ["unpdf", "mammoth", "word-extractor"],
  // The India location dataset is read from disk by the server routes that use it
  outputFileTracingIncludes: {
    "/api/geo": ["./src/lib/geo/india-locations.json"],
    "/api/admin/jobs": ["./src/lib/geo/india-locations.json"],
    "/api/admin/jobs/[id]": ["./src/lib/geo/india-locations.json"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
