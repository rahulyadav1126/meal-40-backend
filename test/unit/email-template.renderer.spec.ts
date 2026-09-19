import { BadRequestException } from '@nestjs/common';
import { EmailTemplateRenderer } from '../../apps/main-api/src/modules/notifications/email-template.renderer.js';

describe('EmailTemplateRenderer', () => {
  const renderer = new EmailTemplateRenderer();

  it('replaces dynamic fields in text templates', () => {
    expect(
      renderer.render('Hello {{ name }}, order {{orderNumber}} is ready.', {
        name: 'Riya',
        orderNumber: 42,
      }),
    ).toBe('Hello Riya, order 42 is ready.');
  });

  it('escapes dynamic values used in HTML templates', () => {
    expect(
      renderer.render('<p>{{message}}</p>', { message: '<script>x</script>' }, {
        escapeHtml: true,
      }),
    ).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });

  it('rejects missing required fields', () => {
    expect(() => renderer.assertRequired(['name', 'orderLink'], { name: 'Riya' }))
      .toThrow(BadRequestException);
  });
});
