import Report from '../models/Report.js';
import AIResult from '../models/AIResult.js';
import PriorityResult from '../models/PriorityResult.js';
import { callAIService } from '../services/aiService.js';
import { calculatePriority } from '../services/priorityService.js';

//creat laporan
export const createReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Gambar wajib diupload'
      });
    }

    const { latitude, longitude, description } = req.body;

    if (!latitude || !longitude || !description) {
      return res.status(400).json({
        success: false,
        error: 'Lokasi GPS wajib diisi'
      });
    }

    // Validasi deskripsi
    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Deskripsi laporan wajib diisi'
      });
    }

    // Simpan laporan ke database 
    const report = new Report({
      imageUrl: `/uploads/${req.file.filename}`,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      description: description.trim()
    });

    await report.save();

    console.log(`Laporan baru dibuat: ${report.reportId}`);

    // Panggil AI service secara async 
    callAIService(report._id, req.file.path);

    // Response ke user
    res.status(201).json({
      success: true,
      reportId: report.reportId,
      imageUrl: report.imageUrl,  
      status: report.status,
      message: 'Laporan berhasil dikirim, sedang divalidasi oleh AI'
    });

  } catch (error) {
    console.error('Error in createReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// READ 
export const getAllReports = async (req, res) => {
  try {
    const { status, priority, limit = 50, page = 1 } = req.query;
    let filter = {};

    // Filter berdasarkan status
    if (status) filter.status = status;

    // Ambil data dengan pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let reports = await Report.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const reportIds = reports.map(r => r._id);
    const priorityResults = await PriorityResult.find({ reportId: { $in: reportIds } });
    const priorityMap = {};
    priorityResults.forEach(pr => {
      priorityMap[pr.reportId.toString()] = pr;
    });


    // Filter berdasarkan priority 
    if (priority) {
      const priorityResults = await PriorityResult.find({ priorityLabel: priority });
      const priorityReportIds = priorityResults.map(pr => pr.reportId.toString());
      reports = reports.filter(report => priorityReportIds.includes(report._id.toString()));
    }

    // Format response
   const formattedReports = reports.map(report => {
      const priority = priorityMap[report._id.toString()];
      return {
        reportId: report.reportId,
        location: {
          lat: report.latitude,
          lng: report.longitude
        },
        description: report.description,
        status: report.status,
        imageUrl: report.imageUrl,
        submittedAt: report.submittedAt,
        updatedAt: report.updatedAt,
        priorityLabel: priority?.priorityLabel || 'low',  
        priorityScore: priority?.priorityScore || 0     
      };
    });

    // Hitung total untuk pagination
    const total = await Report.countDocuments(filter);

    res.json({
      success: true,
      data: formattedReports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in getAllReports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

//  Ambil 1 laporan berdasarkan reportId
export const getReportById = async (req, res) => {
  try {
    // Cari berdasarkan reportId 
    const report = await Report.findOne({ reportId: req.params.id });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Laporan tidak ditemukan'
      });
    }

    // Ambil data AI
    const aiResult = await AIResult.findOne({ reportId: report._id });
    const priorityResult = await PriorityResult.findOne({ reportId: report._id });

    // Format response
    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        location: {
          lat: report.latitude,
          lng: report.longitude
        },
        description: report.description,
        status: report.status,
        imageUrl: report.imageUrl,
        submittedAt: report.submittedAt,
        updatedAt: report.updatedAt,

        aiStats: aiResult ? {
          damageDetected: aiResult.damageDetected,
          potholeCount: aiResult.potholeCount,
          crackCount: aiResult.crackCount,
          severityHint: aiResult.severityHint,
          annotatedImageUrl: aiResult.annotatedImageUrl
        } : null,
        priorityBreakdown: priorityResult ? {
          severityScore: priorityResult.severityScore,
          trafficScore: priorityResult.trafficScore,
          publicFacilityScore: priorityResult.publicFacilityScore,
          frequencyScore: priorityResult.frequencyScore,
          ageScore: priorityResult.ageScore,
          priorityScore: priorityResult.priorityScore,
          priorityLabel: priorityResult.priorityLabel,
        } : null,
        aiResult: aiResult ? {
          isValidRoad: aiResult.isValidRoad,
          damageDetected: aiResult.damageDetected,
          validatedAt: aiResult.createdAt
        } : null,
        priorityResult: priorityResult ? {
          priorityScore: priorityResult.priorityScore,
          priorityLabel: priorityResult.priorityLabel,
          calculatedAt: priorityResult.createdAt
        } : null
      }
    });
  } catch (error) {
    console.error('Error in getReportById:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// UPDATE
export const updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['submitted', 'validated', 'prioritized', 'reviewed', 'in_progress', 'resolved', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status tidak valid. Pilihan: ' + validStatuses.join(', ')
      });
    }

    // Cari dan update berdasarkan reportId
    const report = await Report.findOneAndUpdate(
      { reportId: req.params.id },
      { status, updatedAt: Date.now() },
      { returnDocument: 'after' }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Laporan tidak ditemukan'
      });
    }

    console.log(`Status laporan ${report.reportId} diubah menjadi: ${status}`);

    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        status: report.status,
        updatedAt: report.updatedAt
      },
      message: `Status laporan berhasil diubah menjadi ${status}`
    });
  } catch (error) {
    console.error('Error in updateReportStatus:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

//statistik 
export const getStats = async (req, res) => {
  try {
    const total = await Report.countDocuments();
    const pending = await Report.countDocuments({
      status: { $in: ['submitted', 'validated', 'prioritized'] }
    });
    const reviewed = await Report.countDocuments({ status: 'reviewed' });
    const inProgress = await Report.countDocuments({ status: 'in_progress' });
    const resolved = await Report.countDocuments({ status: 'resolved' });
    const rejected = await Report.countDocuments({ status: 'rejected' });

    // Prioritas
    const highPriority = await PriorityResult.countDocuments({ priorityLabel: 'high' });
    const mediumPriority = await PriorityResult.countDocuments({ priorityLabel: 'medium' });
    const lowPriority = await PriorityResult.countDocuments({ priorityLabel: 'low' });

    // Laporan 7 hari terakhir
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7Days = await Report.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        reviewed,
        inProgress,
        resolved,
        rejected,
        priority: {
          high: highPriority,
          medium: mediumPriority,
          low: lowPriority
        },
        last7Days
      }
    });
  } catch (error) {
    console.error('Error in getStats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET report map
export const getMapReports = async (req, res) => {
  try {
    const reports = await Report.find({
      status: { $in: ['prioritized', 'reviewed', 'in_progress', 'resolved'] },
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null }
    })
      .sort({ submittedAt: -1 })
      .lean();

    const reportIds = reports.map(r => r._id);

    const [priorityResults, aiResults] = await Promise.all([
      PriorityResult.find({ reportId: { $in: reportIds } }).lean(),
      AIResult.find({ reportId: { $in: reportIds } }).lean()
    ]);

    const priorityMap = {};
    priorityResults.forEach(pr => {
      priorityMap[pr.reportId.toString()] = pr;
    });

    const aiMap = {};
    aiResults.forEach(ai => {
      aiMap[ai.reportId.toString()] = ai;
    });

    const mapData = reports.map(report => {
      const priority = priorityMap[report._id.toString()];
      const ai = aiMap[report._id.toString()];

      return {
        reportId: report.reportId,
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.description,
        status: report.status,
        imageUrl: report.imageUrl,
        submittedAt: report.submittedAt,
        priorityLabel: priority?.priorityLabel || 'low',
        priorityScore: priority?.priorityScore || 0,
        potholeCount: ai?.potholeCount || 0,
        crackCount: ai?.crackCount || 0
      };
    });

    res.json({ success: true, count: mapData.length, data: mapData });

  } catch (error) {
    console.error('Error in getMapReports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

//  status laporan untuk user 
export const getReportStatus = async (req, res) => {
  try {
    const report = await Report.findOne({ reportId: req.params.id });
    if (!report) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }

    // Ambil AI result kalau sudah ada
    const aiResult = await AIResult.findOne({ reportId: report._id });

    // Pesan yang ditampilkan ke user berdasarkan status
    const statusMessages = {
      submitted: { message: 'Laporan berhasil dikirim, sedang divalidasi...', color: 'blue' },
      validating: { message: 'AI sedang menganalisis foto jalan...', color: 'yellow' },
      validated: { message: 'Foto valid! Sedang menghitung prioritas...', color: 'yellow' },
      prioritized: { message: 'Laporan diterima dan sudah diprioritaskan!', color: 'green' },
      reviewed: { message: 'Laporan sedang ditinjau oleh petugas', color: 'blue' },
      in_progress: { message: 'Perbaikan sedang dalam proses', color: 'blue' },
      resolved: { message: 'Jalan sudah diperbaiki!', color: 'green' },
      rejected: { message: 'Laporan ditolak — foto tidak menunjukkan kerusakan jalan', color: 'red' }
    };

    const statusInfo = statusMessages[report.status] || { message: report.status, color: 'gray' };

    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        status: report.status,
        message: statusInfo.message,
        color: statusInfo.color,
        imageUrl: report.imageUrl,
        submittedAt: report.submittedAt,
        // Tampilkan hasil AI kalau sudah ada
        aiResult: aiResult ? {
          damageDetected: aiResult.damageDetected,
          potholeCount: aiResult.potholeCount,
          crackCount: aiResult.crackCount,
          severityHint: aiResult.severityHint,
          annotatedImage: aiResult.annotatedImageUrl
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
