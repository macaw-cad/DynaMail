import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { constants } from 'fs';
import { access, readFile } from 'fs/promises';
import readPkgUp, { NormalizedPackageJson } from 'read-pkg-up';
import * as z from 'zod';
import mjml2html from 'mjml';
import { registerComponent } from 'mjml-core';

export const TemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    template: z.string(),
    language: z.string().optional(),
    subject: z.string().optional(),
  })
  .nonstrict();

export const TemplateConfigSchema = z.object({
  templates: z.array(TemplateSchema),
  preprocessors: z.array(z.string()).optional(),
  postprocessors: z.array(z.string()).optional(),
});

export type Template = z.infer<typeof TemplateSchema>;
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export type CodeProcessor = (
  source: string,
  template: Template,
  project: ProjectConfig,
) => string | Promise<string>;

export interface ProjectConfig {
  mode: 'dev' | 'prod';
  root: string;
  packageJson: NormalizedPackageJson;
  mjmlConfigPath: string | null;
  mjmlComponents: string[];
  templates: Template[];
  preprocessors: CodeProcessor[];
  postprocessors: CodeProcessor[];
  /**
   * Resolve will build a file path relative from the project root.
   * @param filePath Path relative to project root that should be resolve
   */
  resolve(filePath: string): string;
  /**
   * Relative will make an absolute path relative to the project root.
   * @param filePath Path to transform into relative version from project root
   */
  relative(filePath: string): string;
  /**
   * Check if a given file path exists on the file system.
   * @param filePath File path to check if it exists
   */
  exists(filePath: string): Promise<boolean>;
  /**
   * Read json config from a given directory recursively searching downwards
   * among the directories, until reaching project root.
   * @param fileNames File names to look for
   * @param dir Directory to start looking in
   */
  readConfig<T>(
    fileNames: string[],
    dir: string,
  ): Promise<{ config: T; filePath: string } | null>;
}

/**
 * Get relevant project data in order to properly execute commands
 * @param cwd Current working directory
 */
export async function getProjectConfig(
  cwd: string,
  mode: 'dev' | 'prod',
): Promise<ProjectConfig> {
  let result = await readPkgUp({ cwd, normalize: true });

  if (result == null) {
    throw new Error('Could not read package.json.');
  }

  let projectRoot = dirname(result.path);
  let projectResolve = (filePath: string) => resolve(projectRoot, filePath);
  let projectRelative = (filePath: string) => relative(projectRoot, filePath);
  let projectExists = async (filePath: string) => {
    return exists(isAbsolute(filePath) ? filePath : projectResolve(filePath));
  };

  let projectReadConfig = async <T>(
    fileNames: string[],
    dir: string,
  ): Promise<{ config: T; filePath: string } | null> => {
    for (let fileName of fileNames) {
      let filePath = join(dir, fileName);
      if (await exists(filePath)) {
        let config = await readJson<T>(filePath);
        return { config, filePath };
      }
    }

    let nextDirectory = dirname(dir);
    if (nextDirectory.includes(projectRoot)) {
      return projectReadConfig(fileNames, nextDirectory);
    }

    return null;
  };

  let mjmlComponents: string[] = [];

  let mjml = await projectReadConfig<{ packages?: string[] }>(
    ['.mjmlconfig'],
    projectRoot,
  );

  for (let relPath of mjml?.config.packages ?? []) {
    mjmlComponents.push(projectResolve(relPath));
  }

  const templatesConfig = await TemplateConfigSchema.parseAsync(
    await readJson(projectResolve('./templates.json')),
  );

  let preprocessors = (await Promise.all(
    (templatesConfig.preprocessors ?? []).map((filePath) =>
      import(projectResolve(filePath)).then((mod) => mod.default),
    ),
  )) as CodeProcessor[];

  let postprocessors = (await Promise.all(
    (templatesConfig.postprocessors ?? []).map((filePath) =>
      import(projectResolve(filePath)).then((mod) => mod.default),
    ),
  )) as CodeProcessor[];

  return {
    mode,
    root: projectRoot,
    mjmlConfigPath: mjml?.filePath ?? null,
    mjmlComponents,
    packageJson: result.packageJson,
    templates: templatesConfig.templates.sort((a, b) => {
      return a.name.localeCompare(b.name);
    }),
    preprocessors,
    postprocessors,
    resolve: projectResolve,
    relative: projectRelative,
    exists: projectExists,
    readConfig: projectReadConfig,
  };
}

/**
 * To use custom components in MJML one needs to register them. This is often
 * taken care of for us when using the main export from mjml or mjml-core.
 * But e.g. the lint command uses other ways to get the result.
 * We therefore need to "warm up" the mjml environment by registering all
 * components and their dependencies.
 *
 * @param project Project data
 */
export async function prepareMjmlEnv(project: ProjectConfig) {
  mjml2html('<mjml><mj-body></mj-body></mjml>');
  for (let componentPath of project.mjmlComponents) {
    if (!(await exists(componentPath))) {
      throw new Error(
        `Custom component ${project.relative(
          componentPath,
        )} does not exist at path ${componentPath}`,
      );
    }
    try {
      delete require.cache[componentPath];
    } catch (error) {}

    try {
      let comp = require(componentPath);
      registerComponent(comp);
    } catch (error) {
      throw new Error(
        `Could not load custom component ${project.relative(
          componentPath,
        )} from path ${componentPath} [ERROR: ${error.toString()}]`,
      );
    }
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  let content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function measure<T>(
  callback: () => Promise<T>,
): Promise<[number, T]> {
  let start = process.hrtime();
  let result = await callback();
  let [, nanoseconds] = process.hrtime(start);

  return [nanoseconds / 1000000, result];
}
