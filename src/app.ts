import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { config } from 'dotenv';
config();
import commonRoutes from './apis/routes/common.route'
import cronRoutes from './apis/routes/cron.route'
import cors from 'cors';
const PATH = process.env.PATH || "";
const app = express();

app.use(express.json());

// app.use(cors());
app.use(cors({
  origin: PATH ,  
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true, 
}));

app.get('/', (req, res) => {
  res.json({
    message: 'Reader',
    version: process.env.VERSION
  });
});

app.use('/specs', express.static(path.join(__dirname, 'specs')));
app.use('/api/common', commonRoutes);
app.use('/api/cron', cronRoutes);

app.use('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'specs', 'swagger.html'));
});

app.use(bodyParser.json());
export default app;
