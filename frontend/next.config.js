/** @type {import('next').NextConfig} */
function absolutizeOrigin(raw, fallback) {
  let url = String(raw || "").trim().replace(/\/+$/, "");
  if (!url) url = fallback;
  // Without http(s):// the browser treats "ip:port" as a relative path and loops.
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url;
}

const backendUrl = absolutizeOrigin(
  process.env.BACKEND_URL,
  "http://localhost:4000"
);

const nextConfig = {
  allowedDevOrigins: ["192.168.4.201", "localhost", "127.0.0.1", "209.145.53.40"],
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
