import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true,
        trim: true,
    },
    slots: [
        {
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            from: {
                type: String,
                required: true,
                trim: true,
            },
            to: {
                type: String,
                required: true,
                trim: true,
            },
            isTournament: {
                type: Boolean,
                default: false,
            },
            price: {
                type: Number,
                default: 0,
            },
            tournamentPrice: {
                type: Number,
                default: 0,
            },
        },
    ],
    range: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        from: {
            type: String,
            required: true,
            trim: true,
        },
        to: {
            type: String,
            required: true,
            trim: true,
        },
    }],
    isClosed: {
        type: Boolean,
        default: false,
    }
}, { versionKey: false });


const courtSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    games: {
        type: [String],
    },
    times: [timeSlotSchema],
}, { versionKey: false });


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        required: true,
        trim: true,
    }
}, { versionKey: false });


const groundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    address1: {
        type: String,
        required: true,
        trim: true,
    },
    address2: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        trim: true,
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
    },
    coordinates: {
        type: String,
        trim: true,
    },
    googleLink: {
        type: String,
        trim: true,
    },
    images: {
        type: [String],
        default: []
    },
    amenities: {
        type: [String],
    },
    groundPrice: {
        type: Number,
        required: true,
        default: 0
    },
    tournamentPrice: {
        type: Number,
        required: true,
        default: 0
    },
    courts: [courtSchema],
    users: [userSchema],
    status: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true,
    versionKey: false
});

const Ground = mongoose.model('Ground', groundSchema);

export default Ground;
