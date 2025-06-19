import mongoose from "mongoose";

const tournamentRulesSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
        },
        rules: [
            {
                title: {
                    type: String,
                    required: true,
                },
                description: {
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

// Ensure only one rules document per tournament
tournamentRulesSchema.index({ tournament: 1 }, { unique: true });

const TournamentRules = mongoose.model('TournamentRules', tournamentRulesSchema);

export default TournamentRules; 