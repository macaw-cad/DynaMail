import { AzureFunction, Context } from "@azure/functions"
import { validateEmailMetadata } from "../lib/validateEmailData";
import { EmailData } from "../types/EmailData";
import * as path from "path";
import * as fs from "fs";
import { createEmail } from "../lib/createEmail";
import { createSubject } from "../lib/createSubject";


// The 'From' and 'To' fields are automatically populated with the values specified by the binding settings.
//
// You can also optionally configure the default From/To addresses globally via host.config, e.g.:
//
// {
//   "sendGrid": {
//      "to": "user@host.com",
//      "from": "Azure Functions <samples@functions.com>"
//   }
// }

const sendMailWithSendGrid: AzureFunction =  async function (context: Context, data: EmailData): Promise<void> {
    const fallbackLanguage = process.env.FallbackLanguage;
    context.log("Queue trigger for sending email");
    context.log(`Function execution directory: ${__dirname}`);
    context.log(`Fallback language: ${fallbackLanguage}`);

    try {
        if (!data) {
            throw new Error("The provided data in the queue is empty");
        }

        validateEmailMetadata(data._email);
        const mailTemplatesFolder = path.join(__dirname, "../MailTemplates");
        if (!fs.existsSync(mailTemplatesFolder)) {
            throw new Error(`Email templates folder '${mailTemplatesFolder}' does not exist.`);
        }

        const html = createEmail(mailTemplatesFolder, data, fallbackLanguage);
        const subject = createSubject(mailTemplatesFolder, data, fallbackLanguage);
        
        context.log(`Queue trigger for sending email with subject '${subject}' to '${data._email.to}'`);

        context.bindings.message = {
            subject: subject,
            content: [{
                type: 'text/html',
                value: html
            }]
        };
    } catch (error) {
        context.log(`ERROR: ${error.toString()}`);
    } 
}

export default sendMailWithSendGrid;
