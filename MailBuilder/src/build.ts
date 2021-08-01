import { fstat, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, resolve, join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import mjml2html from 'mjml';
import {
  prepareMjmlEnv,
  measure,
  ProjectConfig,
  CodeProcessor,
  Template,
} from './core';
import { inlineIncludes, preprocessors, postprocessors } from './pipes';

export interface BuildResult {
  name: string;
  sourcePath: string;
  distPath: string;
  size: number;
  duration: number;
}
export async function build(project: ProjectConfig): Promise<BuildResult[]> {
  prepareMjmlEnv(project);
  await ensureDirectory('dist', project);

  let results: BuildResult[] = [];

  for (let template of project.templates) {
    console.log(`Building template '${template.name} - ${template.language}'`);
    let [duration, result] = await measure(async () => {
      let distPath = project.resolve(
        join('dist', `${template.name}.${template.language}.html`),
      );
      let sourcePath = project.resolve(template.template);

      let html = await buildTemplate(template, project);
      await writeFile(distPath, html);

      const subject = await buildSubject(template, project);
      const subjectPath = join(
        project.root,
        `dist/${template.name}.${template.language}.subject.hbs`,
      );
      writeFileSync(subjectPath, subject, { encoding: 'utf8' });   

      return {
        sourcePath,
        distPath,
        size: Buffer.byteLength(Buffer.from(html)),
      };
    });

    results.push({ ...result, name: template.name, duration });
  }

  return results;
}

export async function buildTemplate(
  template: Template,
  project: ProjectConfig,
): Promise<string> {
  let sourcePath = project.resolve(template.template);
  let mjml = await readFile(sourcePath, 'utf-8');
  let source = await processCode(mjml, {
    template,
    project,
    pipe: [inlineIncludes, ...project.preprocessors, ...preprocessors],
  });

  let { html } = mjml2html(source, {
    filePath: sourcePath,
    validationLevel: 'strict',
    ...(project.mjmlConfigPath
      ? { mjmlConfigPath: project.mjmlConfigPath }
      : null),
  });
  
  const result = processCode(html, {
    template,
    project,
    pipe: [...postprocessors, ...project.postprocessors],
  });

  return result;
}

export async function buildSubject(
  template: Template,
  project: ProjectConfig,
): Promise<string> {
  if (template.language == null) {
    throw new Error(
      `For template '${template.name}' the template language is not defined.`,
    );
  }

  let context = await project.readConfig<
    Record<string, Record<string, string>>
  >(['translations.json'], dirname(project.resolve(template.template)));

  if (context == null) {
    throw new Error(
      `For template '${template.name}' the context null (no translations.json?).`,
    );
  }

  let translations = context.config[template.language] ?? {};
  let subject = translations.subject;
  if (!subject) {
    throw new Error(
      `For template '${template.name}' the file 'translations.json' is missing the entry 'subject' for language '${template.language}'`,
    );
  }

  
  return subject;
}

export async function ensureDirectory(
  directoryPath: string,
  project: ProjectConfig,
): Promise<void> {
  let exists = await project.exists(directoryPath);
  if (!exists) {
    let fullPath = project.resolve(directoryPath);
    await mkdir(fullPath, { recursive: true });
  }
}

export interface ProcessCodeOptions {
  template: Template;
  project: ProjectConfig;
  pipe: CodeProcessor[];
}

async function processCode(
  code: string,
  { template, pipe, project }: ProcessCodeOptions,
): Promise<string> {
  for (let handler of pipe) {
    code = await handler(code, template, project);
  }

  return code;
}
