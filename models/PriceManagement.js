import mongoose from 'mongoose';

const priceManagementSchema = new mongoose.Schema({
    groundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    courtId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    slotIds: [{
        type: mongoose.Schema.Types.ObjectId,
        required: true
    }],
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['date', 'day', 'week'],
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    tournamentPrice: {
        type: Number,
        required: true
    },
    isTournament: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
    versionKey: false
});

// Compound index to ensure uniqueness based on the combination
priceManagementSchema.index({ groundId: 1, courtId: 1, date: 1, type: 1, slotIds: 1 }, { unique: true });

const PriceManagement = mongoose.model('PriceManagement', priceManagementSchema);

export default PriceManagement; 