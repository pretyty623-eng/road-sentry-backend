import mongoose from "mongoose";
import { nanoid } from "nanoid";

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    default: () => `RPT_${nanoid(10)}`,
    unique: true,
    required: true,
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: -180,
    max: 180
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['submitted', 'validating', 'validated', 'prioritized', 'reviewed', 'in_progress', 'resolved', 'rejected'],
    default: 'submitted'
  },
  aiResult: {
    isValidRoad:    { type: Boolean },
    damageDetected: { type: Boolean },
    potholeCount:   { type: Number, default: 0 },
    crackCount:     { type: Number, default: 0 },
    manholeCount:   { type: Number, default: 0 },
    severityHint:   { type: String, enum: ['low', 'medium', 'high'] },
    maxConfidence:  { type: Number }
  },
  // hasil scoring
  priorityResult: {
    priorityScore: { type: Number },
    priorityLabel: { type: String, enum: ['low', 'medium', 'high'] }
  }
}, {
  timestamps: {
    createdAt: 'submittedAt',
    updatedAt: 'updatedAt'
  }
});

const Report = mongoose.model('Report', reportSchema);
export default Report;