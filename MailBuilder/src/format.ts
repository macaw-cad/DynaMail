import { readFile, writeFile } from 'fs/promises';
import { extname, isAbsolute } from 'path';
import prettier from 'prettier';

import { readJson, ProjectConfig } from './core';

export interface FormatResult {
  filePath: string;
  action: 'changed' | 'unchanged' | 'ignored' | 'error';
}

export async function format(
  filePaths: string[],
  project: ProjectConfig,
): Promise<FormatResult[]> {
  let result: FormatResult[] = [];

  for (let originalPath of filePaths) {
    let filePath = isAbsolute(originalPath)
      ? originalPath
      : project.resolve(originalPath);

    try {
      if (!(await project.exists(filePath))) {
        throw new Error('File does not exists.');
      }

      if (extname(filePath).toLowerCase() !== '.mjml') {
        result.push({ filePath, action: 'ignored' });
        continue;
      }

      let content = await readFile(filePath, 'utf-8');
      let config = await getPrettierConfig(project);

      let formatted = prettier.format(prepareContent(content), {
        ...config,
        parser: 'html',
      });

      formatted = restoreContent(formatted);

      let action: FormatResult['action'] =
        formatted !== content ? 'changed' : 'unchanged';

      if (action === 'changed') {
        await writeFile(filePath, formatted);
      }

      result.push({ filePath, action });
    } catch (error) {
      result.push({ filePath, action: 'error' });
      console.error(error);
    }
  }

  return result;
}

function prepareContent(content: string) {
  return content.replace(/mj-style>/g, 'style>');
}

function restoreContent(content: string) {
  return content
    .replace(/<style>/g, '<mj-style>')
    .replace(/<\/style>/g, '</mj-style>');
}

async function getPrettierConfig(
  project: ProjectConfig,
): Promise<prettier.Options | null> {
  try {
    if ('prettier' in project.packageJson) {
      return project.packageJson.prettier;
    }

    if (await project.exists('.prettierrc')) {
      return readJson<prettier.Options>(project.resolve('.prettierrc'));
    }

    return null;
  } catch (error) {
    return null;
  }
}
