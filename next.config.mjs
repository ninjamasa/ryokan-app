/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // three.js を transpile してサーバー側の互換を確保
  transpilePackages: ["three"],
};

export default nextConfig;
