import mongoose from 'mongoose';

const tournamentGroundRegistrationSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    ground: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    }
}, {
    timestamps: true
});

// Compound index to ensure unique team registration per ground in a tournament
tournamentGroundRegistrationSchema.index({ tournament: 1, ground: 1, team: 1 }, { unique: true });

const TournamentGroundRegistration = mongoose.model('TournamentGroundRegistration', tournamentGroundRegistrationSchema);

export default TournamentGroundRegistration; 