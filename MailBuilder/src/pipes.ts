import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, resolve } from 'path';
import * as handlebars from 'handlebars';
import lodash from 'lodash';

import { Template, ProjectConfig, CodeProcessor } from './core';

export const preprocessors: CodeProcessor[] = [
  injectLang,
  compileTranslations,
  compileHandlebars,
];
export const postprocessors: CodeProcessor[] = [removeRawTags];

export function inlineIncludes(
  code: string,
  template: Template,
  project: ProjectConfig,
) {
  function includePartials(src: string, basePath: string): string {
    let replacedCode = src.replace(
      /<mj-include path="([^"]*)" \/>/g,
      (_, includePath) => {
        let absolutePath = resolve(basePath, includePath);
        let content = readFileSync(absolutePath, 'utf-8');
        return includePartials(content, dirname(absolutePath));
      },
    );

    return replacedCode;
  }

  return includePartials(code, dirname(project.resolve(template.template)));
}

function injectLang(code: string, template: Template): string {
  return code.replace(
    '<mj-head>',
    `<mj-head><mj-attributes><mj-all lang="${template.language}" /></mj-attributes>`,
  );
}

async function compileHandlebars(
  code: string,
  template: Template,
  project: ProjectConfig,
): Promise<string> {
  // Load HandlebarsHelpers compiled module dynamically, but remove from require cache first.
  // Note that import(...) does not reload if changed on disk, and cache can't be purged. 
  const keys = Object.keys(require.cache);
  const key = keys.find((k) => k.includes('HandlebarsHelpers')); // folder HandlebarsHelpers in path
  delete require.cache[key];
  const registerHelpers = require('@dynamail/handlebarshelpers').default;
  registerHelpers(handlebars);

  if (project.mode === 'prod') {
    let re = /\{\{\s*(#|\/|else).*\}\}/g;
    return code.replace(re, (match) => `<mj-raw>${match}</mj-raw>`);
  }

  let context = await project.readConfig<Record<string, any>>(
    [
      template.name + '.json',
      basename(template.template, extname(template.template)) + '.json',
      'data.json',
    ],
    dirname(project.resolve(template.template)),
  );

  if (project.mode === 'dev') {
    let hbs = handlebars.compile(code);
    return hbs({ ...template, ...(context?.config ?? {}) });
  }

  return code;
}

async function compileTranslations(
  code: string,
  template: Template,
  project: ProjectConfig,
): Promise<string> {
  if (template.language == null) return code;

  let context = await project.readConfig<
    Record<string, Record<string, string>>
  >(['translations.json'], dirname(project.resolve(template.template)));

  if (context == null) return code;

  let translations = context.config[template.language] ?? {};
  let compiled = lodash.template(code, {
    sourceURL: project.resolve(template.template),
  });

  return compiled(translations);
}

function removeRawTags(code: string): string {
  return code.replace(/<mj-raw>/g, '').replace(/<\/mj-raw>/g, '');
}
