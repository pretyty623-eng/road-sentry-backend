import mongoose from 'mongoose';
import dns from 'dns';

export const configureDnsServers = () => {
  const servers = process.env.DNS_SERVERS
    ?.split(',')
    .map(server => server.trim())
    .filter(Boolean);

  if (!servers?.length) return;

  dns.setServers(servers);
};

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI belum dikonfigurasi');
    }

    configureDnsServers();

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database name: ${conn.connection.name}`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
