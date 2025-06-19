import mongoose from 'mongoose';

const groundActivitySchema = new mongoose.Schema({
    groundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    activityType: {
        type: String,
        enum: ['create', 'update', 'delete', 'booking', 'cancel_booking', 'add_court', 'update_court', 'delete_court'],
        required: true
    },
    details: {
        type: Object
    },
}, {
    timestamps: true,
    versionKey: false
});

const GroundActivity = mongoose.model('GroundActivity', groundActivitySchema);

export default GroundActivity; 