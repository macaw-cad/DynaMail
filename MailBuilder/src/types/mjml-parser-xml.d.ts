declare module 'mjml-parser-xml' {
  import { MJMLJsonObject, Component } from 'mjml-core';

  export interface MJMLParserOptions {
    addEmptyAttributes?: boolean;
    components?: Record<string, Component | undefined>;
    convertBooleans?: boolean;
    keepComments?: boolean;
    filePath?: string;
    actualPath?: string;
    ignoreIncludes?: boolean;
    preprocessors?: ((xml: MJMLJsonObject) => MJMLJsonObject)[];
  }

  export default function MJMLParser(
    mjml: string,
    options?: MJMLParserOptions,
  ): MJMLJsonObject;
}
