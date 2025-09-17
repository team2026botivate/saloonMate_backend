import type { Request, Response } from 'express';
import axiosInstance from '../utils/axios.js';
import axios from 'axios';

export const whatsappSendTransationPdf = async (req: Request, res: Response) => {
  try {
    if (!process.env.WHATSAPP_END_POINT) {
      throw new Error('Whatsapp end point not found');
    }
    const payload = {
      messaging_product: 'whatsapp',
      to: '917735886742',
      type: 'template',
      template: {
        name: 'wellcome_temp',
        language: {
          policy: 'deterministic',
          code: 'en_US',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: 'satandra',
              },
            ],
          },
        ],
      },
    };

    console.log(process.env.WHATSAPP_END_POINT, 'end point');

    const { data } = await axios({
      method: 'POST',
      url: process.env.WHATSAPP_END_POINT,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: payload,
    });
    console.log('WhatsApp API response:', data);

    return res.status(200).json({ message: 'done', data: data });
  } catch (error: any) {
    // Surface detailed error information if available
    const status = error?.response?.status;
    const errData = error?.response?.data;
    console.error('WhatsApp API error:', {
      status,
      data: errData,
      message: error?.message,
    });
    const httpStatus = typeof status === 'number' ? status : 500;
    return res
      .status(httpStatus)
      .json({ message: 'Failed to send WhatsApp message', error: errData ?? error?.message });
  }
};

export const getWhatsappTemplates = async (req: Request, res: Response) => {
  try {
    if (!process.env.WHATSAPP_END_POINT) {
      throw new Error('Whatsapp end point not found');
    }
    const { data } = await axiosInstance({
      method: 'GET',

      url: `${process.env.WHATSAPP_BUSSINESS_ACCOUNT_BASE_URL}/1116828697264680/message_templates?access_token=${process.env.WHATSAPP_ACCESS_TOKEN}`,
    });
    console.log('WhatsApp API response:', data);

    return res.status(200).json({ message: 'done' });
  } catch (error: any) {
    // Surface detailed error information if available
    const status = error?.response?.status;
    const errData = error?.response?.data;
    console.error('WhatsApp API error:', {
      status,
      data: errData,
      message: error?.message,
    });
    const httpStatus = typeof status === 'number' ? status : 500;
    return res
      .status(httpStatus)
      .json({ message: 'Failed to send WhatsApp message', error: errData ?? error?.message });
  }
};
