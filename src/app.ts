import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

const allowOrigin = ['http://localhost:3000', process.env.FRONT_END_URL].filter(
  Boolean
) as string[];

app.use(
  cors({
    origin: allowOrigin,
    credentials: true,
  })
);
const port = process.env.PORT || 3002;
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

app.get('/webhook/whatsapp', (req, res) => {
  const verify_token = '1234';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === verify_token) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook/whatsapp', (req, res) => {
  console.log(res, 'res');
  console.log('🔔 Webhook event received:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.use('/api/messages/whatsapp', whatsappRoute);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
