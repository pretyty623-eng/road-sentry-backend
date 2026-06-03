import express from 'express';
import upload from '../middleware/upload.js';
import { requireAdminAuth } from '../middleware/requireAdminAuth.js';
import {
  createReport,
  getAllReports,
  getReportById,
  updateReportStatus,
  getStats,
  getMapReports,
  getReportStatus
} from '../controllers/reportController.js';

const router = express.Router();

router.post('/reports', upload.single('image'), createReport);
router.get('/reports', requireAdminAuth, getAllReports);
router.get('/reports/stats', getStats);
router.get('/reports/map', getMapReports);
router.get('/reports/:id/status', getReportStatus);  
router.get('/reports/:id', getReportById);
router.patch('/reports/:id/status', requireAdminAuth, updateReportStatus);

export default router;
