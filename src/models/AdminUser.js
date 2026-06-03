import mongoose from 'mongoose';
import { hashPassword } from '../utils/password.js';

const adminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      default: 'Administrator'
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin'
    },
    passwordHash: {
      type: String,
      required: true
    },
    lastLoginAt: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

adminUserSchema.statics.ensureDefaultAdmin = async function ensureDefaultAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await this.findOne({ username });
  if (existingAdmin) return existingAdmin;

  return this.create({
    username,
    name: process.env.ADMIN_NAME || 'Road Sentry Admin',
    passwordHash: hashPassword(password)
  });
};

const AdminUser = mongoose.model('AdminUser', adminUserSchema);

export default AdminUser;
