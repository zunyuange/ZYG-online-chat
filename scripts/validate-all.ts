#!/usr/bin/env tsx
/**
 * 统一验证入口
 *
 * 运行所有验证器
 * 可以选择性运行特定验证器
 */

import { cwd } from 'node:process';
import { validateTodos, formatTodoErrors } from './validators/todos.validator.js';
import { validateSensitive, formatSensitiveErrors } from './validators/sensitive.validator.js';
import { validateImports, formatImportErrors } from './validators/imports.validator.js';
import projectConfig from './config/project.config.js';

interface ValidatorResult {
  name: string;
  passed: boolean;
  errors: number;
}

async function runAllValidators(): Promise<ValidatorResult[]> {
  const rootPath = cwd();
  const results: ValidatorResult[] = [];

  // 1. TODO 验证
  console.log('🔍 [1/3] Checking TODO/FIXME comments...');
  const todoErrors = validateTodos(projectConfig.todos, rootPath);
  results.push({
    name: 'TODO/FIXME',
    passed: todoErrors.length === 0,
    errors: todoErrors.length,
  });
  if (todoErrors.length > 0) {
    console.error(formatTodoErrors(todoErrors));
  } else {
    console.log('  ✅ No unassigned TODOs found\n');
  }

  // 2. 敏感信息验证
  console.log('🔍 [2/3] Checking for sensitive data...');
  const sensitiveErrors = await validateSensitive(projectConfig.sensitive, rootPath);
  results.push({
    name: 'Sensitive Data',
    passed: sensitiveErrors.length === 0,
    errors: sensitiveErrors.length,
  });
  if (sensitiveErrors.length > 0) {
    console.error(formatSensitiveErrors(sensitiveErrors));
  } else {
    console.log('  ✅ No sensitive data found\n');
  }

  // 3. 导入路径验证
  console.log('🔍 [3/3] Checking import paths...');
  const importErrors = validateImports(projectConfig.imports, rootPath);
  results.push({
    name: 'Import Paths',
    passed: importErrors.length === 0,
    errors: importErrors.length,
  });
  if (importErrors.length > 0) {
    console.error(formatImportErrors(importErrors));
  } else {
    console.log('  ✅ All imports are valid\n');
  }

  return results;
}

async function main() {
  console.log('🚀 Running all validators...\n');

  const results = await runAllValidators();

  // 汇总结果
  const failed = results.filter((r) => !r.passed);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary:');
  console.log('='.repeat(50));

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    console.log(`  ${status} ${result.name}: ${result.errors} error(s)`);
  }

  console.log('='.repeat(50));

  if (failed.length > 0) {
    console.error(`\n❌ Validation failed with ${totalErrors} total error(s)`);
    process.exit(1);
  }

  console.log('\n✅ All validations passed!');
}

main();
