import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema(
    {
        tournamentId: {
            type: String,
            required: true,
            unique: true,
            // Format: Gamecode-City-TournamentType-Number (e.g., CKBLRWA0001)
        },
        seriesName: {
            type: String,
            required: true,
        },
        tournamentType: {
            type: String,
            enum: ["Warriors Cup", "Warriors Cup X", "Commanders Cup"],
            required: true,
        },
        status: {
            type: String,
            enum: ["upcoming", "live", "completed"],
            default: "upcoming",
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            // Will be calculated based on matches schedule
        },
        teamLimit: {
            type: Number,
            required: true,
        },
        registeredTeams: [{
            team: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
            },
            joinedAt: {
                type: Date,
                default: Date.now,
            },
            paymentStatus: {
                type: String,
                enum: ["pending", "completed"],
                default: "pending",
            }
        }],
        venues: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ground',
        }],
        cost: {
            type: Number,
            required: true,
        },
        format: {
            type: String,
            required: true,
        },
        stayOnScreen: {
            type: Boolean,
            default: false,
            // If true, tournament stays visible in upcoming section even after becoming live
        },
        // Match specific details
        matchType: {
            type: String,
            enum: ["T20", "ODI", "Test"],
            required: true
        },
        oversPerInnings: {
            type: Number,
            required: true,
            min: 1,
            max: 50
        },
        oversPerBowler: {
            type: Number,
            required: true,
            min: 1,
            max: 10
        },
        ballType: {
            type: String,
            enum: ["white", "red", "pink"],
            required: true
        },
        pitchType: {
            type: String,
            enum: ["hard", "soft", "neutral", "spinning", "bouncy"],
            required: true
        },
        umpires: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }],
        // City will be determined from venues/grounds
        matches: [{
            teamA: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team'
            },
            teamB: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team'
            },
            venue: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Ground'
            },
            matchDate: {
                type: Date
            },
            matchStartTime: {
                type: String,
                validate: {
                    validator: function (v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: props => `${props.value} is not a valid time format! Use HH:MM`
                }
            },
            matchEndTime: {
                type: String,
                validate: {
                    validator: function (v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: props => `${props.value} is not a valid time format! Use HH:MM`
                }
            },
            status: {
                type: String,
                enum: ["scheduled", "live", "completed"],
                default: "scheduled"
            },
            result: {
                winner: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Team'
                },
                score: {
                    type: String
                }
            },
            matchType: {
                type: String,
                enum: ["group", "quarter-final", "semi-final", "final"],
                default: "group"
            },
            groupName: {
                type: String
            }
        }],
        umpire: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        winner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
        },
        runnerUp: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
        },
        matchStartTime: {
            type: String,
            required: true,
            validate: {
                validator: function (v) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: props => `${props.value} is not a valid time format! Use HH:MM`
            }
        },
        matchDuration: {
            type: Number,
            required: true,
            min: 60,  // Minimum 1 hour
            max: 360, // Maximum 6 hours
            description: "Match duration in minutes"
        },
        matchGapMinutes: {
            type: Number,
            required: true,
            default: 10,
            min: 10,
            max: 120,
            description: "Gap between matches in minutes"
        },
        substitute: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
            max: 10,
            description: "Number of substitutes allowed per team"
        },
        totalMember: {
            type: Number,
            required: true,
            default: 0,
            min: 5,
            max: 15,
            description: "Total number of players allowed per team"
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        isClubOnly: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament; 