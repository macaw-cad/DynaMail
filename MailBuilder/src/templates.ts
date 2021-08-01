import { readFileSync } from 'fs';
import Handlebars from 'handlebars';
import { join } from 'path';

export function getHtmlTemplates() {
  const readTemplate = (name: string) => {
    return readFileSync(join(__dirname, '../templates', name), 'utf-8');
  };

  return {
    list: Handlebars.compile(readTemplate('list.hbs')),
    notFound: Handlebars.compile(readTemplate('not-found.hbs')),
    error: Handlebars.compile(readTemplate('error.hbs')),
  };
}
