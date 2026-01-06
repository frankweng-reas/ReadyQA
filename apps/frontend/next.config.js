const withNextIntl = require('next-intl/plugin')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@qaplus/shared'],
}

module.exports = withNextIntl(nextConfig);
