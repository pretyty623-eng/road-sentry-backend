import AIResult from "../models/AIResult.js";
import Report from "../models/Report.js";
import { calculatePriority } from "./priorityService.js";
import FormData from "form-data";
import fetch from "node-fetch";
import fs from "fs";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

export const callAIService = async (reportId, imagePath) => {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      console.error(`Report tidak ditemukan: ${reportId}`);
      return;
    }

    console.log(` Memproses AI untuk report ${report.reportId}`);
    await Report.findByIdAndUpdate(reportId, { status: "validating" });

    // Kirim gambar ke FastAPI
    const form = new FormData();
    form.append("image", fs.createReadStream(imagePath));

    const response = await fetch(`${AI_SERVICE_URL}/predict`, {
      method:  "POST",
      body:    form,
      headers: form.getHeaders(),
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('annotated_image ada:', !!result.annotated_image);
    console.log('annotated_image length:', result.annotated_image?.length);

    if (!result.success) {
      throw new Error("AI prediction gagal");
    }

    console.log(` AI selesai:`, result.damage_summary);

    // Simpan hasil AI ke database
    await AIResult.create({
      reportId:          report._id,
      isValidRoad:       result.is_valid_road,
      damageDetected:    result.damage_detected,
      potholeCount:      result.damage_summary.pothole_count  || 0,
      crackCount:        result.damage_summary.crack_count    || 0,
      manholeCount:      result.damage_summary.manhole_count  || 0,
      severityHint:      result.damage_summary.severity_hint,
      maxConfidence:     result.damage_summary.max_confidence || 0,
      rawDetections:     result.detections    || [],
      annotatedImageUrl: result.annotated_image || null
    });
    
    // Reject kalau tidak ada kerusakan
    if (!result.is_valid_road || !result.damage_detected) {
      await Report.findByIdAndUpdate(report._id, { status: "rejected" });
      console.log(` Laporan ${report.reportId} ditolak`);
      return;
    }

    await Report.findByIdAndUpdate(report._id, { status: "validated" });
    await calculatePriority(report._id, result.damage_summary);

  } catch (error) {
    console.error(` AI service error: ${error.message}`);
    await Report.findByIdAndUpdate(reportId, { status: "rejected" });
  }
};