import AdminUser from '../models/AdminUser.js';
import { createAdminToken } from '../utils/adminToken.js';
import { verifyPassword } from '../utils/password.js';

export const loginAdmin = async (req, res, next) => {
  try {
    const username = req.body.username?.trim().toLowerCase();
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan kata sandi wajib diisi'
      });
    }

    const admin = await AdminUser.findOne({ username, isActive: true });
    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      return res.status(401).json({
        success: false,
        message: 'Kredensial salah. Silakan periksa kembali username dan kata sandi Anda.'
      });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    res.json({
      success: true,
      message: 'Login admin berhasil',
      data: {
        token: createAdminToken(admin),
        admin: {
          username: admin.username,
          name: admin.name,
          role: admin.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
