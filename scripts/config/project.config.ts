/**
 * 项目特定的验证配置
 *
 * 这个文件包含所有项目特定的配置参数
 * 通用验证脚本将读取这些配置执行检测
 */

import type {
  TodosConfig,
  SensitiveConfig,
  ImportsConfig,
} from '../validators/index.js';

// ============================================
// TODO/FIXME 验证配置
// ============================================
export const todosConfig: TodosConfig = {
  // 需要检测的关键词
  keywords: ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'],

  // 允许的模式（例如 @author 表示已归属）
  allowedPattern: /@(\w+)/,

  // 忽略的目录
  ignoreDirs: ['node_modules', 'dist', '__tests__', '.git', 'coverage'],

  // 检查的目录
  checkDirs: ['src', 'scripts'],
};

// ============================================
// 敏感信息检测配置
// ============================================
export const sensitiveConfig: SensitiveConfig = {
  // 敏感信息模式列表
  patterns: [
    // API Keys
    {
      pattern: /API[_-]?KEY\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
      message: 'API Key detected',
      excludePattern: /process\.env\./,
    },
    {
      pattern: /GEMINI[_-]?API[_-]?KEY\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
      message: 'Gemini API Key detected',
      excludePattern: /process\.env\./,
    },
    // Passwords
    {
      pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
      message: 'Hardcoded password detected',
    },
    {
      pattern: /passwd\s*[:=]\s*['"][^'"]{8,}['"]/i,
      message: 'Hardcoded password detected',
    },
    // Tokens
    {
      pattern: /token\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      message: 'Hardcoded token detected',
      excludePattern: /process\.env\.|authToken|csrfToken/,
    },
    // Secret
    {
      pattern: /secret\s*[:=]\s*['"][a-zA-Z0-9_-]{10,}['"]/i,
      message: 'Hardcoded secret detected',
      excludePattern: /process\.env\.|jwtSecret/,
    },
    // Console.log (开发调试遗留)
    {
      pattern: /console\.(log|debug)\(/,
      message: 'console.log detected (remove in production)',
      excludePattern: /\/\/.*console\.|logger\.|scripts\/(validate|test)/,
    },
    // .env 文件引用
    {
      pattern: /['"`]\.env(?:\.\w+)?['"`]/,
      message: '.env file reference in string literal',
      excludePattern: /\.env\.example/,
    },
  ],

  // 忽略的文件模式
  ignorePatterns: [
    /node_modules/,
    /dist/,
    /\.git/,
    /coverage/,
    /\.env\.example$/,
    /__tests__/,
    /scripts\/(validate|config)/,
  ],

  // 检查的文件扩展名
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],

  // 检查的目录
  checkDirs: ['src', 'scripts'],
};

// ============================================
// 导入路径验证配置
// ============================================
export const importsConfig: ImportsConfig = {
  // 项目模块定义
  modules: ['shared', 'client', 'server'] as const,

  // 源代码目录
  srcDir: 'src',

  // 路径别名映射
  aliases: {
    shared: '@shared',
    client: '@client',
    server: '@server',
  },

  // ⭐ 触发跨模块检测的最小相对深度
  // ../ = 1 (允许，同模块内)
  // ../../ = 2 (禁止，跨模块)
  minCrossModuleDepth: 2,

  // 忽略的目录
  ignoreDirs: ['node_modules', 'dist', '.git', 'build'],

  // 检查的目录
  checkDirs: ['src', 'scripts'],
};

// ============================================
// 统一导出
// ============================================
export const projectConfig = {
  todos: todosConfig,
  sensitive: sensitiveConfig,
  imports: importsConfig,
} as const;

export default projectConfig;
