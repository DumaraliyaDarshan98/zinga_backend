import mongoose from "mongoose";

const tournamentGuidelinesSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true,
        },
        guidelines: [
            {
                title: {
                    type: String,
                    required: true,
                },
                content: {
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

// Ensure only one guidelines document per tournament
tournamentGuidelinesSchema.index({ tournament: 1 }, { unique: true });

const TournamentGuidelines = mongoose.model('TournamentGuidelines', tournamentGuidelinesSchema);

export default TournamentGuidelines; 