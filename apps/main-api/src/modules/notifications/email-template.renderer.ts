import { BadRequestException, Injectable } from '@nestjs/common';

export type TemplateVariables = Record<string, string | number | boolean>;

@Injectable()
export class EmailTemplateRenderer {
  private readonly placeholder = /{{\s*([A-Za-z][A-Za-z0-9_.]*)\s*}}/g;

  render(
    source: string,
    variables: TemplateVariables,
    options: { escapeHtml?: boolean } = {},
  ): string {
    return source.replace(this.placeholder, (_match, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(variables, key)) {
        throw new BadRequestException(
          `Missing email template variable: ${key}`,
        );
      }
      const value = String(variables[key]);
      return options.escapeHtml ? this.escapeHtml(value) : value;
    });
  }

  assertRequired(required: string[], variables: TemplateVariables): void {
    const missing = required.filter(
      (key) => !Object.prototype.hasOwnProperty.call(variables, key),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Missing email template variables: ${missing.join(', ')}`,
      );
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
