import mongoose from "mongoose";

const requestClubSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    },
    {
        timestamps: true, 
        versionKey: false,
    }
);

const RequestClub = mongoose.model('RequestClub', requestClubSchema);

export default RequestClub;
