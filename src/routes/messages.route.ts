import express, { Router } from 'express';
import { smsController } from '../controllers/messages.controller.js';
import { whatsappSendTransationPdf } from '../controllers/whatsapp.messages.controller.js';

const rotuer: Router = express.Router();

rotuer.post('/mail', smsController);
rotuer.post('/whatsapp', whatsappSendTransationPdf);

export default rotuer;
