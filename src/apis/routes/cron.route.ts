import express from 'express';
import CronController from '../controller/cron.controller';
import CronService from '../../services/cron/cron.service';
const router = express.Router();

const cronController = new CronController(new CronService());

router.get('/', (req, res) => cronController.fetch(req, res));

export default router;
