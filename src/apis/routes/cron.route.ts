import express from 'express';
import CronController from '../controller/cron.controller';
import CronService from '../../services/cron/cron.service';
const router = express.Router();

const authController = new CronController(new CronService());

router.post('/login', (req, res) => authController.login(req, res));
router.post('/changePassword',authenticate, (req, res) => authController.changePassword(req, res));

export default router;
