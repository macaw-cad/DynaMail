import { EmailMetadata } from "../types/EmailData";

export const validateEmailMetadata = (emailMetadata: EmailMetadata): void => {
    if (!emailMetadata) {
        throw new Error("Data is missing '_email'");
    }
    if (!emailMetadata.template) {
        throw new Error("Data is missing '_email.template'");
    }
    if (!emailMetadata.language) {
        throw new Error("Data is missing '_email.language'");
    }
    if (!emailMetadata.to) {
        throw new Error("Data is missing '_email.to'");
    }
}