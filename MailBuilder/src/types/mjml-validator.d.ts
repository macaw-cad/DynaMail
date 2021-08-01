declare module 'mjml-validator' {
  import { MJMLJsonObject, MJMLParseError, Component } from 'mjml-core';

  export interface Dependencies {
    [key: string]: string[];
  }

  export interface MJMLValidatorOptions {
    components?: Record<string, Component | undefined>;
    dependencies?: Dependencies;
    initializeType?: any;
  }

  export default function MJMLValidator(
    mjml: MJMLJsonObject,
    options?: MJMLValidatorOptions,
  ): MJMLParseError[];

  export const dependencies: Dependencies;
}
