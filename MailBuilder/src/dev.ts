import bs from 'browser-sync';
import UrlPattern from 'url-pattern';
import axios from 'axios';
import path from 'path';
import { writeFile } from 'fs/promises';
import { existsSync, readFileSync, Stats, writeFileSync } from 'fs';
import * as handlebars from "handlebars";
import * as dotenv from 'dotenv';

import {
  getProjectConfig,
  prepareMjmlEnv,
  ProjectConfig,
  Template,
} from './core';
import { buildSubject, buildTemplate, ensureDirectory } from './build';
import { getHtmlTemplates } from './templates';

type SendMailPostData = {
  template: string;
  language: string;
  email: string; // to email address
  base64subject: string;
  base64html: string;
};

const escapeHTML = (str) =>
  str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[tag]),
  );

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

async function sendMail(
  from: string,
  to: string,
  subject: string,
  content: string,
  sendGridApiKey: string,
): Promise<void> {
  try {
    if (!validateEmail(from)) {
      throw new Error(`The from email address '${from}' is invalid.`);
    }
    if (!validateEmail(to)) {
      throw new Error(`The to email address '${to}' is invalid.`);
    }
    if (!sendGridApiKey) {
      throw new Error(`The SendGridApiKey '${sendGridApiKey}' is invalid.`);
    }

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: { email: from },
        subject: subject,
        content: [{ type: 'text/html', value: content }],
      },
      { headers: { Authorization: `Bearer ${sendGridApiKey}` } },
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const templatePattern = new UrlPattern('/template/:name');
const templateWithLanguagePattern = new UrlPattern('/template/:language/:name');

export function dev(project: ProjectConfig) {
  const dotenvPath = path.resolve(__dirname, "../../.env");
  dotenv.config({ path: dotenvPath });

  const sendGridApiKey = process.env.SendGridApiKey;
  const sendGridFromAddress = process.env.SendGridFromAddress;
  if (!sendGridApiKey) {
    throw new Error(`Ensure file ${dotenvPath} exists and contains value for 'SendGridApiKey'`);
  }
  if (!sendGridApiKey) {
    throw new Error(`Ensure file ${dotenvPath} exists and contains value for 'SendGridFromAddress'`);
  }
  
  const server = bs.create('MailBuilder Server');

  server.watch('**/*.mjml', {}, (event: string, file: Stats) => {
    server.reload();
    updateDist(file, project.root, 'prod'); // prod = don't execute Handlebars with sample data.json
  });
  server.watch('**/*.css', {}, (event: string, file: Stats) => {
    server.reload();
    updateDist(file, project.root, 'prod'); // prod = don't execute Handlebars with sample data.json
  });
  server.watch('**/*.json', {}, () => server.reload());
  for (let component of project.mjmlComponents) {
    server.watch(project.relative(component), {}, () => server.reload());
  }

  server.init({
    server: project.root,
    open: false,
    ui: false,
    logPrefix: 'MailBuilder-server',
    serveStatic: [
      path.join(__dirname, '../static'),
      path.join(__dirname, '../../SampleData')
    ],
    middleware: [
      {
        route: '/sendmail',
        handle: function (req, res, next) {
          const chunks = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', async () => {
            const data = Buffer.concat(chunks);
            try {
              const sendMailPostData: SendMailPostData = JSON.parse(
                data.toString(),
              );
              console.log(`Send email to ${sendMailPostData.email}`);
              const subject = Buffer.from(
                sendMailPostData.base64subject,
                'base64',
              ).toString('ascii');
              const content = Buffer.from(
                sendMailPostData.base64html,
                'base64',
              ).toString('ascii');

              await sendMail(
                sendGridFromAddress,
                sendMailPostData.email,
                subject,
                content,
                sendGridApiKey,
              );
            } catch (error) {
              res.statusCode = 500;
              res.write(
                JSON.stringify({
                  statusCode: res.statusCode,
                  error: error.toString(),
                }),
              );
              return res.end();
            }
            res.statusCode = 200;
            res.write(JSON.stringify({ statusCode: res.statusCode }));
            return res.end();
          });
        },
      },
      {
        route: '/',
        handle: createTemplatesListHandler(project.root, project.mode),
      },
      createTemplateHandler(project.root, project.mode),
    ],
  });

  return () => server.exit();
}

async function updateDist(
  file: Stats,
  projectRoot: string,
  mode: 'dev' | 'prod',
) {
  // Write to dist folder & create translated subject file
  let templateName: string = `./${file}`;
  templateName = templateName.replace(/\\/g, '/');
  let project = await getProjectConfig(projectRoot, mode);
  let matchingTemplates = project.templates.filter(
    (template) => template.template === templateName,
  );

  for (const currentTemplate of matchingTemplates) {
    let code = await buildTemplate(currentTemplate, project);
    let distPath = project.resolve(
      path.join('dist', `${currentTemplate.name}.${currentTemplate.language}.html`),
    );
    console.log(
      `Recreate template '${currentTemplate.name}' language '${currentTemplate.language}' at '${distPath}'`,
    );
    await ensureDirectory('dist', project);
    await writeFile(distPath, code);

    const subject = await buildSubject(currentTemplate, project);
    const subjectPath = path.join(
      project.root,
      `dist/${currentTemplate.name}.${currentTemplate.language}.subject.hbs`,
    );
    writeFileSync(subjectPath, subject, { encoding: 'utf8' });
  }
}

function createTemplateHandler(
  projectRoot: string,
  mode: 'dev' | 'prod',
): bs.MiddlewareHandler {
  const render = getHtmlTemplates();

  return async function templateHandler(req, res, next) {
    let match = templateWithLanguagePattern.match(req.url ?? '/') as {
      language: string;
      name: string;
    } | null;
    if (match === null) {
      // Fallback to pattern without language
      match = templatePattern.match(req.url ?? '/') as {
        language: null;
        name: string;
      } | null;
    }

    if (match == null) return next();

    let templateName = match.name;
    let templateLanguage = match.language;

    let project = await getProjectConfig(projectRoot, mode);
    let currentTemplate = project.templates.find(
      (template) =>
        template.name === templateName &&
        ((templateLanguage !== null &&
          template.language === templateLanguage) ||
          templateLanguage === null),
    );

    if (currentTemplate == null) {
      res.statusCode = 404;
      res.write(render.notFound({ template: { name: match.name } }));
      return res.end();
    }

    try {
      prepareMjmlEnv(project);
      let html = await buildTemplate(currentTemplate, project);

      const subjectTemplate = await buildSubject(currentTemplate, project);
      const templateTestDataPath = path.join(projectRoot, 'src', currentTemplate.name, 'data.json');
      if (!existsSync(templateTestDataPath)) {
        throw new Error(`Expected template test data '${templateTestDataPath}' is missing`);
      }
      let data;
      try {
        const dataContents = readFileSync(templateTestDataPath).toString();
        data = JSON.parse(dataContents);
      } catch (error) {
        throw new Error(`Failed to read and parse JSON of template test data '${templateTestDataPath}'. Error: ${error.toString()}`);
      }

      const subjectTemplateHandlebars = handlebars.compile(subjectTemplate);
      const subject = subjectTemplateHandlebars(data);

      let base64html = Buffer.from(html, 'utf-8').toString('base64');
      let base64subject = Buffer.from(subject, 'utf-8').toString('base64');

      let previewHtml = `
        <html>
            <head>
                <title>MailBuilder - ${currentTemplate.name}:${
        currentTemplate.language
      }</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.11.0/toastify.min.js" integrity="sha512-k2baNm3J3Nf2URctst/ERuxZpfMI7adHF5BgzE81W/GBXXPQCBxkKGvLdo+hv9OdboBKGuqjLXIC+4RKGBMhEg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
                <script src="/mailbuilder-code.js"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.11.0/toastify.min.css" integrity="sha512-qd9G8+DpIoJdcO5i+ZGH0v0lz92U1XlMtKggIFr59wQjRWorqfHZ5EtgRBhUPKEWbKW+GD+0iGgzL3g1Unx7LQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
                <link rel="stylesheet" href="/mailbuilder-styles.css" />
            </head>
            <body>
                <div style="background-color: black; color: white; margin-bottom:4px;">DynaMail previewer - dynamic, data-driven, multi-language mail templates builder</div>
                email: 
                <input id="email" type="text"/>
                <button onclick="sendMail('${currentTemplate.name}', '${currentTemplate.language}', document.getElementById('email').value, '${base64subject}', '${base64html}')">SEND</button>
                <hr/>
                <div>subject: <strong>${escapeHTML(subject)}</strong></div>
                <iframe width="100%" height="90%" src="data:text/html;base64,${base64html}"></iframe>
            </body>
        </html>`;
      res.setHeader('Content-Type', 'text/html');
      res.write(previewHtml);
      res.end();
    } catch (error) {
      res.setHeader('Content-Type', 'text/html');
      res.write(render.error({ template: currentTemplate, error }));
      res.end();
    }
  };
}

function createTemplatesListHandler(
  projectRoot: string,
  mode: 'dev' | 'prod',
): bs.MiddlewareHandler {
  const render = getHtmlTemplates();

  return async function templatesListHandler(_, res) {
    let project = await getProjectConfig(projectRoot, mode);

    res.setHeader('Content-Type', 'text/html');
    res.write(render.list(project));
    res.end();
  };
}
