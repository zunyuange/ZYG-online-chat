import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // 集成测试使用 node 环境
    setupFiles: ['./vitest.integration.setup.ts'],
    include: ['**/integration/**/*.test.ts', '**/integration/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    env: {
      NODE_ENV: 'test',
      // 使用 SQLite 作为集成测试数据库
      DB_PATH: ':memory:', // 内存数据库，每次测试后自动清空
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@client': path.resolve(__dirname, './src/client'),
      '@server': path.resolve(__dirname, './src/server'),
    },
  },
});
