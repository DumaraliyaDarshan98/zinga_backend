// import Team from '../models/Team.js';
import Team from '../models/Teams.js';
import Tournament from '../models/Tournament.js';
import mongoose from 'mongoose';

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