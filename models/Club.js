import mongoose from "mongoose";

const memberTournamentSchema = new mongoose.Schema({
  tournamentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Tournament" 
  },
  joinStatus: { 
    type: String, 
    enum: ["pending", "joined", "declined"], 
    default: "pending" 
  },
  joinedAt: { 
    type: Date, 
    default: null 
  }
}, { _id: false });

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinDate: { type: Date, default: Date.now },
        tournaments: [memberTournamentSchema]
      },
    ],
    isActive: {
      type: Boolean,
      default: false,
    },
    captains: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    joiningSettings: {
      type: String,
      enum: ["open", "request"],
      default: "open",
    },
    tournaments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
    }]
  },
  {
    timestamps: true,
  }
);

const Club = mongoose.model("Club", clubSchema);
export default Club;
