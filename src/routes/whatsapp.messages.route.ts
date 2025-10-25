import express, { Router } from 'express';
import multer from 'multer';
import {
  getQuota,
  getWhatsappTemplates,
  sendWhatsApp,
  sendWhatsAppBulk,
  updateQuota,
  whatsappSendTransationPdf,
  getDashboardData,
  getStoreDetails,
  sendAppointmentWhatsappMessage,
} from '../controllers/whatsapp.messages.controller.js';

const router: Router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 10 * 1024 * 1024, // allow up to 10MB for text fields like components
    fileSize: 25 * 1024 * 1024,  // cap files to 25MB
    files: 1,
  },
});

// Accepts multipart/form-data with field name 'pdfFile'
router.post('/transactionBill', upload.single('pdfFile'), whatsappSendTransationPdf);
router.get('/templates', getWhatsappTemplates);

// Accept media upload under field name 'mediaFile'
router.post('/sendMessage', upload.single('mediaFile'), sendWhatsApp);
router.post('/sendMessageBulk', upload.single('mediaFile'), sendWhatsAppBulk);

router.get('/getQuota', getQuota);

router.put('/updateQuota', updateQuota);

router.get('/dashboard', getDashboardData);

router.get('/store', getStoreDetails);


router.post("/appointment",sendAppointmentWhatsappMessage)




export default router;
