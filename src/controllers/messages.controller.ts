import type { Request, Response } from 'express';
import { sendMail } from '../utils/sendMail.js';

export const smsController = async (req: Request, res: Response) => {
  try {
    const { email, subject, html } = req.body;

    if (
      email.trim().length === 0 ||
      subject.trim().length === 0 ||
      html.trim().length === 0
    ) {
      return res
        .status(200)
        .json({ message: 'All fields are required', success: false });
    }

    const data: any = await sendMail({
      to: email,
      subject: subject,
      html: html,
    });

    console.log(data);

    if (data.data == null) {
      return res
        .status(200)
        .json({ message: 'Email not sent', success: false });
    }
    return res
      .status(200)
      .json({ message: 'Email sent successfully', success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    return res
      .status(500)
      .json({ message: 'Failed to send email', success: false });
  }
};
