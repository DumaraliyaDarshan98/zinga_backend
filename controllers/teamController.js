import Team from '../models/Teams.js';
import User from '../models/User.js';

export const createTeam = async (req, res) => {
    try {
        const { teamName, logo, players } = req.body;
        const userId = req.user.id;
        
        // Add creator as a playing player by default
        const formattedPlayers = [
            { player: userId, isPlaying: true },
            ...players.map(playerId => ({ player: playerId, isPlaying: true }))
        ];
        
        const team = new Team({ 
            teamName, 
            logo, 
            players: formattedPlayers, 
            createdBy: userId 
        });
        
        await team.save();
        
        // Populate players before returning
        const populatedTeam = await Team.findById(team._id)
            .populate('players.player', 'name email avatar mobile')
            .populate('createdBy', 'name email');
            
        return res.status(201).json({
            status: true,
            message: 'Team created successfully',
            data: populatedTeam,
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTeam = await Team.findByIdAndUpdate(id, req.body, { new: true })
            .populate('players.player', 'name email avatar mobile')
            .populate('createdBy', 'name email');
            
        if (!updatedTeam) return res.status(404).json({
            status: false,
            message: 'Team not found',
            data: null
        });
        return res.json({
            status: true,
            message: 'Team updated successfully',
            data: updatedTeam
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const playerAction = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { action, isPlaying = true } = req.query;

        const team = await Team.findById(id);
        if (!team) return res.status(404).json({
            status: false,
            message: 'Team not found',
            data: null
        });

        if (action === 'add') {
            // Check if player already exists in the team
            const existingPlayerIndex = team.players.findIndex(p => p.player && p.player.toString() === userId);
            
            if (existingPlayerIndex === -1) {
                // Add new player with playing status
                team.players.push({ player: userId, isPlaying });
            } else {
                // Update existing player's playing status
                team.players[existingPlayerIndex].isPlaying = isPlaying;
            }
        } else if (action === 'remove') {
            // Remove player completely
            team.players = team.players.filter(p => p.player && p.player.toString() !== userId);
        } else if (action === 'updateStatus') {
            // Just update playing status of an existing player
            const existingPlayerIndex = team.players.findIndex(p => p.player && p.player.toString() === userId);
            
            if (existingPlayerIndex !== -1) {
                team.players[existingPlayerIndex].isPlaying = isPlaying;
            } else {
                return res.status(404).json({
                    status: false,
                    message: 'Player not found in team',
                    data: null
                });
            }
        } else {
            return res.status(400).json({ 
                status: false,
                message: 'Invalid action. Must be add, remove, or updateStatus',
                data: null
            });
        }

        await team.save();
        
        // Populate players before returning
        const populatedTeam = await Team.findById(id)
            .populate('players.player', 'name email avatar mobile')
            .populate('createdBy', 'name email');
            
        return res.json({
            status: true,
            message: 'Player action successful',
            data: populatedTeam
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getTeams = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let teams;
        if (role === 'admin') {
            teams = await Team.find()
                .populate('players.player', 'name email avatar mobile')
                .populate('createdBy', 'name email');
        } else {
            teams = await Team.find({
                $or: [
                    { createdBy: userId },
                    { 'players.player': userId }
                ]
            })
                .populate('players.player', 'name email avatar mobile')
                .populate('createdBy', 'name email');
        }

        return res.json({
            status: true,
            data: teams,
            message: 'Teams fetched successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};
