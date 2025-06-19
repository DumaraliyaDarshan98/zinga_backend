import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
    {
        teamName: {
            type: String,
            required: true,
        },
        logo: {
            type: String,
        },
        players: [{
            player: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            isPlaying: {
                type: Boolean,
                default: true
            }
        }],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const Team = mongoose.model('Team', teamSchema);

export default Team;
