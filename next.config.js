const { THEME } = require('./blog.config');
const fs = require('fs');
const path = require('path');
const BLOG = require('./blog.config');
const { extractLangPrefix } = require('./lib/utils/pageId');

// 打包时是否分析代码
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
});

// 扫描项目 /themes 下的目录名
const themes = scanSubdirectories(path.resolve(__dirname, 'themes'));

// 检测用户开启的多语言
const locales = (function () {
  const langs = [BLOG.LANG];
  if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
    const siteIds = BLOG.NOTION_PAGE_ID.split(',');
    for (let index = 0; index < siteIds.length; index++) {
      const siteId = siteIds[index];
      const prefix = extractLangPrefix(siteId);
      if (prefix) {
        if (!langs.includes(prefix)) {
          langs.push(prefix);
        }
      }
    }
  }
  return langs;
})();

// 编译前执行
const preBuild = (function () {
  if (process.env.npm_lifecycle_event !== 'export' && process.env.npm_lifecycle_event !== 'build') {
    return;
  }

  // 删除 sitemap.xml 文件，避免与 /pages/sitemap.xml.js 冲突
  const sitemapPath = path.resolve(__dirname, 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    fs.unlinkSync(sitemapPath);
    console.log('Deleted existing sitemap.xml from public directory');
  }

  const sitemap2Path = path.resolve(__dirname, 'sitemap.xml');
  if (fs.existsSync(sitemap2Path)) {
    fs.unlinkSync(sitemap2Path);
    console.log('Deleted existing sitemap.xml from root directory');
  }
})();

/**
 * 扫描指定目录下的文件夹名，用于获取所有主题
 * @param {*} directory
 * @returns
 */
function scanSubdirectories(directory) {
  const subdirectories = [];

  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      subdirectories.push(file);
    }
  });

  return subdirectories;
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  // 设置输出目录为 dist
  output: process.env.EXPORT ? 'export' : undefined,
  distDir: 'dist',  // 确保输出目录为 dist
  staticPageGenerationTimeout: 120,
  // 多语言，在 export 时禁用
  i18n: process.env.EXPORT
    ? undefined
    : {
        defaultLocale: BLOG.LANG,
        locales: locales
      },
  images: {
    // 图片压缩
    formats: ['image/avif', 'image/webp'],
    // 允许 next/image 加载的图片域名
    domains: [
      'gravatar.com',
      'www.notion.so',
      'avatars.githubusercontent.com',
      'images.unsplash.com',
      'source.unsplash.com',
      'p1.qhimg.com',
      'webmention.io',
      'ko-fi.com'
    ]
  },

  // 默认将 feed 重定向至 /public/rss/feed.xml
  redirects: process.env.EXPORT
    ? undefined
    : () => [
        {
          source: '/feed',
          destination: '/rss/feed.xml',
          permanent: true
        }
      ],
  
  // 重写 URL
  rewrites: process.env.EXPORT
    ? undefined
    : () => {
        const langsRewrites = [];
        if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
          const siteIds = BLOG.NOTION_PAGE_ID.split(',');
          const langs = [];
          for (let index = 0; index < siteIds.length; index++) {
            const siteId = siteIds[index];
            const prefix = extractLangPrefix(siteId);
            if (prefix) {
              langs.push(prefix);
            }
            console.log('[Locales]', siteId);
          }

          langsRewrites.push(
            {
              source: `/:locale(${langs.join('|')})/:path*`,
              destination: '/:path*'
            },
            {
              source: `/:locale(${langs.join('|')})`,
              destination: '/'
            },
            {
              source: `/:locale(${langs.join('|')})/`,
              destination: '/'
            }
          );
        }

        return [
          ...langsRewrites,
          {
            source: '/:path*.html',
            destination: '/:path*'
          }
        ];
      },

  headers: process.env.EXPORT
    ? undefined
    : () => [
        {
          source: '/:path*{/}?',
          headers: [
            { key: 'Access-Control-Allow-Credentials', value: 'true' },
            { key: 'Access-Control-Allow-Origin', value: '*' },
            {
              key: 'Access-Control-Allow-Methods',
              value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT'
            },
            {
              key: 'Access-Control-Allow-Headers',
              value:
                'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
            }
          ]
        }
      ],
  
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname);

    if (!isServer) {
      console.log('[默认主题]', path.resolve(__dirname, 'themes', THEME));
    }

    config.resolve.alias['@theme-components'] = path.resolve(__dirname, 'themes', THEME);
    
    if (process.env.NODE_ENV_API === 'development') {
      config.devtool = 'source-map';
    }
    return config;
  },
  experimental: {
    scrollRestoration: true
  },

  // export 静态导出时忽略 /pages/sitemap.xml.js ，避免和 getServerSideProps 冲突
  exportPathMap: function (defaultPathMap, { dev, dir, outDir, distDir, buildId }) {
    const pages = { ...defaultPathMap };
    delete pages['/sitemap.xml'];
    delete pages['/auth'];
    return pages;
  },
  publicRuntimeConfig: {
    THEMES: themes
  }
};

module.exports = process.env.ANALYZE
  ? withBundleAnalyzer(nextConfig)
  : nextConfig;
