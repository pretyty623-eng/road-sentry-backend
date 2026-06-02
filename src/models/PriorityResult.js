import mongoose from "mongoose";
 
const priorityResultSchema = new mongoose.Schema({
    reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
        required: true
    },
    severityScore: {
        type: Number,
        default: 0
    },
    trafficScore: {
        type: Number,
        default: 0
    },
    frequencyScore: {
        type: Number,
        default: 0
    },
    publicFacilityScore: {
        type: Number,
        default: 0
    },
    ageScore: {
        type: Number,
        default: 0
    },
    priorityScore: {
        type: Number,
        required: true
    },
    priorityLabel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now   
    }
});

const PriorityResult = mongoose.model('PriorityResult', priorityResultSchema);
export default PriorityResult