import express from 'express';
import { loginAdmin } from '../controllers/authController.js';

const router = express.Router();

router.post('/auth/admin/login', loginAdmin);

export default router;
