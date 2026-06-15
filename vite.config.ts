import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import devServer from '@hono/vite-dev-server';

export default defineConfig(({ mode }) => {
  // 加载环境变量（包括非 VITE_ 前缀的）
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 将环境变量注入到服务端
    define: {
      'process.env.BARK_KEY': JSON.stringify(env.BARK_KEY || ''),
      'process.env.BARK_API': JSON.stringify(env.BARK_API || 'https://api.day.app'),
      'process.env.STAFF_URL_BASE': JSON.stringify(env.STAFF_URL_BASE || 'http://localhost:3010/staff'),
    },
    server: {
      port: 3010,
      host: '0.0.0.0',
      hmr: {
        overlay: true,
      },
      // Serve uploaded files
      fs: {
        allow: ['..'],
      },
    },
    plugins: [
      react(),
      devServer({
        entry: 'src/server/index.node.ts',
        exclude: [
          // Paths that Vite should handle (not Hono)
          // Note: /uploads and /api/* will be handled by Hono
          /^\/$/,
          /^\/chat/,
          /^\/staff/,
          /^\/todo/,
          /^\/(@[a-zA-Z0-9_-]+|src|node_modules|__inspect|index\.html)/,
        ],
      }),
    ],
    // Configure public directory and static file serving
    publicDir: 'public',
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@client': path.resolve(__dirname, 'src/client'),
        '@server': path.resolve(__dirname, 'src/server'),
      },
    },
  };
});
