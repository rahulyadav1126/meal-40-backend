import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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
  private readonly transport: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('mail.host'),
      port: this.config.getOrThrow<number>('mail.port'),
      secure: this.config.getOrThrow<boolean>('mail.secure'),
      auth: {
        user: this.config.getOrThrow<string>('mail.username'),
        pass: this.config.getOrThrow<string>('mail.password'),
      },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.config.getOrThrow<string>('mail.from'),
      ...message,
    });
  }
}
