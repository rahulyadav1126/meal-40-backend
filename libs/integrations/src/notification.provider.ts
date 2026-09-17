import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface SmsMessage {
  to: string;
  message: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}
@Injectable()
export class NodemailerEmailProvider implements EmailProvider {
  constructor(private readonly config: ConfigService) {}
  async send(message: EmailMessage): Promise<void> {
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.getOrThrow<number>('SMTP_PORT')),
      secure: Number(this.config.get<number>('SMTP_PORT')) === 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USERNAME'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });
    await transport.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      ...message,
    });
  }
}
