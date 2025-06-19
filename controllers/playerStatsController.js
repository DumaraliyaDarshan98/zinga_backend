import PlayerStats from '../models/PlayerStats.js';
import mongoose from 'mongoose';

/**
 * Get player statistics by player ID
 */
export const getPlayerStats = async (req, res) => {
    try {
        const { playerId } = req.params;
        
        const playerStats = await PlayerStats.findOne({ player: playerId })
            .populate('player', 'name email mobile profilePic')
            .populate('team', 'teamName logo');
        
        if (!playerStats) {
            return res.status(404).json({
                status: false,
                message: 'Player statistics not found',
                data: null
            });
        }
        
        return res.status(200).json({
            status: true,
            message: 'Player statistics fetched successfully',
            data: playerStats
        });
    } catch (error) {
        console.error('Error fetching player statistics:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get player statistics by player ID and ball type
 */
export const getPlayerStatsByBallType = async (req, res) => {
    try {
        const { playerId, ballType } = req.params;
        
        if (!['white', 'red', 'pink'].includes(ballType)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid ball type. Must be one of: white, red, pink',
                data: null
            });
        }
        
        const playerStats = await PlayerStats.findOne({ player: playerId })
            .populate('player', 'name email mobile profilePic')
            .populate('team', 'teamName logo');
        
        if (!playerStats) {
            return res.status(404).json({
                status: false,
                message: 'Player statistics not found',
                data: null
            });
        }
        
        const ballTypeStats = {
            player: playerStats.player,
            team: playerStats.team,
            ballType,
            totalMatches: playerStats.careerStats[ballType].batting.matches,
            batting: playerStats.careerStats[ballType].batting,
            bowling: playerStats.careerStats[ballType].bowling,
            matchesPlayed: playerStats.matchesPlayed.filter(match => match.ballType === ballType)
        };
        
        return res.status(200).json({
            status: true,
            message: `Player statistics for ${ballType} ball fetched successfully`,
            data: ballTypeStats
        });
    } catch (error) {
        console.error('Error fetching player statistics by ball type:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get player match history
 */
export const getPlayerMatchHistory = async (req, res) => {
    try {
        const { playerId } = req.params;
        const { ballType } = req.query;
        
        // Create match filter
        const matchFilter = { player: playerId };
        
        // If ball type is specified, filter by it
        if (ballType && ['white', 'red', 'pink'].includes(ballType)) {
            matchFilter['matchesPlayed.ballType'] = ballType;
        }
        
        const playerStats = await PlayerStats.findOne(matchFilter)
            .populate('player', 'name email mobile profilePic')
            .populate('team', 'teamName logo')
            .populate('matchesPlayed.match', 'matchNumber matchDate status result');
        
        if (!playerStats) {
            return res.status(404).json({
                status: false,
                message: 'Player statistics not found',
                data: null
            });
        }
        
        // Filter matches by ball type if specified
        const matchHistory = ballType ? 
            playerStats.matchesPlayed.filter(match => match.ballType === ballType) : 
            playerStats.matchesPlayed;
        
        return res.status(200).json({
            status: true,
            message: 'Player match history fetched successfully',
            data: {
                player: playerStats.player,
                team: playerStats.team,
                totalMatches: matchHistory.length,
                matches: matchHistory
            }
        });
    } catch (error) {
        console.error('Error fetching player match history:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get team stats leaderboard
 */
export const getTeamLeaderboard = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { ballType, statType } = req.query;

        // Validate query parameters
        if (!ballType || !['white', 'red', 'pink'].includes(ballType)) {
            return res.status(400).json({
                status: false,
                message: 'Valid ball type is required (white, red, or pink)',
                data: null
            });
        }

        if (!statType || !['batting', 'bowling'].includes(statType)) {
            return res.status(400).json({
                status: false,
                message: 'Valid stat type is required (batting or bowling)',
                data: null
            });
        }

        // Find all players in the team
        const teamStats = await PlayerStats.find({ team: teamId })
            .populate('player', 'name email mobile profilePic')
            .populate('team', 'teamName logo');

        if (!teamStats || teamStats.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No statistics found for this team',
                data: null
            });
        }

        // Process stats based on requested type
        let leaderboard = [];
        
        if (statType === 'batting') {
            leaderboard = teamStats.map(player => ({
                player: player.player,
                matches: player.careerStats[ballType].batting.matches,
                innings: player.careerStats[ballType].batting.innings,
                runs: player.careerStats[ballType].batting.runs,
                average: player.careerStats[ballType].batting.average,
                strikeRate: player.careerStats[ballType].batting.strikeRate,
                fifties: player.careerStats[ballType].batting.fifties,
                hundreds: player.careerStats[ballType].batting.hundreds,
                highestScore: player.careerStats[ballType].batting.highestScore
            })).sort((a, b) => b.runs - a.runs);
        } else {
            leaderboard = teamStats.map(player => ({
                player: player.player,
                matches: player.careerStats[ballType].bowling.matches,
                innings: player.careerStats[ballType].bowling.innings,
                wickets: player.careerStats[ballType].bowling.wickets,
                economy: player.careerStats[ballType].bowling.economy,
                average: player.careerStats[ballType].bowling.average,
                fiveWickets: player.careerStats[ballType].bowling.fiveWickets,
                bestBowling: player.careerStats[ballType].bowling.bestBowling
            })).sort((a, b) => b.wickets - a.wickets);
        }

        return res.status(200).json({
            status: true,
            message: `Team ${statType} leaderboard fetched successfully`,
            data: {
                team: teamStats[0].team,
                ballType,
                statType,
                players: leaderboard
            }
        });
    } catch (error) {
        console.error('Error fetching team leaderboard:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}; 