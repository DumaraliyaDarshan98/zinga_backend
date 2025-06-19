import mongoose from "mongoose";

const tournamentPassSchema = new mongoose.Schema(
    {
        passId: {
            type: String,
            required: true,
            unique: true,
        },
        passType: {
            type: String,
            enum: ["Warriors Cup X", "Commanders Cup"],
            required: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
        },
        issuedFor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
        },
        issuedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isUsed: {
            type: Boolean,
            default: false,
        },
        usedAt: {
            type: Date,
        },
        usedFor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
        },
        expiryDate: {
            type: Date,
            // Optional: if passes have an expiry
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Pre-save middleware to generate pass ID if not provided
tournamentPassSchema.pre('save', async function(next) {
    if (!this.isNew) return next();
    
    if (!this.passId) {
        const prefix = this.passType === "Warriors Cup X" ? "WX" : "CC";
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 900 + 100); // Random 3-digit number
        
        this.passId = `${prefix}-${timestamp}-${random}`;
    }
    
    next();
});

const TournamentPass = mongoose.model('TournamentPass', tournamentPassSchema);

export default TournamentPass; 