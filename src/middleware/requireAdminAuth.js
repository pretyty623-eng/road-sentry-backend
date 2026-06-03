import { verifyAdminToken } from '../utils/adminToken.js';

export const requireAdminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const admin = verifyAdminToken(token);

  if (!admin || admin.role !== 'admin') {
    return res.status(401).json({
      success: false,
      message: 'Sesi admin tidak valid atau sudah berakhir'
    });
  }

  req.admin = admin;
  next();
};
