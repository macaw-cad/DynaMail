import * as fs from "fs";
import * as path from "path";
import * as handlebars from "handlebars";
import { EmailData } from "../types/EmailData";

export const createSubject = (templatesFolder: string, data: EmailData, fallbackLanguage: string): string => {
    let templatePath = path.join(templatesFolder, `${data._email.template}.${data._email.language}.subject.hbs`);
    if (!fs.existsSync(templatePath)) {
        if (!fallbackLanguage) {
            throw new Error(`Email subject template '${templatePath}' does not exist, and no fallback language specified.`);
        }
        templatePath = path.join(templatesFolder, `${data._email.template}.${fallbackLanguage}.subject.hbs`);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Email subject template '${templatePath}' (for fallback language ) ${fallbackLanguage} does not exist.`);
        }
    }

    const template = fs.readFileSync(templatePath).toString();
    const templateHandlebars = handlebars.compile(template);
    const subject = templateHandlebars(data);
    return subject;
}