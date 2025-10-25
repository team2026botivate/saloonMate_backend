import { Resend } from "resend";
import dotenv from "dotenv";
import { SendMailProps } from "../types/email.types.js";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);


export const sendMail = async ({ to, subject , html }: SendMailProps) => {
  try {
   const res = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });
    
    return res
  } catch (error) {
    console.error(error);
    return error
  }
};
