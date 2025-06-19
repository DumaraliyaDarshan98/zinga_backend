import mongoose from 'mongoose';

const battingStatsSchema = new mongoose.Schema({
    matches: {
        type: Number,
        default: 0
    },
    innings: {
        type: Number,
        default: 0
    },
    runs: {
        type: Number,
        default: 0
    },
    balls: {
        type: Number,
        default: 0
    },
    fours: {
        type: Number,
        default: 0
    },
    sixes: {
        type: Number,
        default: 0
    },
    fifties: {
        type: Number,
        default: 0
    },
    hundreds: {
        type: Number,
        default: 0
    },
    highestScore: {
        type: Number,
        default: 0
    },
    strikeRate: {
        type: Number,
        default: 0
    },
    average: {
        type: Number,
        default: 0
    }
}, { _id: false });

const bowlingStatsSchema = new mongoose.Schema({
    matches: {
        type: Number,
        default: 0
    },
    innings: {
        type: Number,
        default: 0
    },
    wickets: {
        type: Number,
        default: 0
    },
    overs: {
        type: Number,
        default: 0
    },
    runs: {
        type: Number,
        default: 0
    },
    economy: {
        type: Number,
        default: 0
    },
    average: {
        type: Number,
        default: 0
    },
    fiveWickets: {
        type: Number,
        default: 0
    },
    tenWickets: {
        type: Number,
        default: 0
    },
    bestBowling: {
        wickets: {
            type: Number,
            default: 0
        },
        runs: {
            type: Number,
            default: 0
        }
    }
}, { _id: false });

const performanceByBallTypeSchema = new mongoose.Schema({
    white: {
        batting: battingStatsSchema,
        bowling: bowlingStatsSchema
    },
    red: {
        batting: battingStatsSchema,
        bowling: bowlingStatsSchema
    },
    pink: {
        batting: battingStatsSchema,
        bowling: bowlingStatsSchema
    }
}, { _id: false });

const playerStatsSchema = new mongoose.Schema({
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    totalMatches: {
        type: Number,
        default: 0
    },
    careerStats: performanceByBallTypeSchema,
    matchesPlayed: [{
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Match'
        },
        ballType: {
            type: String,
            enum: ['white', 'red', 'pink'],
            required: true
        },
        battingInnings: [{
            runs: Number,
            balls: Number,
            fours: Number,
            sixes: Number,
            notOut: Boolean,
            position: Number
        }],
        bowlingInnings: [{
            overs: Number,
            maidens: Number,
            runs: Number,
            wickets: Number
        }]
    }]
}, { timestamps: true });

// Create unique compound index
playerStatsSchema.index({ player: 1, team: 1 }, { unique: true });

const PlayerStats = mongoose.model('PlayerStats', playerStatsSchema);

export default PlayerStats; 