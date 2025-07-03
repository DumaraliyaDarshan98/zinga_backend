// import Team from '../models/Team.js';
import Team from '../models/Teams.js';
import Tournament from '../models/Tournament.js';
import mongoose from 'mongoose';
import TournamentTeam from '../models/TournamentTeam.js';

/**
 * Update team's tournament statistics after a match
 */
export const updateTeamTournamentStats = async (teamId, tournamentId, matchResult) => {
    try {
        const team = await Team.findById(teamId);
        if (!team) {
            throw new Error('Team not found');
        }

        // Find or create tournament stats entry
        let tournamentStat = team.tournamentStats.find(
            stat => stat.tournament.toString() === tournamentId.toString()
        );

        if (!tournamentStat) {
            tournamentStat = {
                tournament: tournamentId,
                status: 'active',
                matchesPlayed: 0,
                matchesWon: 0,
                matchesLost: 0,
                points: 0,
                netRunRate: 0,
                tournamentPlayers: team.players.map(p => ({
                    player: p.player,
                    matchesPlayed: 0,
                    runs: 0,
                    wickets: 0,
                    isActive: true
                }))
            };
            team.tournamentStats.push(tournamentStat);
        }

        // Update match statistics
        tournamentStat.matchesPlayed += 1;
        if (matchResult.winner.toString() === teamId.toString()) {
            tournamentStat.matchesWon += 1;
            tournamentStat.points += 2; // Win = 2 points
        } else {
            tournamentStat.matchesLost += 1;
        }

        // Update player statistics
        if (matchResult.playerStats) {
            matchResult.playerStats.forEach(playerStat => {
                const tournamentPlayer = tournamentStat.tournamentPlayers.find(
                    p => p.player.toString() === playerStat.playerId.toString()
                );
                if (tournamentPlayer) {
                    tournamentPlayer.matchesPlayed += 1;
                    tournamentPlayer.runs += playerStat.runs || 0;
                    tournamentPlayer.wickets += playerStat.wickets || 0;
                }
            });
        }

        await team.save();
        return team;
    } catch (error) {
        throw error;
    }
};

/**
 * Get team's tournament statistics
 */
export const getTeamTournamentStats = async (req, res) => {
    try {
        const { teamId, tournamentId } = req.params;

        const team = await Team.findById(teamId)
            .populate('tournamentStats.tournament', 'tournamentId seriesName tournamentType')
            .populate('tournamentStats.tournamentPlayers.player', 'name email');

        if (!team) {
            return res.status(404).json({
                status: false,
                message: 'Team not found',
                data: null
            });
        }

        const tournamentStats = team.tournamentStats.find(
            stat => stat.tournament._id.toString() === tournamentId
        );

        if (!tournamentStats) {
            return res.status(404).json({
                status: false,
                message: 'Team not registered in this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            data: tournamentStats,
            message: 'Team tournament statistics retrieved successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update team's tournament status
 */
export const updateTeamTournamentStatus = async (req, res) => {
    try {
        const { teamId, tournamentId } = req.params;
        const { status } = req.body;

        if (!['registered', 'active', 'eliminated', 'completed'].includes(status)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid status',
                data: null
            });
        }

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                status: false,
                message: 'Team not found',
                data: null
            });
        }

        const tournamentStat = team.tournamentStats.find(
            stat => stat.tournament.toString() === tournamentId
        );

        if (!tournamentStat) {
            return res.status(404).json({
                status: false,
                message: 'Team not registered in this tournament',
                data: null
            });
        }

        tournamentStat.status = status;
        await team.save();

        return res.status(200).json({
            status: true,
            data: tournamentStat,
            message: 'Team tournament status updated successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update tournament player status
 */
export const updateTournamentPlayerStatus = async (req, res) => {
    try {
        const { teamId, tournamentId, playerId } = req.params;
        const { isActive } = req.body;

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                status: false,
                message: 'Team not found',
                data: null
            });
        }

        const tournamentStat = team.tournamentStats.find(
            stat => stat.tournament.toString() === tournamentId
        );

        if (!tournamentStat) {
            return res.status(404).json({
                status: false,
                message: 'Team not registered in this tournament',
                data: null
            });
        }

        const tournamentPlayer = tournamentStat.tournamentPlayers.find(
            p => p.player.toString() === playerId
        );

        if (!tournamentPlayer) {
            return res.status(404).json({
                status: false,
                message: 'Player not found in tournament team',
                data: null
            });
        }

        tournamentPlayer.isActive = isActive;
        await team.save();

        return res.status(200).json({
            status: true,
            data: tournamentPlayer,
            message: 'Tournament player status updated successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}; 

/**
 * Add or Remove tournament player
 */
export const playerAction = async (req, res) => {
    try {
        const { tournamentTeamId, userId } = req.params;
        const { action, isPlaying = true } = req.query;

        const tournamentTeam = await TournamentTeam.findById(tournamentTeamId);
        if (!tournamentTeam) return res.status(404).json({
            status: false,
            message: 'Team not found',
            data: null
        });
        
        if (action === 'add') {
            // Check if player already exists in the team
            const existingPlayerIndex = tournamentTeam.players.findIndex(p => p.player && p.player.toString() === userId);
            
            if (existingPlayerIndex === -1) {
                // Add new player with playing status
                tournamentTeam.players.push({ player: userId, isPlaying });
            } else {
                // Update existing player's playing status
                tournamentTeam.players[existingPlayerIndex].isPlaying = isPlaying;
            }
        } else if (action === 'remove') {
            // Remove player completely
            tournamentTeam.players = tournamentTeam.players.filter(p => p.player && p.player.toString() !== userId);
        } else if (action === 'updateStatus') {
            // Just update playing status of an existing player
            const existingPlayerIndex = tournamentTeam.players.findIndex(p => p.player && p.player.toString() === userId);
            
            if (existingPlayerIndex !== -1) {
                tournamentTeam.players[existingPlayerIndex].isPlaying = isPlaying;
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

        await tournamentTeam.save();
        
        // Populate players before returning
        const populatedTeam = await TournamentTeam.findById(tournamentTeamId)
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


/**
 * Get Tournament Team detail
 */
export const getTournamentTeamDetail = async (req, res) => {
    try {
        const { teamId, bookingId } = req.params;

        let query = {
            team: teamId,
            booking :bookingId 
        };
        
        // Get tournament team with detailed information
        const tournamentTeam = await TournamentTeam.findOne(query)
            .populate('players.player', 'name email avatar mobile')
            .populate('createdBy', 'name email');

        if (!tournamentTeam) return res.status(404).json({
            status: false,
            message: 'Team not found',
            data: null
        });

        return res.json({
            status: true,
            message: 'Tournament team detail',
            data: tournamentTeam
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};