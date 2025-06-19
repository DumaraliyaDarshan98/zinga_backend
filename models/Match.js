import mongoose from "mongoose";

const ballSchema = new mongoose.Schema({
    overNumber: {
        type: Number,
        required: true
    },
    ballNumber: {
        type: Number,
        required: true
    },
    runs: {
        type: Number,
        required: true,
        default: 0
    },
    isWicket: {
        type: Boolean,
        default: false
    },
    wicketType: {
        type: String,
        enum: ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket'],
    },
    playerOut: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    commentary: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    striker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bowler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ballType: {
        type: String,
        enum: ['regular', 'wide', 'noball', 'legbye', 'bye'],
        default: 'regular'
    },
    isBoundary: {
        type: Boolean,
        default: false
    },
    isExtra: {
        type: Boolean,
        default: false
    },
    isOver: {
        type: Boolean,
        default: false
    },
    catchMissed: {
        type: Boolean,
        default: false
    },
    fielder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    runSaved: {
        type: Number,
        default: 0
    },
    runMissed: {
        type: Number,
        default: 0
    },
    bonusRuns: {
        type: Number,
        default: 0
    },
    isNegativeRuns: {
        type: Boolean,
        default: false
    },
    fieldingHighlight: {
        type: String
    }
});

const historyLogsSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    runs: {
        type: Number,
        required: true,
        default: 0
    },
    isBonusRun: {
        type: Boolean,
        default: false
    },
    isNegativeRun: {
        type: Boolean,
        default: false
    },
    reason: {
        type: String,
        required: true
    },
})

const inningsSchema = new mongoose.Schema({
    battingTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: false
    },
    bowlingTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: false
    },
    totalRuns: {
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
    currentStriker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    currentNonStriker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    currentBowler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    currentKeeper: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Track player replacements during the match
    playerReplacements: [{
        originalPlayer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        replacementPlayer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        playerRole: {
            type: String,
            enum: ['striker', 'non-striker', 'bowler', 'keeper', 'fielder'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            enum: ['injury', 'tactical', 'illness', 'cheating', 'other'],
            required: true
        },
        description: {
            type: String
        }
    }],
    balls: [ballSchema],
    historyLogs : [historyLogsSchema],
    isComplete: {
        type: Boolean,
        default: false
    },
    declarationInfo: {
        isDeclared: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String
        },
        time: {
            type: Date
        },
        commentary: {
            type: String
        }
    },
    oversReductionInfo: {
        isReduced: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String
        },
        time: {
            type: Date
        },
        commentary: {
            type: String
        }
    }
});

const matchSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    matchNumber: {
        type: Number,
        required: true
    },
    teamA: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: function() {
            // Make this required only for matches that aren't in the knockout stages
            return this.matchType !== 'quarter-final' && 
                   this.matchType !== 'semi-final' && 
                   this.matchType !== 'final';
        }
    },
    teamB: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: function() {
            // Make this required only for matches that aren't in the knockout stages
            return this.matchType !== 'quarter-final' && 
                   this.matchType !== 'semi-final' && 
                   this.matchType !== 'final';
        }
    },
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    matchDate: {
        type: Date,
        required: true
    },
    matchStartTime: {
        type: String,
        required: true
    },
    matchEndTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'live', 'paused', 'completed', 'abandoned', 'delayed'],
        default: 'scheduled'
    },
    tossWinner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    tossDecision: {
        type: String,
        enum: ['batting', 'bowling']
    },
    firstInnings: {
        type: inningsSchema,
        required: false
    },
    secondInnings: {
        type: inningsSchema,
        required: false
    },
    umpires: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    result: {
        winner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team'
        },
        margin: {
            type: String
        }
    },
    dls: {
        isApplied: {
            type: Boolean,
            default: false
        },
        originalTarget: {
            type: Number
        },
        revisedTarget: {
            type: Number
        },
        originalOvers: {
            type: Number
        },
        revisedOvers: {
            type: Number
        },
        reason: {
            type: String
        },
        appliedAt: {
            type: Date
        },
        commentary: {
            type: String
        }
    },
    currentOversPerInnings: {
        type: Number
    },
    oversChangeHistory: [{
        previousOvers: {
            type: Number,
            required: true
        },
        newOvers: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        commentary: {
            type: String
        }
    }],
    abandonInfo: {
        reason: {
            type: String
        },
        time: {
            type: Date
        },
        commentary: {
            type: String
        }
    },
    matchType: {
        type: String,
        enum: ['group', 'quarter-final', 'semi-final', 'final'],
        default: 'group'
    },
    groupName: {
        type: String
    }
}, {
    timestamps: true,
    versionKey: false
});

const Match = mongoose.model('Match', matchSchema);

export default Match; 