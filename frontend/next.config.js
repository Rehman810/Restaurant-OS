/** @type {import('next').NextConfig} */
const proxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") || "http://127.0.0.1:4000";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
let apiPattern = { protocol: "http", hostname: "localhost", port: "4000", pathname: "/uploads/**" };
try {
  if (apiUrl && !apiUrl.startsWith("/")) {
    const parsed = new URL(apiUrl);
    apiPattern = {
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: "/uploads/**",
    };
  } else {
    const parsed = new URL(proxyTarget);
    apiPattern = {
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: "/uploads/**",
    };
  }
} catch {
  /* keep localhost default */
}

const nextConfig = {
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      apiPattern,
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${proxyTarget}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
