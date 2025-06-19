import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Roles } from '../constant/role.js'

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        default: 'player',
        enum: [Roles.ADMIN, Roles.GROUND_OWNER, Roles.PLAYER, Roles.UMPIRE, Roles.GROUND_STAFF],
    },
    mobile: {
        type: String,
        trim: true,
        default: "",
    },
    age: {
        type: Number,
        default: null,
    },
    height: {
        type: Number,
        default: null,
    },
    dateOfBirth: {
        type: Date,
        default: null,
    },
    avatar: {
        type: String,
        default: "",
    },
    playerInfo: [{
        type: mongoose.Schema.Types.Mixed,
    }],
    groundAdded: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Ground',
    },
    clubs: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Club',
    },
    tournamentAchievements: [{
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
        },
        position: {
            type: String,
            enum: ['winner', 'runner-up', 'semi-finalist'],
        },
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
        },
        earnedAt: {
            type: Date,
            default: Date.now,
        }
    }],
    loggedIn: {
        type: Boolean,
        default: false,
    },
    approve: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});


const User = mongoose.model('User', userSchema);

export default User;
