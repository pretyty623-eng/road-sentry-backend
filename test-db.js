const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/road_sentry';

async function testConnection() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Berhasil konek ke MongoDB!');
    
    // Coba buat collection test
    const testSchema = new mongoose.Schema({ name: String });
    const Test = mongoose.model('Test', testSchema);
    
    await Test.create({ name: 'ROAD-SENTRY Test' });
    console.log(' Berhasil insert data test');
    
    const data = await Test.find();
    console.log('Data di database:', data);
    
    await mongoose.connection.close();
    console.log('Koneksi ditutup');
  } catch (error) {
    console.error(' Gagal konek:', error.message);
  }
}

testConnection();