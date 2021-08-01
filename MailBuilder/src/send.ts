import axios from 'axios';
import inquirer from 'inquirer';
import { nanoid } from 'nanoid';
import ora from 'ora';

import { buildTemplate } from './build';
import { ProjectConfig, Template } from './core';

interface SendOptions {
  defaults: Partial<Answers>;
}

interface Answers {
  template: Template;
  to: string;
  from: string;
  subject: string;
  apiKey: string;
}

export async function send(
  project: ProjectConfig,
  options: SendOptions,
): Promise<void> {
  let answers = await inquirer.prompt<Answers>([
    {
      type: 'list',
      name: 'template',
      message: 'Select a template to send',
      choices: project.templates.map((template) => ({
        name: `${template.name} (${template.language})`,
        value: template,
      })),
    },
    {
      type: 'input',
      name: 'to',
      message: 'To (separate multiple emails by commas)',
      default: options.defaults['to'],
      validate: (input: string) => {
        return (
          input
            .split(',')
            .map((email) => validateEmail(email.trim()))
            .every((valid) => valid) || 'One of the emails are incorrect'
        );
      },
    },
    {
      type: 'input',
      name: 'from',
      message: 'From',
      default: options.defaults['from'],
      validate: (input) => {
        return validateEmail(input.trim()) || 'The email is incorrect';
      },
    },
    {
      type: 'input',
      name: 'subject',
      message: 'Email subject',
      default: ({ template }: Answers) => {
        return `[test] ${template.name} (${nanoid()})`;
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'Sendgrid api key',
      default: options.defaults['apiKey'],
    },
  ]);

  let spinner = ora('Sending out test emails').start();

  try {
    let content = await buildTemplate(answers.template, project);
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: answers.to
          .split(',')
          .map((email) => ({ to: [{ email }] })),
        from: { email: answers.from },
        subject: answers.subject,
        content: [{ type: 'text/html', value: content }],
      },
      { headers: { Authorization: `Bearer ${answers.apiKey}` } },
    );

    spinner.succeed();
  } catch (error) {
    spinner.fail('Failed to send test email.');
    console.error(error);
    throw error;
  }
}

/**
 * Validate that a string value is an email.
 *
 * @param value String, possibly formatted as an email
 * @return Boolean indicating if the string is formatted as an email
 */
function validateEmail(value: string): boolean {
  const emailRegExp =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegExp.test(value);
}
