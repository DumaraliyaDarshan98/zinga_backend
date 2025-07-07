import mongoose from 'mongoose';

const PointSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  matchesPlayed: { type: Number, default: 0 },
  won: { type: Number, default: 0 },
  lost: { type: Number, default: 0 },
  tied: { type: Number, default: 0 },
  noResult: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  runsFor: { type: Number, default: 0 },
  oversFor: { type: Number, default: 0 },
  runsAgainst: { type: Number, default: 0 },
  oversAgainst: { type: Number, default: 0 },
  netRunRate: { type: Number, default: 0.0 },
  updatedAt: { type: Date, default: Date.now }
});

const Point = mongoose.model('Point', PointSchema);

export default Point; 