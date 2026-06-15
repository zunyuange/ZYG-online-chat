/**
 * 敏感信息检测验证器（通用版本）
 *
 * 防止将敏感信息提交到代码仓库
 * 可配置检测模式、忽略规则、文件类型等
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SensitiveConfig, SensitiveError } from './index.js';

/**
 * 检查单个文件中的敏感信息
 */
function checkFileSensitiveData(
  filePath: string,
  rootPath: string,
  config: SensitiveConfig
): SensitiveError[] {
  const content = readFileSync(filePath, 'utf-8');
  const errors: SensitiveError[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 跳过注释行
    if (
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('#') ||
      trimmedLine.startsWith('/*') ||
      trimmedLine.startsWith('*')
    ) {
      continue;
    }

    // 检查敏感信息模式
    for (const rule of config.patterns) {
      if (rule.pattern.test(trimmedLine)) {
        // 检查是否有排除模式（如 process.env）
        if (rule.excludePattern && rule.excludePattern.test(trimmedLine)) {
          continue;
        }

        // 检查文件是否在忽略列表中
        const relativePath = relative(rootPath, filePath);
        if (config.ignorePatterns?.some((pattern) => pattern.test(relativePath))) {
          continue;
        }

        errors.push({
          file: relativePath,
          line: i + 1,
          message: rule.message,
          content: trimmedLine.substring(0, 100) + (trimmedLine.length > 100 ? '...' : ''),
        });
        break; // 每行只报告一个错误
      }
    }
  }

  return errors;
}

/**
 * 扫描目录中的所有文件
 */
function scanDirectory(
  rootPath: string,
  targetDir: string,
  config: SensitiveConfig
): SensitiveError[] {
  const errors: SensitiveError[] = [];
  const targetPath = join(rootPath, targetDir);

  if (!existsSync(targetPath)) {
    return errors;
  }

  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // 跳过忽略的目录
        if (!config.ignorePatterns?.some((pattern) => pattern.test(entry.name))) {
          scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        // 检查文件扩展名
        const hasMatchingExtension = config.fileExtensions.some((ext) =>
          entry.name.endsWith(ext)
        );

        if (hasMatchingExtension) {
          const fileErrors = checkFileSensitiveData(fullPath, rootPath, config);
          errors.push(...fileErrors);
        }
      }
    }
  }

  scanDir(targetPath);
  return errors;
}

/**
 * 检查 .env 文件是否被 Git 追踪
 */
async function checkEnvFiles(rootPath: string): Promise<SensitiveError[]> {
  const { execSync } = await import('node:child_process');
  const errors: SensitiveError[] = [];

  try {
    const trackedFiles = execSync('git ls-files', {
      cwd: rootPath,
      encoding: 'utf-8',
    });

    const envFiles = trackedFiles
      .split('\n')
      .filter((line: string) => line.trim() && /^\.env$/i.test(line.trim()));

    for (const envFile of envFiles) {
      errors.push({
        file: envFile,
        line: 0,
        message: '.env file should not be committed to Git',
        content: 'Add to .gitignore or use .env.example instead',
      });
    }
  } catch {
    // Git 命令失败（可能不是 Git 仓库），忽略
  }

  return errors;
}

/**
 * 主验证函数
 */
export async function validateSensitive(
  config: SensitiveConfig,
  rootPath: string
): Promise<SensitiveError[]> {
  const allErrors: SensitiveError[] = [];

  // 检查 .env 文件
  const envErrors = await checkEnvFiles(rootPath);
  allErrors.push(...envErrors);

  // 扫描目录
  for (const dir of config.checkDirs) {
    const errors = scanDirectory(rootPath, dir, config);
    allErrors.push(...errors);
  }

  return allErrors;
}

/**
 * 格式化错误输出
 */
export function formatSensitiveErrors(errors: SensitiveError[]): string {
  if (errors.length === 0) return '';

  let output = `❌ Found ${errors.length} sensitive data issue(s):\n\n`;

  for (const err of errors) {
    if (err.line > 0) {
      output += `  ${err.file}:${err.line}:\n`;
    } else {
      output += `  ${err.file}:\n`;
    }
    output += `    ${err.content}\n`;
    output += `    → ${err.message}\n\n`;
  }

  output += '📋 Security Guidelines:\n';
  output += '  - Use environment variables for sensitive data\n';
  output += '  - Add .env files to .gitignore\n';
  output += '  - Use .env.example as a template\n';
  output += '  - Remove console.log statements before committing\n';

  return output;
}
