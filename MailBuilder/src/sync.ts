import axios from 'axios';
import ora from 'ora';

import { buildTemplate } from './build';
import { ProjectConfig, Template } from './core';

interface SendOptions {
  apiKey: string;
  dryRun: boolean;
  output: 'pretty' | 'json';
}

interface Comparable {
  template: Template;
  content: string;
  remoteContent: string;
}

const sendgrid = axios.create({ baseURL: 'https://api.sendgrid.com/v3/' });

export async function sync(
  project: ProjectConfig,
  options: SendOptions,
): Promise<void> {
  sendgrid.defaults.headers = { Authorization: `Bearer ${options.apiKey}` };

  let spinner = ora('Bundling templates and fetching remote versions').start();

  try {
    let templates: Comparable[] = await Promise.all(
      project.templates.map(async (template) => {
        let [content, remoteContent] = await Promise.all([
          buildTemplate(template, project),
          fetchRemoteContent(template),
        ]);

        return { template, content, remoteContent };
      }),
    );

    spinner.succeed();
    spinner.start('Compare against what is on SendGrid');

    let updated = templates.filter(
      ({ content, remoteContent }) => content !== remoteContent,
    );

    spinner.succeed();

    if (!options.dryRun) {
      spinner.start('Syncing templates');
      await Promise.all(
        updated.map(({ template, content }) => {
          return updateRemoteContent(template, content);
        }),
      );
    }

    spinner.succeed();
    console.error('\n'); // Empty line not on stdout to keep stdout clean

    if (options.output === 'json') {
      console.log(JSON.stringify(updated.map(({ template }) => template)));
    } else {
      let verb = options.dryRun ? 'Changes affect' : 'Updated';
      console.log(`${verb} ${updated.length} templates(s) on SendGrid`);
      for (let template of updated) {
        console.log(`- ${template.template.name}`);
      }
    }
  } catch (error) {
    spinner.fail('Failed to sync templates.');
    console.error(error);
    throw error;
  }
}

interface SendGridTemplateResponse {
  versions: { active: 0 | 1; html_content: string }[];
}

async function fetchRemoteContent(template: Template): Promise<string> {
  let { data } = await sendgrid.get<SendGridTemplateResponse>(
    `/templates/${template.id}`,
  );

  let activeTemplate = data.versions.find((v) => v.active === 1);
  if (activeTemplate) return activeTemplate.html_content;
  return '';
}

async function updateRemoteContent(
  template: Template,
  content: string,
): Promise<void> {
  await sendgrid({
    method: 'post',
    url: `/templates/${template.id}/versions`,
    data: {
      template_id: template.id,
      active: true,
      name: getFormattedDate(new Date()),
      html_content: content,
      subject: template.subject ?? '',
    },
  });
}

function getFormattedDate(date: Date) {
  let year = date.getFullYear();
  let month = `${date.getMonth() + 1}`.padStart(2, '0');
  let day = `${date.getDate()}`.padStart(2, '0');
  let hour = `${date.getHours()}`.padStart(2, '0');
  let minute = `${date.getMinutes()}`.padStart(2, '0');
  let second = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
