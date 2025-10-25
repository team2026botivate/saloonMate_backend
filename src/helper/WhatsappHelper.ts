import { WhatsappPayloadForPdf } from '../types/whatsappMessage.js';

export const payLoad = ({
  to,
  TemplateName,
  storeName,
  clientName,
  downloadLink,
}: Omit<WhatsappPayloadForPdf, 'messaging_product'>) => {
  return {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: TemplateName,
      language: {
        policy: 'deterministic',
        code: 'en',
      },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'text', text: storeName || 'Botivate Saloon' }],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
            { type: 'text', text: storeName || 'Botivate Saloon' },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: downloadLink }],
        },
      ],
    },
  };
};
