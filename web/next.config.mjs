/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // allow the camera for this site only (the contract takes live frames, never uploads)
    return [{ source: "/(.*)", headers: [{ key: "Permissions-Policy", value: "camera=(self)" }] }];
  },
};

export default nextConfig;
