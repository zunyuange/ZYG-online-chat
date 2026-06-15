/**
 * 通用验证器的类型定义
 */

// ============================================
// TODO/FIXME 验证配置
// ============================================
export interface TodosConfig {
  keywords: string[];
  allowedPattern: RegExp;
  ignoreDirs: string[];
  checkDirs: string[];
}

export interface TodoError {
  file: string;
  line: number;
  keyword: string;
  content: string;
}

// ============================================
// 敏感信息检测配置
// ============================================
export interface PatternRule {
  pattern: RegExp;
  message: string;
  excludePattern?: RegExp;
}

export interface SensitiveConfig {
  patterns: PatternRule[];
  ignorePatterns?: RegExp[];
  fileExtensions: string[];
  checkDirs: string[];
}

export interface SensitiveError {
  file: string;
  line: number;
  message: string;
  content: string;
}

// ============================================
// 导入路径验证配置
// ============================================
export type ModuleName = string;

export interface ImportsConfig {
  modules: readonly ModuleName[];
  srcDir: string;
  aliases: Record<string, string>;
  minCrossModuleDepth: number;
  ignoreDirs: string[];
  checkDirs: string[];
}

export interface ImportError {
  file: string;
  importPath: string;
  suggestion: string;
}
