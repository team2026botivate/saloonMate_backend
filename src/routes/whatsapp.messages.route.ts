import express, { Router } from 'express';
import { getWhatsappTemplates, whatsappSendTransationPdf } from '../controllers/whatsapp.messages.controller.js';

const rotuer: Router = express.Router();

rotuer.post('/transactionBill', whatsappSendTransationPdf);
rotuer.get('/templates', getWhatsappTemplates);

export default rotuer;
