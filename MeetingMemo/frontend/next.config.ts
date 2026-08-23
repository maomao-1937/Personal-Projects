import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:8100").replace(
  /\/$/,
  "",
);
const staticExport = process.env.MEETINGMEMO_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  poweredByHeader: false,
  ...(staticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/v1/:path*",
              destination: `${backendUrl}/api/v1/:path*`,
            },
            {
              source: "/health/:path*",
              destination: `${backendUrl}/health/:path*`,
            },
          ];
        },
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=()",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
