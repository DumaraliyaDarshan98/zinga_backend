import mongoose from "mongoose";

const tournamentTeamSchema = new mongoose.Schema(
    {
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
            required: true
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true
        },
        players: [{
            player: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            isPlaying: {
                type: Boolean,
                default: true
            },
            matchesPlayed: {
                type: Number,
                default: 0
            },
            runs: {
                type: Number,
                default: 0
            },
            wickets: {
                type: Number,
                default: 0
            }
        }],
        status: {
            type: String,
            enum: ['registered', 'active', 'eliminated', 'completed'],
            default: 'registered'
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Compound index to ensure unique team per tournament
tournamentTeamSchema.index({ tournament: 1, team: 1 }, { unique: true });

const TournamentTeam = mongoose.model('TournamentTeam', tournamentTeamSchema);

export default TournamentTeam; 