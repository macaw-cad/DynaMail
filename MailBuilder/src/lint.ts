import { isAbsolute, extname } from 'path';
import { readFile } from 'fs/promises';
import { uniqWith } from 'lodash';
import {
  MJMLParseError,
  components,
  initializeType,
  MJMLJsonObject,
} from 'mjml-core';
import MJMLParser from 'mjml-parser-xml';
import MJMLValidator, { dependencies } from 'mjml-validator';
import { ESLint } from 'eslint';

import { ProjectConfig, prepareMjmlEnv } from './core';

interface LintResult {
  filePath: string;
  errors: MJMLParseError[];
}

export async function lint(
  filePaths: string[],
  project: ProjectConfig,
): Promise<LintResult[]> {
  prepareMjmlEnv(project);

  let results: Record<string, MJMLParseError[]> = {};

  let pushResult = (filePath: string, ...errors: MJMLParseError[]) => {
    results[filePath] = results[filePath] ?? [];
    results[filePath].push(...errors);
  };

  for (let originalPath of filePaths) {
    let filePath = isAbsolute(originalPath)
      ? originalPath
      : project.resolve(originalPath);

    try {
      if (!(await project.exists(filePath))) {
        throw new Error('File does not exists.');
      }

      if (extname(filePath).toLowerCase() !== '.mjml') {
        throw new Error('Given file is not an MJML-file.');
      }

      let content = await readFile(filePath, 'utf-8');
      let tree = MJMLParser(content, { components, filePath });
      let errors = MJMLValidator(tree, {
        components,
        dependencies,
        initializeType,
      });

      if (errors.length > 0) {
        for (let result of splitErrors(filePath, errors, tree)) {
          pushResult(result.filePath, ...result.errors);
        }
      }
    } catch (error) {
      pushResult(filePath, {
        line: 0,
        message: error.message,
        formattedMessage: error.message,
        tagName: 'error',
      });
    }
  }

  return Object.entries(results).map(([filePath, errors]) => ({
    filePath,
    errors: uniqErrors(errors),
  }));
}

export async function formatLintResult(results: LintResult[]): Promise<string> {
  let reports: ESLint.LintResult[] = [];

  for (let result of results) {
    reports.push({
      filePath: result.filePath,
      errorCount: result.errors.length,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      usedDeprecatedRules: [],
      messages: result.errors.map((error) => ({
        severity: 2,
        fatal: true,
        ruleId: error.tagName,
        message: error.message,
        line: error.line,
        column: 0,
      })),
    });
  }

  let eslint = new ESLint({});
  let formatter = await eslint.loadFormatter();
  let output = formatter.format(reports);

  return output;
}

function splitErrors(
  filePath: string,
  errors: MJMLParseError[],
  tree: MJMLJsonObject,
): LintResult[] {
  let grouped: Record<string, MJMLParseError[]> = {};

  for (let error of errors) {
    if (error.formattedMessage.includes('included at line')) {
      let originFilePath =
        findOriginFilePath(filePath, error, tree) ?? filePath;
      grouped[originFilePath] = grouped[originFilePath] ?? [];
      grouped[originFilePath].push(error);
    } else {
      grouped[filePath] = grouped[filePath] ?? [];
      grouped[filePath].push(error);
    }
  }

  return Object.entries(grouped).map(([filePath, errors]) => ({
    filePath,
    errors,
  }));
}

function findOriginFilePath(
  filePath: string,
  error: MJMLParseError,
  tree: MJMLJsonObject,
): string | null {
  if ('children' in tree) {
    for (let child of tree.children) {
      if (
        (child as any).absoluteFilePath !== filePath &&
        (child as any).line === error.line &&
        child.tagName === error.tagName
      ) {
        return (child as any).absoluteFilePath as string;
      }

      let next = findOriginFilePath(filePath, error, child);
      if (next != null) return next;
    }
  }

  return null;
}

function uniqErrors(errors: MJMLParseError[]): MJMLParseError[] {
  return uniqWith(errors, (a, b) => {
    return (
      a.line === b.line && a.tagName === b.tagName && a.message === b.message
    );
  });
}
