import * as fs from "fs";
import * as path from "path";
import * as handlebars from "handlebars";
import { EmailData } from "../types/EmailData";
import registerHelpers from "@dynamail/handlebarshelpers";

export const createEmail = (templatesFolder: string, data: EmailData, fallbackLanguage: string): string => {
    registerHelpers(handlebars);  
   
    let templatePath = path.join(templatesFolder, `${data._email.template}.${data._email.language}.html`);
    if (!fs.existsSync(templatePath)) {
        if (!fallbackLanguage) {
            throw new Error(`Email template '${templatePath}' does not exist, and no fallback language specified.`);
        }
        templatePath = path.join(templatesFolder, `${data._email.template}.${fallbackLanguage}.html`);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Email template '${templatePath}' (for fallback language ) ${fallbackLanguage} does not exist.`);
        }
    }

    const template = fs.readFileSync(templatePath).toString();
    const templateHandlebars = handlebars.compile(template);
    const html = templateHandlebars(data);
    return html;
}