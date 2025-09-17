import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import messageRoute from './routes/messages.route.js';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONT_END_URL,
    credentials: true,
  }),
);
const port = process.env.PORT || 3002;
app.use(express.json());
app.use(cookieParser());

app.use('/api/messages/', messageRoute);
app.use('/api/messages/whatsapp', whatsappRoute);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
