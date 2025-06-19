import mongoose from "mongoose";

const tournamentFAQSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
        },
        questions: [
            {
                question: {
                    type: String,
                    required: true,
                },
                answer: {
                    type: String,
                    required: true,
                }
            }
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Ensure only one FAQ document per tournament
tournamentFAQSchema.index({ tournament: 1 }, { unique: true });

const TournamentFAQ = mongoose.model('TournamentFAQ', tournamentFAQSchema);

export default TournamentFAQ; 