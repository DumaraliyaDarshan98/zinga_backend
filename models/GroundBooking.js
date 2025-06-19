import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    groundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ground',
        required: true,
    },
    courtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Court',
        required: true,
    },
    slotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Slot',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    bookingDate: {
        type: Date,
        required: true,
    },
    message: {
        type: String,
        default: '',
    },
    price: {
        type: Number,
        default: 0,
    },
    pricingType: {
        type: String,
        enum: ['regular', 'date', 'day', 'week'],
        default: 'regular',
    }
}, { versionKey: false, timestamps: true });

export default mongoose.model('Booking', bookingSchema);