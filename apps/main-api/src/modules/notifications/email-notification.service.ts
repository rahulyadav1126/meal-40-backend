import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_NAME } from '@app/contracts';
import { EmailTemplateEntity } from '@app/database';
import { NodemailerEmailProvider } from '@app/integrations';
import {
  EmailTemplateRenderer,
  type TemplateVariables,
} from './email-template.renderer.js';

export interface SendTemplateEmailInput {
  to: string;
  templateKey: string;
  variables: TemplateVariables;
  locale?: string;
}

@Injectable()
export class EmailNotificationService {
  constructor(
    @InjectRepository(EmailTemplateEntity)
    private readonly templates: Repository<EmailTemplateEntity>,
    private readonly renderer: EmailTemplateRenderer,
    private readonly provider: NodemailerEmailProvider,
  ) {}

  async send(input: SendTemplateEmailInput): Promise<void> {
    const template = await this.templates.findOne({
      where: {
        templateKey: input.templateKey,
        locale: input.locale ?? 'en',
        isActive: true,
      },
      order: { version: 'DESC' },
    });
    if (!template) {
      throw new NotFoundException(
        `Active email template not found: ${input.templateKey}`,
      );
    }

    const variables: TemplateVariables = {
      appName: APP_NAME,
      currentYear: new Date().getUTCFullYear(),
      ...input.variables,
    };
    this.renderer.assertRequired(template.requiredVariables, variables);

    const subject = this.renderer
      .render(template.subjectTemplate, variables)
      .replace(/[\r\n]+/g, ' ');
    const text = this.renderer.render(template.textBody, variables);
    const html = this.renderer.render(template.htmlBody, variables, {
      escapeHtml: true,
    });

    await this.provider.send({ to: input.to, subject, text, html });
  }
}
