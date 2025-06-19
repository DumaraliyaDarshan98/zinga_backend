import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        paymentMethod: {
            type: String,
            enum: ["direct", "pass"],
            required: true,
        },
        passId: {
            type: String,
            // Required only if paymentMethod is "pass"
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "refunded"],
            default: "pending",
        },
        transactionId: {
            type: String,
            // For payment gateway integration
        },
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        paidAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Compound index to ensure a team can't make duplicate payments for the same tournament
paymentSchema.index({ tournament: 1, team: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 