import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '@app/contracts';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (request, response) => {
          const incoming = request.headers[REQUEST_ID_HEADER];
          const id = typeof incoming === 'string' ? incoming : randomUUID();
          response.setHeader(REQUEST_ID_HEADER, id);
          return id;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.code',
            'res.headers.set-cookie',
          ],
          censor: '[REDACTED]',
        },
        customProps: (request) => ({ requestId: request.id }),
      },
    }),
  ],
  exports: [LoggerModule],
})
export class Plate40LoggerModule {}
