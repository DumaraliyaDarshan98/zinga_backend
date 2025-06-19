import mongoose from "mongoose";

const voteClub = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
        votes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const VoteClub = mongoose.model('VoteClub', voteClub);

export default VoteClub;
