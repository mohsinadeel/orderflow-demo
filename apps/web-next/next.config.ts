import type { NextConfig } from 'next';

const basePath = process.env.ORDERFLOW_BASE_PATH ?? '';
const config: NextConfig = { output: 'standalone', basePath, turbopack: { root: process.cwd() } };
export default config;
