import 'dotenv/config';
import mongoose from 'mongoose';
import { configureDnsServers } from './src/utils/db.js';

async function testConnection() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI belum dikonfigurasi');
    }

    configureDnsServers();

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('Berhasil konek ke MongoDB!');

    await mongoose.connection.db.admin().ping();
    console.log('Database siap menerima koneksi');
    
    await mongoose.connection.close();
    console.log('Koneksi ditutup');
  } catch (error) {
    console.error(' Gagal konek:', error.message);
    process.exitCode = 1;
  }
}

testConnection();
