import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { config } from 'dotenv';
config();
import authRoutes from './apis/routes/auth.route'
import {create} from './cores/common'
import cors from 'cors';

const app = express();

app.use(express.json());

app.use(cors());

app.get('/', (req, res) => {
  res.json({
    message: 'TRIMA',
    version: process.env.VERSION
  });
});

app.use('/specs', express.static(path.join(__dirname, 'specs')));
app.use('/api/auth', authRoutes);

app.use('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'specs', 'swagger.html'));
});

app.use(bodyParser.json());
export default app;
