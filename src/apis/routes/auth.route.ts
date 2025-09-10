import express from 'express';
import AuthController from '../controller/auth.controller';
import AuthService from '../../services/auth/auth.service';
import { authenticate } from '../../middleware/authenticate.middleware';
const router = express.Router();

const authController = new AuthController(new AuthService());

router.post('/login', (req, res) => authController.login(req, res));
router.post('/changePassword',authenticate, (req, res) => authController.changePassword(req, res));

export default router;
