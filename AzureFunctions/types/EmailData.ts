export type EmailMetadata = {
    template: string;
    language: string;
    subject: string;
    to: string;
}

export type EnvironmentMetadata = {
    baseUrl: string;
}

export type EmailData = {
    _email: EmailMetadata;
    _environment: EnvironmentMetadata;
} | any;