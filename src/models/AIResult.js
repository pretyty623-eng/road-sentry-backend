import mongoose from "mongoose";

const aiResultSchema = new mongoose.Schema({
    reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
        required: true
    },
    isValidRoad: {
        type: Boolean,
        required: true
    },
    damageDetected: {
        type: Boolean,
        required: true
    },
    potholeCount: {
        type: Number,
        default: 0
    },
    crackCount: {
        type: Number,
        default: 0
    },
    manholeCount: {
        type: Number,
        default: 0
    },
    severityHint: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: null
    },
    maxConfidence: {
        type: Number,
        default: 0
    },
    rawDetections: {
        type: Array,
        default: []
    },
    annotatedImageUrl: {
        type: String,
        default: null
    }
}, {
    timestamps: true  
});

const AIResult = mongoose.model('AIResult', aiResultSchema);
export default AIResult;