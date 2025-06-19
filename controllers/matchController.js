import Match from '../models/Match.js';
import Tournament from '../models/Tournament.js';
import PlayerStats from '../models/PlayerStats.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Get match details by ID
 */
export const getMatchById = async (req, res) => {
    try {
        const { matchId } = req.params;

        const matchData = await Match.findById(matchId)
            .populate('tournament', 'tournamentId seriesName tournamentType matchType ballType pitchType oversPerInnings oversPerBowler')
            .populate({
                path: 'teamA',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate({
                path: 'teamB',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate('venue', 'name city address1')
            .populate('umpires', 'name email mobile')
            .populate('firstInnings.currentStriker', 'name avatar')
            .populate('firstInnings.currentNonStriker', 'name avatar')
            .populate('firstInnings.currentBowler', 'name avatar')
            .populate('firstInnings.currentKeeper', 'name avatar')
            .populate('firstInnings.battingTeam', 'teamName')
            .populate('firstInnings.bowlingTeam', 'teamName')
            .populate('firstInnings.playerReplacements.originalPlayer', 'name avatar mobile')
            .populate('firstInnings.playerReplacements.replacementPlayer', 'name avatar mobile')
            .populate('secondInnings.currentStriker', 'name avatar')
            .populate('secondInnings.currentNonStriker', 'name avatar')
            .populate('secondInnings.currentBowler', 'name avatar')
            .populate('secondInnings.currentKeeper', 'name avatar')
            .populate('secondInnings.battingTeam', 'teamName')
            .populate('secondInnings.bowlingTeam', 'teamName')
            .populate('secondInnings.playerReplacements.originalPlayer', 'name avatar mobile')
            .populate('secondInnings.playerReplacements.replacementPlayer', 'name avatar mobile')
            .populate('tossWinner', 'teamName');

        const match = JSON.parse(JSON.stringify(matchData));
        // Populate player details in balls array
        if (match && match.firstInnings && match.firstInnings.balls && match.firstInnings.balls.length > 0) {
            await Match.populate(match, {
                path: 'firstInnings.balls.striker firstInnings.balls.bowler firstInnings.balls.playerOut',
                select: 'name avatar'
            });
        }

        if (match && match.secondInnings && match.secondInnings.balls && match.secondInnings.balls.length > 0) {
            await Match.populate(match, {
                path: 'secondInnings.balls.striker secondInnings.balls.bowler secondInnings.balls.playerOut',
                select: 'name avatar'
            });
        }

        if (!match) {
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Add isOut flag to players in teamA and teamB
        if (match) {
            // Create a set of players who are out
            const outPlayerIds = new Set();

            // Check firstInnings for wickets
            if (match.firstInnings && match.firstInnings.balls) {
                match.firstInnings.balls.forEach(ball => {
                    if (ball.isWicket && ball.playerOut) {
                        const playerId = ball.playerOut._id ? ball.playerOut._id.toString() : ball.playerOut.toString();
                        outPlayerIds.add(playerId);
                    }
                });
            }

            // Check secondInnings for wickets
            if (match.secondInnings && match.secondInnings.balls) {
                match.secondInnings.balls.forEach(ball => {
                    if (ball.isWicket && ball.playerOut) {
                        const playerId = ball.playerOut._id ? ball.playerOut._id.toString() : ball.playerOut.toString();
                        outPlayerIds.add(playerId);
                    }
                });
            }

            // Add isOut flag to teamA players
            if (match.teamA && match.teamA.players) {
                match.teamA.players.forEach(playerInfo => {
                    if (playerInfo.player) {
                        const playerId = playerInfo.player._id.toString();
                        playerInfo.isOut = outPlayerIds.has(playerId);
                    }
                });
            }

            // Add isOut flag to teamB players
            if (match.teamB && match.teamB.players) {
                match.teamB.players.forEach(playerInfo => {
                    if (playerInfo.player) {
                        const playerId = playerInfo.player._id.toString();
                        playerInfo.isOut = outPlayerIds.has(playerId);
                    }
                });
            }
        }


        return res.status(200).json({
            status: true,
            message: 'Match details fetched successfully',
            data: match
        });
    } catch (error) {
        console.error('Error fetching match details:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update match status (scheduled → live → completed)
 * Additional functionalities: Revise target (DLS), End Match, End/Declare Innings, Change match overs
 */
export const updateMatchStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { matchId } = req.params;
        const {
            status,
            reviseTarget,          // For DLS method
            endMatch,              // End match prematurely
            endInnings,            // End/Declare innings
            changeOvers,           // Change number of overs
            reason,                // Reason for change (rain, bad light, time, late start, etc.)
            targetRuns,            // Revised target runs (for DLS)
            targetOvers,           // Revised target overs (for DLS)
            inningsToEnd,          // Which innings to end (firstInnings/secondInnings)
            newTotalOvers,         // New total overs for the match
            commentary             // Commentary explaining the change
        } = req.body;

        // Validate status if provided
        if (status && !['scheduled', 'live', 'paused', 'completed', 'abandoned', 'delayed'].includes(status)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid status. Must be one of: scheduled, live, paused, completed, abandoned, delayed',
                data: null
            });
        }

        // Find match
        const match = await Match.findById(matchId)
            .populate('tournament', 'ballType')
            .populate('teamA', 'teamName logo')
            .populate('teamB', 'teamName logo')
            .populate('venue', 'name city')
            .session(session);

        if (!match) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        const previousStatus = match.status;
        let actionTaken = [];

        // 1. Handle standard status update
        if (status) {
            // Validate status transition
            if (status === 'live' && match.status !== 'scheduled' && match.status !== 'paused' && match.status !== 'delayed') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Can only start a scheduled, paused, or delayed match',
                    data: null
                });
            }

            if (status === 'completed' && !match.firstInnings.isComplete) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Cannot complete match before first innings is complete',
                    data: null
                });
            }

            // Update match status
            match.status = status;
            actionTaken.push('Status updated');
        }

        // 2. Handle revised target (DLS method)
        if (reviseTarget) {
            if (!targetRuns || !targetOvers) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Target runs and overs are required for revising target',
                    data: null
                });
            }

            // Add DLS information to the match
            if (!match.dls) {
                match.dls = {};
            }

            match.dls = {
                isApplied: true,
                originalTarget: match.firstInnings.totalRuns + 1, // Original target was 1 more than first innings total
                revisedTarget: targetRuns,
                originalOvers: match.tournament.oversPerInnings,
                revisedOvers: targetOvers,
                reason: reason || 'Weather interruption',
                appliedAt: new Date(),
                commentary: commentary || `Target revised to ${targetRuns} runs in ${targetOvers} overs using DLS method`
            };

            actionTaken.push('Target revised using DLS method');
        }

        // 3. Handle end/declare innings
        if (endInnings) {
            if (!inningsToEnd || !['firstInnings', 'secondInnings'].includes(inningsToEnd)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Valid innings to end (firstInnings or secondInnings) is required',
                    data: null
                });
            }

            // Cannot end an already completed innings
            if (match[inningsToEnd].isComplete) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: `${inningsToEnd === 'firstInnings' ? 'First' : 'Second'} innings is already complete`,
                    data: null
                });
            }

            // Mark the innings as complete
            match[inningsToEnd].isComplete = true;
            match[inningsToEnd].declarationInfo = {
                isDeclared: true,
                reason: reason || 'Tactical declaration',
                time: new Date(),
                commentary: commentary || `${inningsToEnd === 'firstInnings' ? 'First' : 'Second'} innings declared`
            };

            actionTaken.push(`${inningsToEnd === 'firstInnings' ? 'First' : 'Second'} innings ended/declared`);
        }

        // 4. Handle change in match overs
        if (changeOvers) {
            if (!newTotalOvers || isNaN(Number(newTotalOvers)) || Number(newTotalOvers) <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Valid new total overs is required to change match overs',
                    data: null
                });
            }

            // Convert to number to ensure it's a valid numeric value
            const newTotalOversNum = Number(newTotalOvers);

            // Determine previous overs value - ensure it's a valid number
            let previousOversValue = 20; // Default fallback value
            
            if (match.currentOversPerInnings && !isNaN(Number(match.currentOversPerInnings))) {
                previousOversValue = Number(match.currentOversPerInnings);
            } else if (match.tournament && match.tournament.oversPerInnings && !isNaN(Number(match.tournament.oversPerInnings))) {
                previousOversValue = Number(match.tournament.oversPerInnings);
            }

            // Create a valid change history entry
            const changeHistoryEntry = {
                previousOvers: previousOversValue,
                newOvers: newTotalOversNum,
                reason: reason || 'Match overs adjusted',
                timestamp: new Date(),
                commentary: commentary || `Match overs changed from ${previousOversValue} to ${newTotalOversNum}`
            };

            // Initialize or update oversChangeHistory
            if (!match.oversChangeHistory) {
                match.oversChangeHistory = [changeHistoryEntry];
            } else if (!Array.isArray(match.oversChangeHistory)) {
                match.oversChangeHistory = [changeHistoryEntry];
            } else if (match.oversChangeHistory.length === 0) {
                match.oversChangeHistory = [changeHistoryEntry];
            } else {
                // Get the last change safely
                const lastChangeIdx = match.oversChangeHistory.length - 1;
                if (lastChangeIdx >= 0 && match.oversChangeHistory[lastChangeIdx] && 
                    match.oversChangeHistory[lastChangeIdx].newOvers && 
                    !isNaN(Number(match.oversChangeHistory[lastChangeIdx].newOvers))) {
                    
                    // Update entry with the actual previous value
                    changeHistoryEntry.previousOvers = Number(match.oversChangeHistory[lastChangeIdx].newOvers);
                    changeHistoryEntry.commentary = commentary || 
                        `Match overs changed from ${changeHistoryEntry.previousOvers} to ${newTotalOversNum}`;
                }
                
                match.oversChangeHistory.push(changeHistoryEntry);
            }

            // Update current match overs
            match.currentOversPerInnings = newTotalOversNum;

            // If overs are reduced during an innings, check if the innings should be completed
            ['firstInnings', 'secondInnings'].forEach(inn => {
                if (match[inn] && !match[inn].isComplete && match[inn].overs >= newTotalOversNum) {
                    match[inn].isComplete = true;
                    match[inn].oversReductionInfo = {
                        isReduced: true,
                        reason: reason || 'Match overs reduced',
                        time: new Date(),
                        commentary: commentary || `${inn === 'firstInnings' ? 'First' : 'Second'} innings completed due to reduction in overs`
                    };
                }
            });

            actionTaken.push('Match overs changed');
        }

        // 5. Handle end match prematurely
        if (endMatch) {
            if (!reason) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Reason is required to end match prematurely',
                    data: null
                });
            }

            match.status = 'abandoned';
            match.abandonInfo = {
                reason,
                time: new Date(),
                commentary: commentary || `Match abandoned due to ${reason}`
            };

            actionTaken.push('Match ended prematurely');
        }

        // Calculate result if match is completed
        let result = null;
        if ((status === 'completed' || endMatch) && match.status === 'completed') {
            let firstInningsScore = match.firstInnings.totalRuns;
            let secondInningsScore = match.secondInnings.totalRuns;
            let targetToWin = match.dls && match.dls.isApplied ? match.dls.revisedTarget : firstInningsScore + 1;

            if (secondInningsScore >= targetToWin) {
                match.result = {
                    winner: match.secondInnings.battingTeam,
                    margin: `${match.secondInnings.wickets} wickets`
                };
            } else if (secondInningsScore < targetToWin - 1) { // Account for exact ties
                match.result = {
                    winner: match.firstInnings.battingTeam,
                    margin: `${targetToWin - 1 - secondInningsScore} runs`
                };
            } else {
                match.result = {
                    winner: null,
                    margin: 'Match tied'
                };
            }

            result = match.result;

            // Get ball type from tournament
            const ballType = match.tournament.ballType;

            // Update player statistics for first innings
            await updateInningsStats(match.firstInnings, ballType, session);

            // Update player statistics for second innings
            await updateInningsStats(match.secondInnings, ballType, session);
        }

        // Ensure at least one action was taken
        if (actionTaken.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'No action specified. Please provide at least one valid action to perform.',
                data: null
            });
        }

        await match.save({ session });

        // Update tournament match status
        const tournament = await Tournament.findOne({ 'matches._id': matchId }).session(session);
        if (tournament) {
            const tournamentMatch = tournament.matches.id(matchId);
            if (tournamentMatch) {
                if (status) {
                    tournamentMatch.status = status;
                }
                if (match.status === 'completed' && match.result) {
                    tournamentMatch.result = {
                        winner: match.result.winner,
                        score: match.result.margin
                    };
                }
                await tournament.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        // Prepare socket event data
        const eventData = {
            matchId,
            previousStatus,
            currentStatus: match.status,
            teams: {
                teamA: match.teamA,
                teamB: match.teamB
            },
            venue: match.venue,
            tournament: tournament ? {
                id: tournament._id,
                name: tournament.seriesName
            } : null,
            actionsPerformed: actionTaken,
            dls: match.dls || null,
            oversChangeHistory: match.oversChangeHistory || null,
            declarationInfo: (match.firstInnings.declarationInfo || match.secondInnings.declarationInfo) || null,
            abandonInfo: match.abandonInfo || null
        };

        // Add result data if match is completed
        if (match.status === 'completed' && result) {
            eventData.result = result;
            eventData.firstInningsScore = match.firstInnings.totalRuns;
            eventData.secondInningsScore = match.secondInnings.totalRuns;
        }

        // Emit socket event for match status change
        broadcastMatchEvent(matchId, 'STATUS_CHANGED', eventData);

        return res.status(200).json({
            status: true,
            message: `Match updated successfully. Actions performed: ${actionTaken.join(', ')}`,
            data: match
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating match status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Helper function to update player statistics for an innings
 */
const updateInningsStats = async (innings, ballType, session) => {
    // Update batting statistics
    const battingTeam = innings.battingTeam;
    const bowlingTeam = innings.bowlingTeam;

    // Process each ball to update batting statistics
    for (const ball of innings.balls) {
        // Update striker's statistics
        if (ball.striker) {
            const playerStats = await PlayerStats.findOneAndUpdate(
                {
                    player: ball.striker,
                    team: battingTeam
                },
                {
                    $inc: {
                        [`careerStats.${ballType}.batting.runs`]: ball.runs,
                        [`careerStats.${ballType}.batting.balls`]: 1,
                        [`careerStats.${ballType}.batting.fours`]: ball.runs === 4 ? 1 : 0,
                        [`careerStats.${ballType}.batting.sixes`]: ball.runs === 6 ? 1 : 0
                    }
                },
                {
                    session,
                    upsert: true,
                    new: true
                }
            );

            // Update highest score if applicable
            if (ball.runs > playerStats.careerStats[ballType].batting.highestScore) {
                playerStats.careerStats[ballType].batting.highestScore = ball.runs;
            }

            // Update fifties and hundreds
            const totalRuns = playerStats.careerStats[ballType].batting.runs;
            if (totalRuns >= 100) {
                playerStats.careerStats[ballType].batting.hundreds = Math.floor(totalRuns / 100);
            }
            if (totalRuns >= 50) {
                playerStats.careerStats[ballType].batting.fifties = Math.floor(totalRuns / 50);
            }

            // Calculate strike rate and average
            playerStats.careerStats[ballType].batting.strikeRate =
                (totalRuns / playerStats.careerStats[ballType].batting.balls) * 100;
            playerStats.careerStats[ballType].batting.average =
                totalRuns / (playerStats.careerStats[ballType].batting.innings || 1);

            await playerStats.save({ session });
        }

        // Update bowler's statistics if wicket
        if (ball.isWicket && ball.bowler) {
            const playerStats = await PlayerStats.findOneAndUpdate(
                {
                    player: ball.bowler,
                    team: bowlingTeam
                },
                {
                    $inc: {
                        [`careerStats.${ballType}.bowling.wickets`]: 1,
                        [`careerStats.${ballType}.bowling.runs`]: ball.runs,
                        [`careerStats.${ballType}.bowling.overs`]: 0.1 // 1 ball = 0.1 overs
                    }
                },
                {
                    session,
                    upsert: true,
                    new: true
                }
            );

            // Update five-wicket and ten-wicket hauls
            const wickets = playerStats.careerStats[ballType].bowling.wickets;
            if (wickets >= 10) {
                playerStats.careerStats[ballType].bowling.tenWickets = Math.floor(wickets / 10);
            }
            if (wickets >= 5) {
                playerStats.careerStats[ballType].bowling.fiveWickets = Math.floor(wickets / 5);
            }

            // Update best bowling if applicable
            const currentBest = playerStats.careerStats[ballType].bowling.bestBowling;
            if (wickets > currentBest.wickets ||
                (wickets === currentBest.wickets && ball.runs < currentBest.runs)) {
                playerStats.careerStats[ballType].bowling.bestBowling = {
                    wickets: wickets,
                    runs: ball.runs
                };
            }

            // Calculate economy and average
            playerStats.careerStats[ballType].bowling.economy =
                (playerStats.careerStats[ballType].bowling.runs / playerStats.careerStats[ballType].bowling.overs);
            playerStats.careerStats[ballType].bowling.average =
                playerStats.careerStats[ballType].bowling.runs / wickets;

            await playerStats.save({ session });
        }
    }

    // Update match count and innings count for all players
    const allPlayers = [...new Set([
        ...innings.balls.map(ball => ball.striker).filter(Boolean),
        ...innings.balls.map(ball => ball.bowler).filter(Boolean)
    ])];

    for (const playerId of allPlayers) {
        await PlayerStats.findOneAndUpdate(
            { player: playerId },
            {
                $inc: {
                    totalMatches: 1,
                    [`careerStats.${ballType}.batting.matches`]: 1,
                    [`careerStats.${ballType}.batting.innings`]: 1,
                    [`careerStats.${ballType}.bowling.matches`]: 1,
                    [`careerStats.${ballType}.bowling.innings`]: 1
                }
            },
            { session }
        );
    }
};

/**
 * Update toss information
 */
export const updateToss = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const { tossWinner, tossDecision } = req.body;

        // Validate input
        if (!tossWinner || !tossDecision) {
            return res.status(400).json({
                status: false,
                message: 'Toss winner and decision are required',
                data: null
            });
        }

        if (!['batting', 'bowling'].includes(tossDecision)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid toss decision. Must be either batting or bowling',
                data: null
            });
        }

        // Find match
        const match = await Match.findById(matchId)
            .populate('teamA', 'teamName logo')
            .populate('teamB', 'teamName logo')
            .session(session);
        if (!match) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Validate toss winner is one of the teams
        if (tossWinner.toString() !== match.teamA._id.toString() &&
            tossWinner.toString() !== match.teamB._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Toss winner must be one of the teams playing the match',
                data: null
            });
        }

        // Update toss information
        match.tossWinner = tossWinner;
        match.tossDecision = tossDecision;

        // Initialize innings objects if they don't exist
        if (!match.firstInnings) {
            match.firstInnings = {
                totalRuns: 0,
                wickets: 0,
                overs: 0,
                balls: [],
                isComplete: false
            };
        }

        if (!match.secondInnings) {
            match.secondInnings = {
                totalRuns: 0,
                wickets: 0,
                overs: 0,
                balls: [],
                isComplete: false
            };
        }

        // Set batting and bowling teams based on toss
        if (tossDecision === 'batting') {
            match.firstInnings.battingTeam = tossWinner;
            match.firstInnings.bowlingTeam = tossWinner.toString() === match.teamA._id.toString() ?
                match.teamB : match.teamA;
            match.secondInnings.battingTeam = match.firstInnings.bowlingTeam;
            match.secondInnings.bowlingTeam = match.firstInnings.battingTeam;
        } else {
            match.firstInnings.bowlingTeam = tossWinner;
            match.firstInnings.battingTeam = tossWinner.toString() === match.teamA._id.toString() ?
                match.teamB : match.teamA;
            match.secondInnings.bowlingTeam = match.firstInnings.battingTeam;
            match.secondInnings.battingTeam = match.firstInnings.bowlingTeam;
        }

        await match.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Determine the winner team name for better display in socket event
        const winnerTeam = match.tossWinner.toString() === match.teamA._id.toString() ?
            match.teamA : match.teamB;

        // Determine the first batting team
        const firstBattingTeam = match.firstInnings.battingTeam.toString() === match.teamA._id.toString() ?
            match.teamA : match.teamB;

        // Emit socket event for toss update
        broadcastMatchEvent(matchId, 'TOSS_UPDATED', {
            matchId,
            tossWinner: {
                id: winnerTeam._id,
                name: winnerTeam.teamName,
                logo: winnerTeam.logo
            },
            tossDecision,
            firstBattingTeam: {
                id: firstBattingTeam._id,
                name: firstBattingTeam.teamName,
                logo: firstBattingTeam.logo
            },
            matchSetup: {
                firstInnings: {
                    battingTeam: match.firstInnings.battingTeam,
                    bowlingTeam: match.firstInnings.bowlingTeam
                },
                secondInnings: {
                    battingTeam: match.secondInnings.battingTeam,
                    bowlingTeam: match.secondInnings.bowlingTeam
                }
            }
        });

        return res.status(200).json({
            status: true,
            message: 'Toss information updated successfully',
            data: match
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating toss information:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update current players in the innings
 */
export const updateCurrentPlayers = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const {
            innings,
            currentStriker,
            currentNonStriker,
            currentBowler,
            currentKeeper,
            replacementReason,
            reasonDescription,
            replacementPlayer,  // ID of the player being replaced
            replacementRole,    // Role of the player being replaced (striker, non-striker, bowler, keeper)
            changedRoles        // Array of roles that changed (optional, can be calculated)
        } = req.body;

        // Validate input
        if (!innings || !['firstInnings', 'secondInnings'].includes(innings)) {
            return res.status(400).json({
                status: false,
                message: 'Valid innings (firstInnings or secondInnings) is required',
                data: null
            });
        }

        if (!currentStriker || !currentNonStriker || !currentBowler || !currentKeeper) {
            return res.status(400).json({
                status: false,
                message: 'All current players are required',
                data: null
            });
        }

        // Validate replacement reason if provided
        if (replacementReason && !['injury', 'tactical', 'illness', 'cheating', 'other'].includes(replacementReason)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid replacement reason. Must be one of: injury, tactical, illness, cheating, other',
                data: null
            });
        }

        // Validate replacement role if provided
        if (replacementRole && !['striker', 'non-striker', 'bowler', 'keeper'].includes(replacementRole)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid replacement role. Must be one of: striker, non-striker, bowler, keeper',
                data: null
            });
        }

        // Find match
        const match = await Match.findById(matchId)
            .session(session);

        if (!match) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Track player replacement
        const playerReplacements = [];
        const rolesChanged = changedRoles || [];

        // Process player replacement if requested
        if (replacementPlayer && replacementReason && replacementRole) {
            let replacementFor = null;

            // Get the new player based on the specified role
            if (replacementRole === 'striker') {
                replacementFor = currentStriker;
                if (!rolesChanged.includes('striker')) {
                    rolesChanged.push('striker');
                }
            } else if (replacementRole === 'non-striker') {
                replacementFor = currentNonStriker;
                if (!rolesChanged.includes('non-striker')) {
                    rolesChanged.push('non-striker');
                }
            } else if (replacementRole === 'bowler') {
                replacementFor = currentBowler;
                if (!rolesChanged.includes('bowler')) {
                    rolesChanged.push('bowler');
                }
            } else if (replacementRole === 'keeper') {
                replacementFor = currentKeeper;
                if (!rolesChanged.includes('keeper')) {
                    rolesChanged.push('keeper');
                }
            }

            if (replacementFor) {
                playerReplacements.push({
                    originalPlayer: replacementPlayer,
                    replacementPlayer: replacementFor,
                    playerRole: replacementRole,
                    timestamp: new Date(),
                    reason: replacementReason,
                    description: reasonDescription || `${replacementRole} replacement due to ${replacementReason}`
                });
            } else {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: `Invalid replacement: no new player found for role '${replacementRole}'`,
                    data: null
                });
            }
        }

        // Update current players for the specified innings
        match[innings].currentStriker = currentStriker;
        match[innings].currentNonStriker = currentNonStriker;
        match[innings].currentBowler = currentBowler;
        match[innings].currentKeeper = currentKeeper;

        // Add player replacements to the innings if any
        if (playerReplacements.length > 0) {
            if (!match[innings].playerReplacements) {
                match[innings].playerReplacements = [];
            }
            match[innings].playerReplacements.push(...playerReplacements);
        }

        await match.save({ session });

        // Fetch player information for socket event
        const populatedMatch = await Match.findById(matchId)
            .populate('firstInnings.currentStriker', 'name avatar')
            .populate('firstInnings.currentNonStriker', 'name avatar')
            .populate('firstInnings.currentBowler', 'name avatar')
            .populate('firstInnings.currentKeeper', 'name avatar')
            .populate('firstInnings.playerReplacements.originalPlayer', 'name avatar')
            .populate('firstInnings.playerReplacements.replacementPlayer', 'name avatar')
            .populate('secondInnings.currentStriker', 'name avatar')
            .populate('secondInnings.currentNonStriker', 'name avatar')
            .populate('secondInnings.currentBowler', 'name avatar')
            .populate('secondInnings.currentKeeper', 'name avatar')
            .populate('secondInnings.playerReplacements.originalPlayer', 'name avatar')
            .populate('secondInnings.playerReplacements.replacementPlayer', 'name avatar')
            .session(session);

        await session.commitTransaction();
        session.endSession();

        // Get latest replacements for socket event
        const latestReplacements = playerReplacements.length > 0 ?
            populatedMatch[innings].playerReplacements.slice(-playerReplacements.length) : [];

        // Emit socket event for player update
        broadcastMatchEvent(matchId, 'PLAYERS_UPDATED', {
            matchId,
            innings,
            changedRoles: rolesChanged,
            currentPlayers: {
                striker: populatedMatch[innings].currentStriker,
                nonStriker: populatedMatch[innings].currentNonStriker,
                bowler: populatedMatch[innings].currentBowler,
                keeper: populatedMatch[innings].currentKeeper
            },
            overInfo: {
                currentOver: Math.floor(populatedMatch[innings].overs),
                currentBall: (populatedMatch[innings].overs % 1) * 10
            },
            playerReplacements: latestReplacements.length > 0 ? {
                replacements: latestReplacements,
                reason: replacementReason,
                description: reasonDescription
            } : null
        });

        return res.status(200).json({
            status: true,
            message: 'Current players updated successfully',
            data: match,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating current players:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Add ball-by-ball scoring
 */
export const addBall = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const {
            innings,
            overNumber,
            ballNumber,
            runs,
            isWicket,
            wicketType,
            playerOut,
            commentary,
            striker,
            bowler,
            ballType,          // regular, wide, noball, legbye, bye
            extraRuns,         // Additional runs for extras
            isBoundary,        // Whether the ball was a boundary (4 or 6)
            isOver,            // Whether this is the last ball of the over
            // New quick options
            catchMissed,       // Boolean: Whether a catch was missed
            fielder,           // ObjectId: Player who fielded the ball (for run saved/missed)
            runSaved,          // Number: Runs saved by good fielding
            runMissed,         // Number: Runs missed due to poor fielding
            bonusRuns,         // Number: Additional bonus runs
            isNegativeRuns,    // Boolean: Whether runs should be counted as negative (for corrections)
            fieldingHighlight  // String: Description of fielding highlight
        } = req.body;

        // Validate input
        if (!innings || !['firstInnings', 'secondInnings'].includes(innings)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Valid innings (firstInnings or secondInnings) is required',
                data: null
            });
        }

        if (overNumber === undefined || ballNumber === undefined || runs === undefined || !commentary) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Over number, ball number, runs, and commentary are required',
                data: null
            });
        }

        if (isWicket && !wicketType) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Wicket type is required when recording a wicket',
                data: null
            });
        }

        if (isWicket && !playerOut) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Player out ID is required when recording a wicket',
                data: null
            });
        }

        if (!striker || !bowler) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Striker and bowler information is required',
                data: null
            });
        }

        // Find match
        const match = await Match.findById(matchId)
            .populate('tournament', 'ballType')
            .session(session);

        if (!match) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Calculate total runs (including extras and applying negative runs if needed)
        let totalRuns = runs + (extraRuns || 0) + (bonusRuns || 0);
        if (isNegativeRuns) {
            totalRuns = -Math.abs(totalRuns);
        }

        // Add ball to the innings
        const ball = {
            overNumber,
            ballNumber,
            runs: totalRuns,
            isWicket,
            wicketType,
            playerOut,
            commentary,
            timestamp: new Date(),
            striker,
            bowler,
            ballType: ballType || 'regular',
            isBoundary: isBoundary || (runs === 4 || runs === 6),
            isExtra: ballType && ballType !== 'regular',
            // Add new fielding related information
            catchMissed: catchMissed || false,
            fielder: fielder || null,
            runSaved: runSaved || 0,
            runMissed: runMissed || 0,
            bonusRuns: bonusRuns || 0,
            isNegativeRuns: isNegativeRuns || false,
            fieldingHighlight: fieldingHighlight || null,
            isOver
        };

        match[innings].balls.push(ball);

        // Update innings statistics
        match[innings].totalRuns += totalRuns;
        if (isWicket) {
            match[innings].wickets += 1;
        }

        // Calculate overs - handle extras that don't count as balls (wide, noball)
        let legalDeliveries = match[innings].balls.filter(b =>
            b.ballType === 'regular' || b.ballType === 'legbye' || b.ballType === 'bye').length;

        const currentOvers = Math.floor(legalDeliveries / 6) + (legalDeliveries % 6) / 10;
        match[innings].overs = currentOvers;

        // Check if innings is complete
        const tournament = await Tournament.findById(match.tournament).session(session);
        if (tournament) {
            const maxOvers = tournament.oversPerInnings;
            if (currentOvers >= maxOvers || match[innings].wickets >= 10) {
                match[innings].isComplete = true;
            }

            // Check if this is the final over (only broadcast once when entering final over)
            if (Math.floor(currentOvers) === maxOvers - 1 &&
                Math.floor(match[innings].overs) < Math.floor(currentOvers)) {
                // We've just entered the final over
                match[innings].isFinalOver = true;
            }
        }

        // Update player statistics for this ball
        const cricketBallType = match.tournament.ballType; // white, red, pink

        // Update striker's statistics if it's not a wide
        if (ballType !== 'wide' && striker) {
            const playerStats = await PlayerStats.findOne({ player: striker, team: match[innings].battingTeam })
                .session(session);

            if (!playerStats) {
                // Create new player stats if not exists
                const newPlayerStats = new PlayerStats({
                    player: striker,
                    team: match[innings].battingTeam,
                    totalMatches: 1,
                    careerStats: {
                        [cricketBallType]: {
                            batting: {
                                matches: 1,
                                innings: 1,
                                runs: runs,
                                balls: 1,
                                fours: runs === 4 ? 1 : 0,
                                sixes: runs === 6 ? 1 : 0,
                                highestScore: runs
                            },
                            bowling: {
                                matches: 0,
                                innings: 0,
                                wickets: 0,
                                overs: 0,
                                runs: 0
                            }
                        }
                    },
                    matchesPlayed: [{
                        match: matchId,
                        ballType: cricketBallType,
                        battingInnings: [{
                            runs: runs,
                            balls: 1,
                            fours: runs === 4 ? 1 : 0,
                            sixes: runs === 6 ? 1 : 0
                        }]
                    }]
                });
                await newPlayerStats.save({ session });
            } else {
                // Update existing player stats
                playerStats.careerStats[cricketBallType].batting.runs += runs;
                playerStats.careerStats[cricketBallType].batting.balls += 1;

                if (runs === 4) {
                    playerStats.careerStats[cricketBallType].batting.fours += 1;
                }
                if (runs === 6) {
                    playerStats.careerStats[cricketBallType].batting.sixes += 1;
                }

                // Update highest score if applicable
                if (runs > playerStats.careerStats[cricketBallType].batting.highestScore) {
                    playerStats.careerStats[cricketBallType].batting.highestScore = runs;
                }

                // Calculate strike rate
                const totalRuns = playerStats.careerStats[cricketBallType].batting.runs;
                const totalBalls = playerStats.careerStats[cricketBallType].batting.balls;
                playerStats.careerStats[cricketBallType].batting.strikeRate =
                    (totalRuns / totalBalls) * 100;

                // Add to match record
                const matchRecord = playerStats.matchesPlayed.find(m =>
                    m.match.toString() === matchId.toString());

                if (matchRecord) {
                    if (matchRecord.battingInnings.length > 0) {
                        matchRecord.battingInnings[0].runs += runs;
                        matchRecord.battingInnings[0].balls += 1;
                        if (runs === 4) matchRecord.battingInnings[0].fours += 1;
                        if (runs === 6) matchRecord.battingInnings[0].sixes += 1;
                    } else {
                        matchRecord.battingInnings.push({
                            runs: runs,
                            balls: 1,
                            fours: runs === 4 ? 1 : 0,
                            sixes: runs === 6 ? 1 : 0
                        });
                    }
                } else {
                    playerStats.matchesPlayed.push({
                        match: matchId,
                        ballType: cricketBallType,
                        battingInnings: [{
                            runs: runs,
                            balls: 1,
                            fours: runs === 4 ? 1 : 0,
                            sixes: runs === 6 ? 1 : 0
                        }]
                    });
                }

                await playerStats.save({ session });
            }
        }

        // Update bowler's statistics
        if (bowler) {
            const playerStats = await PlayerStats.findOne({ player: bowler, team: match[innings].bowlingTeam })
                .session(session);

            if (!playerStats) {
                // Create new player stats if not exists
                const newPlayerStats = new PlayerStats({
                    player: bowler,
                    team: match[innings].bowlingTeam,
                    totalMatches: 1,
                    careerStats: {
                        [cricketBallType]: {
                            batting: {
                                matches: 0,
                                innings: 0,
                                runs: 0,
                                balls: 0
                            },
                            bowling: {
                                matches: 1,
                                innings: 1,
                                wickets: isWicket ? 1 : 0,
                                overs: ballType === 'regular' ? 0.1 : 0,
                                runs: totalRuns,
                                economy: totalRuns / 0.1,
                                bestBowling: isWicket ? { wickets: 1, runs: totalRuns } : { wickets: 0, runs: 0 }
                            }
                        }
                    },
                    matchesPlayed: [{
                        match: matchId,
                        ballType: cricketBallType,
                        bowlingInnings: [{
                            overs: ballType === 'regular' ? 0.1 : 0,
                            runs: totalRuns,
                            wickets: isWicket ? 1 : 0
                        }]
                    }]
                });
                await newPlayerStats.save({ session });
            } else {
                // Update existing player stats - only count regular deliveries for overs
                if (ballType === 'regular') {
                    playerStats.careerStats[cricketBallType].bowling.overs += 0.1;
                }

                playerStats.careerStats[cricketBallType].bowling.runs += totalRuns;

                if (isWicket) {
                    playerStats.careerStats[cricketBallType].bowling.wickets += 1;

                    // Update best bowling
                    const currentWickets = playerStats.careerStats[cricketBallType].bowling.wickets;
                    const currentBest = playerStats.careerStats[cricketBallType].bowling.bestBowling;

                    if (currentWickets > currentBest.wickets ||
                        (currentWickets === currentBest.wickets &&
                            totalRuns < currentBest.runs)) {
                        playerStats.careerStats[cricketBallType].bowling.bestBowling = {
                            wickets: currentWickets,
                            runs: totalRuns
                        };
                    }

                    // Update five-wicket and ten-wicket hauls
                    if (currentWickets >= 10) {
                        playerStats.careerStats[cricketBallType].bowling.tenWickets =
                            Math.floor(currentWickets / 10);
                    }
                    if (currentWickets >= 5) {
                        playerStats.careerStats[cricketBallType].bowling.fiveWickets =
                            Math.floor(currentWickets / 5);
                    }
                }

                // Calculate economy rate
                const totalOvers = playerStats.careerStats[cricketBallType].bowling.overs;
                const totalRunsConceded = playerStats.careerStats[cricketBallType].bowling.runs;
                playerStats.careerStats[cricketBallType].bowling.economy =
                    totalRunsConceded / totalOvers;

                // Calculate bowling average
                const totalWickets = playerStats.careerStats[cricketBallType].bowling.wickets;
                if (totalWickets > 0) {
                    playerStats.careerStats[cricketBallType].bowling.average =
                        totalRunsConceded / totalWickets;
                }

                // Add to match record
                const matchRecord = playerStats.matchesPlayed.find(m =>
                    m.match.toString() === matchId.toString());

                if (matchRecord) {
                    if (matchRecord.bowlingInnings.length > 0) {
                        if (ballType === 'regular') {
                            matchRecord.bowlingInnings[0].overs += 0.1;
                        }
                        matchRecord.bowlingInnings[0].runs += totalRuns;
                        if (isWicket) matchRecord.bowlingInnings[0].wickets += 1;
                    } else {
                        matchRecord.bowlingInnings.push({
                            overs: ballType === 'regular' ? 0.1 : 0,
                            runs: totalRuns,
                            wickets: isWicket ? 1 : 0
                        });
                    }
                } else {
                    playerStats.matchesPlayed.push({
                        match: matchId,
                        ballType: cricketBallType,
                        bowlingInnings: [{
                            overs: ballType === 'regular' ? 0.1 : 0,
                            runs: totalRuns,
                            wickets: isWicket ? 1 : 0
                        }]
                    });
                }

                await playerStats.save({ session });
            }
        }

        // Update fielder's statistics if applicable
        if (fielder && (runSaved > 0 || catchMissed)) {
            const playerStats = await PlayerStats.findOne({ player: fielder, team: match[innings].bowlingTeam })
                .session(session);

            if (playerStats) {
                // Initialize fielding stats if not present
                if (!playerStats.careerStats[cricketBallType].fielding) {
                    playerStats.careerStats[cricketBallType].fielding = {
                        catches: 0,
                        runsSaved: 0,
                        catchesMissed: 0,
                        runsMissed: 0
                    };
                }

                // Update fielding stats
                if (runSaved > 0) {
                    playerStats.careerStats[cricketBallType].fielding.runsSaved += runSaved;
                }

                if (runMissed > 0) {
                    playerStats.careerStats[cricketBallType].fielding.runsMissed += runMissed;
                }

                if (catchMissed) {
                    playerStats.careerStats[cricketBallType].fielding.catchesMissed += 1;
                }

                await playerStats.save({ session });
            }
        }

        await match.save({ session });

        // Populate all references before sending the response
        const populatedMatch = await Match.findById(matchId)
            .populate('tournament', 'tournamentId seriesName tournamentType matchType ballType pitchType oversPerInnings oversPerBowler')
            .populate({
                path: 'teamA',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate({
                path: 'teamB',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate('venue', 'name city address1')
            .populate('umpires', 'name email mobile')
            .populate('firstInnings.currentStriker', 'name avatar mobile email')
            .populate('firstInnings.currentNonStriker', 'name avatar mobile email')
            .populate('firstInnings.currentBowler', 'name avatar mobile email')
            .populate('firstInnings.currentKeeper', 'name avatar mobile email')
            .populate('firstInnings.battingTeam', 'teamName logo')
            .populate('firstInnings.bowlingTeam', 'teamName logo')
            .populate('secondInnings.currentStriker', 'name avatar mobile email')
            .populate('secondInnings.currentNonStriker', 'name avatar mobile email')
            .populate('secondInnings.currentBowler', 'name avatar mobile email')
            .populate('secondInnings.currentKeeper', 'name avatar mobile email')
            .populate('secondInnings.battingTeam', 'teamName logo')
            .populate('secondInnings.bowlingTeam', 'teamName logo')
            .populate('tossWinner', 'teamName logo');

        await session.commitTransaction();
        session.endSession();

        // Determine if this is a special event (boundary, wicket, or fielding highlight)
        let specialEventType = null;
        if (ball.isWicket) {
            specialEventType = 'WICKET';
        } else if (ball.isBoundary) {
            specialEventType = runs === 6 ? 'SIX' : 'FOUR';
        } else if (ballType && ballType !== 'regular') {
            specialEventType = ballType.toUpperCase(); // 'WIDE', 'NOBALL', etc.
        } else if (catchMissed) {
            specialEventType = 'CATCH_MISSED';
        } else if (runSaved > 0) {
            specialEventType = 'RUN_SAVED';
        } else if (runMissed > 0) {
            specialEventType = 'RUN_MISSED';
        } else if (bonusRuns > 0) {
            specialEventType = 'BONUS_RUNS';
        } else if (isNegativeRuns) {
            specialEventType = 'NEGATIVE_RUNS';
        }

        // Get details of the players involved for better context
        const strikerDetails = await User.findById(ball.striker, 'name avatar').lean();
        const bowlerDetails = await User.findById(ball.bowler, 'name avatar').lean();
        const playerOutDetails = ball.playerOut ? await User.findById(ball.playerOut, 'name avatar').lean() : null;
        const fielderDetails = ball.fielder ? await User.findById(ball.fielder, 'name avatar').lean() : null;

        // Calculate batting team's current score for display
        const currentScore = {
            runs: match[innings].totalRuns,
            wickets: match[innings].wickets,
            overs: match[innings].overs
        };

        // Build special event details based on event type
        let specialEventDetails = null;
        if (specialEventType === 'WICKET') {
            specialEventDetails = {
                wicketType,
                batsmanOut: playerOutDetails || strikerDetails,
                bowler: bowlerDetails
            };
        } else if (specialEventType === 'FOUR' || specialEventType === 'SIX') {
            specialEventDetails = {
                boundary: runs,
                batsman: strikerDetails
            };
        } else if (specialEventType === 'CATCH_MISSED') {
            specialEventDetails = {
                batsman: strikerDetails,
                fielder: fielderDetails,
                description: fieldingHighlight || "Catch missed"
            };
        } else if (specialEventType === 'RUN_SAVED') {
            specialEventDetails = {
                batsman: strikerDetails,
                fielder: fielderDetails,
                runsSaved: runSaved,
                description: fieldingHighlight || "Good fielding"
            };
        } else if (specialEventType === 'RUN_MISSED') {
            specialEventDetails = {
                batsman: strikerDetails,
                fielder: fielderDetails,
                runsMissed: runMissed,
                description: fieldingHighlight || "Missed fielding opportunity"
            };
        } else if (specialEventType === 'BONUS_RUNS') {
            specialEventDetails = {
                batsman: strikerDetails,
                bonusRuns: bonusRuns,
                description: fieldingHighlight || "Bonus runs awarded"
            };
        } else if (specialEventType === 'NEGATIVE_RUNS') {
            specialEventDetails = {
                batsman: strikerDetails,
                runs: totalRuns,
                description: fieldingHighlight || "Runs deducted"
            };
        } else if (specialEventType === 'WIDE' || specialEventType === 'NOBALL') {
            specialEventDetails = {
                extraType: ballType,
                runs: extraRuns || 0
            };
        }

        // Check if an over has completed
        const isOverComplete = ballType === 'regular' && ballNumber === 6;

        // Broadcast the ball update to all users in the match room
        broadcastMatchEvent(matchId, 'BALL_ADDED', {
            matchId,
            innings,
            ball: {
                ...ball,
                striker: strikerDetails || ball.striker,
                bowler: bowlerDetails || ball.bowler,
                playerOut: playerOutDetails || ball.playerOut,
                fielder: fielderDetails || ball.fielder
            },
            match: {
                id: matchId,
                [innings]: currentScore
            },
            specialEvent: specialEventType ? {
                type: specialEventType,
                details: specialEventDetails
            } : null,
            isOverComplete,
            overNumber,
            ballNumber,
            commentary,
            timestamp: new Date()
        });

        // Log with more context
        let eventDesc = runs + " runs";
        if (specialEventType) {
            if (specialEventType === 'WICKET') {
                eventDesc = `WICKET (${wicketType})`;
            } else if (specialEventType === 'FOUR' || specialEventType === 'SIX') {
                eventDesc = `${specialEventType} (${runs} runs by ${strikerDetails?.name || 'Unknown'})`;
            } else if (specialEventType === 'CATCH_MISSED') {
                eventDesc = `Catch missed by ${fielderDetails?.name || 'Unknown'}`;
            } else if (specialEventType === 'RUN_SAVED') {
                eventDesc = `${runSaved} runs saved by ${fielderDetails?.name || 'Unknown'}`;
            } else if (specialEventType === 'RUN_MISSED') {
                eventDesc = `${runMissed} runs missed by ${fielderDetails?.name || 'Unknown'}`;
            } else if (specialEventType === 'BONUS_RUNS') {
                eventDesc = `${bonusRuns} bonus runs`;
            } else if (specialEventType === 'NEGATIVE_RUNS') {
                eventDesc = `${Math.abs(totalRuns)} negative runs`;
            } else {
                eventDesc = `${specialEventType} (${runs} runs)`;
            }
        }
        console.log(`Ball update [${eventDesc}] broadcast to match:${matchId}`);

        // If over completed, send a separate over complete event
        if (isOverComplete) {
            // Calculate this over's runs and wickets
            const thisOverBalls = match[innings].balls.filter(b =>
                b.overNumber === overNumber
            );
            const overRuns = thisOverBalls.reduce((sum, b) => sum + b.runs, 0);
            const overWickets = thisOverBalls.filter(b => b.isWicket).length;

            broadcastMatchEvent(matchId, 'OVER_COMPLETE', {
                matchId,
                innings,
                overNumber,
                overSummary: {
                    runs: overRuns,
                    wickets: overWickets,
                    boundaries: thisOverBalls.filter(b => b.isBoundary).length,
                    extras: thisOverBalls.filter(b => b.isExtra).length
                },
                currentScore,
                timestamp: new Date()
            });
            console.log(`Over complete [#${overNumber}, ${overRuns}/${overWickets}] broadcast to match:${matchId}`);
        }

        // If innings is complete, send an innings complete event
        if (match[innings].isComplete) {
            broadcastMatchEvent(matchId, 'INNINGS_COMPLETE', {
                matchId,
                innings,
                inningsSummary: {
                    totalRuns: match[innings].totalRuns,
                    wickets: match[innings].wickets,
                    overs: match[innings].overs,
                    battingTeam: match[innings].battingTeam,
                    bowlingTeam: match[innings].bowlingTeam
                },
                timestamp: new Date()
            });
            console.log(`Innings complete [${innings}] broadcast to match:${matchId}`);
        }

        // If this is the final over, broadcast a special notification
        if (match[innings].isFinalOver) {
            const tournament = await Tournament.findById(match.tournament).lean();
            if (tournament) {
                const maxOvers = tournament.oversPerInnings;
                broadcastMatchEvent(matchId, 'FINAL_OVER', {
                    matchId,
                    innings,
                    currentScore: {
                        runs: match[innings].totalRuns,
                        wickets: match[innings].wickets,
                        overs: match[innings].overs
                    },
                    maxOvers,
                    ballsRemaining: 6 - (Math.round((match[innings].overs % 1) * 10)),
                    message: `Final over of the ${innings === 'firstInnings' ? 'first' : 'second'} innings!`
                }, `Final over notification broadcast to match:${matchId}`);
            }
        }

        return res.status(200).json({
            status: true,
            message: 'Ball added successfully',
            data: populatedMatch
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error('Error adding ball:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get match highlights/commentary
 */
export const getMatchHighlights = async (req, res) => {
    try {
        const { matchId } = req.params;

        const match = await Match.findById(matchId)
            .populate('tournament', 'tournamentId seriesName tournamentType')
            .populate({
                path: 'teamA',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: 'name avatar mobile email'
                }
            })
            .populate({
                path: 'teamB',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: 'name avatar mobile email'
                }
            })
            .populate('firstInnings.currentStriker', 'name avatar')
            .populate('firstInnings.currentNonStriker', 'name avatar')
            .populate('firstInnings.currentBowler', 'name avatar')
            .populate('firstInnings.battingTeam', 'teamName logo')
            .populate('firstInnings.bowlingTeam', 'teamName logo')
            .populate('secondInnings.currentStriker', 'name avatar')
            .populate('secondInnings.currentNonStriker', 'name avatar')
            .populate('secondInnings.currentBowler', 'name avatar')
            .populate('secondInnings.battingTeam', 'teamName logo')
            .populate('secondInnings.bowlingTeam', 'teamName logo')
            .populate('tossWinner', 'teamName');

        if (!match) {
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Populate players in the balls array for both innings
        await Match.populate(match, [
            {
                path: 'firstInnings.balls.striker',
                select: 'name avatar'
            },
            {
                path: 'firstInnings.balls.bowler',
                select: 'name avatar'
            },
            {
                path: 'firstInnings.balls.playerOut',
                select: 'name avatar'
            },
            {
                path: 'secondInnings.balls.striker',
                select: 'name avatar'
            },
            {
                path: 'secondInnings.balls.bowler',
                select: 'name avatar'
            },
            {
                path: 'secondInnings.balls.playerOut',
                select: 'name avatar'
            }
        ]);

        // Calculate batting statistics for each player
        const firstInningsBattingStats = await calculateBattingStats(match.firstInnings);
        const secondInningsBattingStats = await calculateBattingStats(match.secondInnings);

        // Calculate fall of wickets
        const firstInningsFow = await calculateFallOfWickets(match.firstInnings);
        const secondInningsFow = await calculateFallOfWickets(match.secondInnings);

        // Calculate partnerships
        const firstInningsPartnerships = await calculatePartnerships(match.firstInnings);
        const secondInningsPartnerships = await calculatePartnerships(match.secondInnings);

        // Format highlights
        const highlights = {
            matchStatus: match.status,
            tossWinner: match.tossWinner,
            tossDecision: match.tossDecision,
            firstInnings: {
                battingTeam: match.firstInnings.battingTeam,
                bowlingTeam: match.firstInnings.bowlingTeam,
                totalRuns: match.firstInnings.totalRuns,
                wickets: match.firstInnings.wickets,
                overs: match.firstInnings.overs,
                isComplete: match.firstInnings.isComplete,
                currentStriker: match.firstInnings.currentStriker,
                currentNonStriker: match.firstInnings.currentNonStriker,
                currentBowler: match.firstInnings.currentBowler,
                battingStats: firstInningsBattingStats,
                fallOfWickets: firstInningsFow,
                partnerships: firstInningsPartnerships,
                balls: match.firstInnings.balls
            },
            secondInnings: {
                battingTeam: match.secondInnings.battingTeam,
                bowlingTeam: match.secondInnings.bowlingTeam,
                totalRuns: match.secondInnings.totalRuns,
                wickets: match.secondInnings.wickets,
                overs: match.secondInnings.overs,
                isComplete: match.secondInnings.isComplete,
                currentStriker: match.secondInnings.currentStriker,
                currentNonStriker: match.secondInnings.currentNonStriker,
                currentBowler: match.secondInnings.currentBowler,
                battingStats: secondInningsBattingStats,
                fallOfWickets: secondInningsFow,
                partnerships: secondInningsPartnerships,
                balls: match.secondInnings.balls
            },
            result: match.result,
            teamA: {
                details: match.teamA,
                battingStats: match.firstInnings.battingTeam && match.firstInnings.battingTeam._id.toString() === match.teamA._id.toString()
                    ? firstInningsBattingStats
                    : secondInningsBattingStats
            },
            teamB: {
                details: match.teamB,
                battingStats: match.firstInnings.battingTeam && match.firstInnings.battingTeam._id.toString() === match.teamB._id.toString()
                    ? firstInningsBattingStats
                    : secondInningsBattingStats
            }
        };

        return res.status(200).json({
            status: true,
            message: 'Match highlights fetched successfully',
            data: highlights
        });
    } catch (error) {
        console.error('Error fetching match highlights:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Helper function to calculate batting statistics for players in an innings
 */
const calculateBattingStats = async (innings) => {
    if (!innings || !innings.balls || innings.balls.length === 0) {
        return [];
    }

    const playerStats = {};
    const playerMap = new Map();

    // Process each ball to calculate batting statistics
    for (const ball of innings.balls) {
        if (!ball.striker) continue;

        const strikerId = ball.striker._id ? ball.striker._id.toString() : ball.striker.toString();

        // Store player details for later use
        if (ball.striker._id && ball.striker.name) {
            playerMap.set(strikerId, {
                _id: ball.striker._id,
                name: ball.striker.name,
                avatar: ball.striker.avatar
            });
        }

        // Initialize player stats if not exists
        if (!playerStats[strikerId]) {
            playerStats[strikerId] = {
                playerId: strikerId,
                playerDetails: playerMap.get(strikerId) || { _id: strikerId },
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                isOut: false,
                wicketType: null,
                outAt: null,
                strikeRate: 0
            };
        }

        // Update player stats
        if (ball.ballType !== 'wide') {
            playerStats[strikerId].balls += 1;
        }

        playerStats[strikerId].runs += ball.runs;

        if (ball.runs === 4) {
            playerStats[strikerId].fours += 1;
        }

        if (ball.runs === 6) {
            playerStats[strikerId].sixes += 1;
        }

        // Check if player was dismissed
        if (ball.isWicket && ball.playerOut) {
            const outPlayerId = ball.playerOut._id ? ball.playerOut._id.toString() : ball.playerOut.toString();

            // Store player out details
            if (ball.playerOut._id && ball.playerOut.name) {
                playerMap.set(outPlayerId, {
                    _id: ball.playerOut._id,
                    name: ball.playerOut.name,
                    avatar: ball.playerOut.avatar
                });
            }

            if (playerStats[outPlayerId]) {
                playerStats[outPlayerId].isOut = true;
                playerStats[outPlayerId].wicketType = ball.wicketType;
                playerStats[outPlayerId].outAt = {
                    overNumber: ball.overNumber,
                    ballNumber: ball.ballNumber,
                    score: innings.totalRuns,
                    timestamp: ball.timestamp
                };
            } else if (outPlayerId !== strikerId) {
                // Handle case where playerOut is not striker (e.g., run out of non-striker)
                playerStats[outPlayerId] = {
                    playerId: outPlayerId,
                    playerDetails: playerMap.get(outPlayerId) || { _id: outPlayerId },
                    runs: 0,
                    balls: 0,
                    fours: 0,
                    sixes: 0,
                    isOut: true,
                    wicketType: ball.wicketType,
                    outAt: {
                        overNumber: ball.overNumber,
                        ballNumber: ball.ballNumber,
                        score: innings.totalRuns,
                        timestamp: ball.timestamp
                    },
                    strikeRate: 0
                };
            }
        }
    }

    // Calculate strike rate for each player
    Object.values(playerStats).forEach(stats => {
        stats.strikeRate = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(2) : 0;
    });

    // Convert to array and sort by batting order
    return Object.values(playerStats);
};

/**
 * Helper function to calculate fall of wickets
 */
const calculateFallOfWickets = async (innings) => {
    if (!innings || !innings.balls || innings.balls.length === 0) {
        return [];
    }

    const fallOfWickets = [];

    for (const ball of innings.balls) {
        if (ball.isWicket && ball.playerOut) {
            const playerDetails = ball.playerOut._id ? {
                _id: ball.playerOut._id,
                name: ball.playerOut.name,
                avatar: ball.playerOut.avatar
            } : ball.playerOut;

            fallOfWickets.push({
                playerOut: playerDetails,
                wicketType: ball.wicketType,
                overNumber: ball.overNumber,
                ballNumber: ball.ballNumber,
                score: innings.totalRuns,
                wicketNumber: fallOfWickets.length + 1,
                timestamp: ball.timestamp
            });
        }
    }

    return fallOfWickets;
};

/**
 * Helper function to calculate partnerships
 */
const calculatePartnerships = async (innings) => {
    if (!innings || !innings.balls || innings.balls.length === 0) {
        return [];
    }

    const partnerships = [];
    let currentPartnership = {
        batsmanA: null,
        batsmanADetails: null,
        batsmanB: null,
        batsmanBDetails: null,
        runs: 0,
        balls: 0,
        startOverNumber: 0,
        startBallNumber: 0,
        endOverNumber: null,
        endBallNumber: null
    };

    // Map to store player details
    const playerDetailsMap = new Map();

    innings.balls.forEach((ball, index) => {
        // Skip the ball if it doesn't have all required fields
        if (!ball.striker) return;

        const striker = ball.striker._id ? ball.striker._id.toString() : ball.striker.toString();

        // Store player details
        if (ball.striker._id && ball.striker.name) {
            playerDetailsMap.set(striker, {
                _id: ball.striker._id,
                name: ball.striker.name,
                avatar: ball.striker.avatar
            });
        }

        // Determine non-striker based on context
        let nonStriker = null;
        let nonStrikerDetails = null;
        if (index > 0) {
            const prevBall = innings.balls[index - 1];
            // Non-striker is the striker from previous ball if they're different players
            if (prevBall && prevBall.striker && prevBall.striker._id &&
                prevBall.striker._id.toString() !== striker) {
                nonStriker = prevBall.striker._id.toString();
                nonStrikerDetails = {
                    _id: prevBall.striker._id,
                    name: prevBall.striker.name,
                    avatar: prevBall.striker.avatar
                };
                playerDetailsMap.set(nonStriker, nonStrikerDetails);
            }
        }

        // Initialize new partnership if necessary
        if (!currentPartnership.batsmanA) {
            currentPartnership.batsmanA = striker;
            currentPartnership.batsmanADetails = playerDetailsMap.get(striker);
            currentPartnership.startOverNumber = ball.overNumber;
            currentPartnership.startBallNumber = ball.ballNumber;
        } else if (!currentPartnership.batsmanB && nonStriker) {
            currentPartnership.batsmanB = nonStriker;
            currentPartnership.batsmanBDetails = nonStrikerDetails;
        }

        // Update partnership stats
        if (ball.ballType !== 'wide') {
            currentPartnership.balls += 1;
        }
        currentPartnership.runs += ball.runs;

        // Check if this ball ended a partnership (wicket)
        if (ball.isWicket && ball.playerOut) {
            const outPlayer = ball.playerOut._id ? ball.playerOut._id.toString() : ball.playerOut.toString();

            // Store player out details
            if (ball.playerOut._id && ball.playerOut.name) {
                playerDetailsMap.set(outPlayer, {
                    _id: ball.playerOut._id,
                    name: ball.playerOut.name,
                    avatar: ball.playerOut.avatar
                });
            }

            // Only end the partnership if one of the batsmen is out
            if (outPlayer === currentPartnership.batsmanA || outPlayer === currentPartnership.batsmanB) {
                // Record end of partnership
                currentPartnership.endOverNumber = ball.overNumber;
                currentPartnership.endBallNumber = ball.ballNumber;

                // Save completed partnership and start a new one
                if (currentPartnership.batsmanA && currentPartnership.batsmanB) {
                    partnerships.push({ ...currentPartnership });
                }

                // Start new partnership
                const continuingBatsman = outPlayer === currentPartnership.batsmanA ?
                    currentPartnership.batsmanB : currentPartnership.batsmanA;
                const continuingBatsmanDetails = outPlayer === currentPartnership.batsmanA ?
                    currentPartnership.batsmanBDetails : currentPartnership.batsmanADetails;

                currentPartnership = {
                    batsmanA: continuingBatsman,
                    batsmanADetails: continuingBatsmanDetails,
                    batsmanB: null,
                    batsmanBDetails: null,
                    runs: 0,
                    balls: 0,
                    startOverNumber: ball.overNumber,
                    startBallNumber: ball.ballNumber,
                    endOverNumber: null,
                    endBallNumber: null
                };
            }
        }
    });

    // Add the final partnership if it exists and hasn't been added
    if (currentPartnership.batsmanA && currentPartnership.batsmanB && currentPartnership.runs > 0) {
        partnerships.push(currentPartnership);
    }

    return partnerships;
};

/**
 * Get matches where the authenticated user is an umpire
 */
export const getMyUmpireMatches = async (req, res) => {
    try {
        const userId = req.user._id;

        const matches = await Match.find({ umpires: userId })
            .populate('tournament', 'tournamentId seriesName tournamentType')
            .populate('teamA', 'teamName logo')
            .populate('teamB', 'teamName logo')
            .populate('venue', 'name city address1')
            .sort({ matchDate: 1 });

        return res.status(200).json({
            status: true,
            message: 'Umpire matches fetched successfully',
            data: matches
        });
    } catch (error) {
        console.error('Error fetching umpire matches:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Undo the last ball added to a match
 * @access Private - Only umpires can undo balls
 */
export const undoBall = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const { innings } = req.body;

        // Validate input
        if (!innings || !['firstInnings', 'secondInnings'].includes(innings)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Valid innings (firstInnings or secondInnings) is required',
                data: null
            });
        }

        // Find match
        const match = await Match.findById(matchId)
            .populate('tournament', 'ballType')
            .session(session);

        if (!match) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Check if there are balls to undo
        if (!match[innings].balls || match[innings].balls.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'No balls to undo',
                data: null
            });
        }

        // Get the last ball
        const lastBall = match[innings].balls.pop();

        // Update innings statistics
        match[innings].totalRuns -= lastBall.runs;
        if (lastBall.isWicket) {
            match[innings].wickets -= 1;
        }

        // Recalculate overs
        let legalDeliveries = match[innings].balls.filter(b =>
            b.ballType === 'regular' || b.ballType === 'legbye' || b.ballType === 'bye').length;

        const currentOvers = Math.floor(legalDeliveries / 6) + (legalDeliveries % 6) / 10;
        match[innings].overs = currentOvers;

        // Check if innings is complete
        const tournament = await Tournament.findById(match.tournament).session(session);
        if (tournament) {
            const maxOvers = tournament.oversPerInnings;
            if (currentOvers >= maxOvers || match[innings].wickets >= 10) {
                match[innings].isComplete = true;
            } else {
                match[innings].isComplete = false;
            }
        }

        // Update player statistics for this ball
        const cricketBallType = match.tournament.ballType; // white, red, pink

        // Update striker's statistics if it's not a wide
        if (lastBall.ballType !== 'wide' && lastBall.striker) {
            const playerStats = await PlayerStats.findOne({
                player: lastBall.striker,
                team: match[innings].battingTeam
            }).session(session);

            if (playerStats) {
                // Update existing player stats
                playerStats.careerStats[cricketBallType].batting.runs -= lastBall.runs;
                playerStats.careerStats[cricketBallType].batting.balls -= 1;

                if (lastBall.runs === 4) {
                    playerStats.careerStats[cricketBallType].batting.fours -= 1;
                }
                if (lastBall.runs === 6) {
                    playerStats.careerStats[cricketBallType].batting.sixes -= 1;
                }

                // Recalculate strike rate
                const totalRuns = playerStats.careerStats[cricketBallType].batting.runs;
                const totalBalls = playerStats.careerStats[cricketBallType].batting.balls;
                playerStats.careerStats[cricketBallType].batting.strikeRate =
                    totalBalls > 0 ? (totalRuns / totalBalls) * 100 : 0;

                // Update match record
                const matchRecord = playerStats.matchesPlayed.find(m =>
                    m.match.toString() === matchId.toString());

                if (matchRecord && matchRecord.battingInnings.length > 0) {
                    matchRecord.battingInnings[0].runs -= lastBall.runs;
                    matchRecord.battingInnings[0].balls -= 1;
                    if (lastBall.runs === 4) matchRecord.battingInnings[0].fours -= 1;
                    if (lastBall.runs === 6) matchRecord.battingInnings[0].sixes -= 1;
                }

                await playerStats.save({ session });
            }
        }

        // Update bowler's statistics
        if (lastBall.bowler) {
            const playerStats = await PlayerStats.findOne({
                player: lastBall.bowler,
                team: match[innings].bowlingTeam
            }).session(session);

            if (playerStats) {
                // Update existing player stats - only count regular deliveries for overs
                if (lastBall.ballType === 'regular') {
                    playerStats.careerStats[cricketBallType].bowling.overs -= 0.1;
                }

                playerStats.careerStats[cricketBallType].bowling.runs -= lastBall.runs;

                if (lastBall.isWicket) {
                    playerStats.careerStats[cricketBallType].bowling.wickets -= 1;

                    // Recalculate five-wicket and ten-wicket hauls
                    const currentWickets = playerStats.careerStats[cricketBallType].bowling.wickets;
                    if (currentWickets < 10) {
                        playerStats.careerStats[cricketBallType].bowling.tenWickets = 0;
                    } else {
                        playerStats.careerStats[cricketBallType].bowling.tenWickets =
                            Math.floor(currentWickets / 10);
                    }
                    if (currentWickets < 5) {
                        playerStats.careerStats[cricketBallType].bowling.fiveWickets = 0;
                    } else {
                        playerStats.careerStats[cricketBallType].bowling.fiveWickets =
                            Math.floor(currentWickets / 5);
                    }
                }

                // Recalculate economy rate
                const totalOvers = playerStats.careerStats[cricketBallType].bowling.overs;
                const totalRunsConceded = playerStats.careerStats[cricketBallType].bowling.runs;
                playerStats.careerStats[cricketBallType].bowling.economy =
                    totalOvers > 0 ? totalRunsConceded / totalOvers : 0;

                // Recalculate bowling average
                const totalWickets = playerStats.careerStats[cricketBallType].bowling.wickets;
                if (totalWickets > 0) {
                    playerStats.careerStats[cricketBallType].bowling.average =
                        totalRunsConceded / totalWickets;
                } else {
                    playerStats.careerStats[cricketBallType].bowling.average = 0;
                }

                // Update match record
                const matchRecord = playerStats.matchesPlayed.find(m =>
                    m.match.toString() === matchId.toString());

                if (matchRecord && matchRecord.bowlingInnings.length > 0) {
                    if (lastBall.ballType === 'regular') {
                        matchRecord.bowlingInnings[0].overs -= 0.1;
                    }
                    matchRecord.bowlingInnings[0].runs -= lastBall.runs;
                    if (lastBall.isWicket) matchRecord.bowlingInnings[0].wickets -= 1;
                }

                await playerStats.save({ session });
            }
        }

        await match.save({ session });

        // Populate all references before sending the response
        const populatedMatch = await Match.findById(matchId)
            .populate('tournament', 'tournamentId seriesName tournamentType matchType ballType pitchType oversPerInnings oversPerBowler')
            .populate({
                path: 'teamA',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate({
                path: 'teamB',
                select: 'teamName logo players',
                populate: {
                    path: 'players.player',
                    select: '-password -groundAdded -clubs -isDeleted'
                }
            })
            .populate('venue', 'name city address1')
            .populate('umpires', 'name email mobile')
            .populate('firstInnings.currentStriker', 'name avatar mobile email')
            .populate('firstInnings.currentNonStriker', 'name avatar mobile email')
            .populate('firstInnings.currentBowler', 'name avatar mobile email')
            .populate('firstInnings.currentKeeper', 'name avatar mobile email')
            .populate('firstInnings.battingTeam', 'teamName logo')
            .populate('firstInnings.bowlingTeam', 'teamName logo')
            .populate('secondInnings.currentStriker', 'name avatar mobile email')
            .populate('secondInnings.currentNonStriker', 'name avatar mobile email')
            .populate('secondInnings.currentBowler', 'name avatar mobile email')
            .populate('secondInnings.currentKeeper', 'name avatar mobile email')
            .populate('secondInnings.battingTeam', 'teamName logo')
            .populate('secondInnings.bowlingTeam', 'teamName logo')
            .populate('tossWinner', 'teamName logo');

        await session.commitTransaction();
        session.endSession();

        // Determine which type of ball was undone
        let specialEventType = null;
        if (lastBall.isWicket) {
            specialEventType = 'WICKET';
        } else if (lastBall.isBoundary) {
            specialEventType = lastBall.runs === 6 ? 'SIX' : 'FOUR';
        } else if (lastBall.ballType && lastBall.ballType !== 'regular') {
            specialEventType = lastBall.ballType.toUpperCase(); // 'WIDE', 'NOBALL', etc.
        }

        // Get details of the players involved for better context
        const strikerDetails = await User.findById(lastBall.striker, 'name avatar').lean();
        const bowlerDetails = await User.findById(lastBall.bowler, 'name avatar').lean();
        const playerOutDetails = lastBall.playerOut ? await User.findById(lastBall.playerOut, 'name avatar').lean() : null;

        // Check if the undo affected an over completion
        const overComplete = lastBall.ballNumber === 6 && lastBall.ballType === 'regular';

        // Calculate batting team's current score after undo
        const currentScore = {
            runs: match[innings].totalRuns,
            wickets: match[innings].wickets,
            overs: match[innings].overs
        };

        // Create a clean version of the removed ball without circular references
        const cleanRemovedBall = {
            overNumber: lastBall.overNumber,
            ballNumber: lastBall.ballNumber,
            runs: lastBall.runs,
            isWicket: lastBall.isWicket,
            wicketType: lastBall.wicketType,
            ballType: lastBall.ballType,
            isBoundary: lastBall.isBoundary,
            timestamp: lastBall.timestamp,
            striker: strikerDetails ? {
                _id: strikerDetails._id,
                name: strikerDetails.name,
                avatar: strikerDetails.avatar
            } : null,
            bowler: bowlerDetails ? {
                _id: bowlerDetails._id,
                name: bowlerDetails.name,
                avatar: bowlerDetails.avatar
            } : null,
            playerOut: playerOutDetails ? {
                _id: playerOutDetails._id,
                name: playerOutDetails.name,
                avatar: playerOutDetails.avatar
            } : null
        };

        // Broadcast the undo ball update to all users in the match room
        broadcastMatchEvent(matchId, 'BALL_UNDONE', {
            matchId,
            innings,
            removedBall: cleanRemovedBall,
            match: {
                id: matchId,
                [innings]: currentScore
            },
            specialEvent: specialEventType ? {
                type: specialEventType,
                undone: true,
                details: specialEventType === 'WICKET' ? {
                    wicketType: lastBall.wicketType,
                    batsmanRestored: playerOutDetails ? {
                        _id: playerOutDetails._id,
                        name: playerOutDetails.name,
                        avatar: playerOutDetails.avatar
                    } : null,
                    bowler: bowlerDetails ? {
                        _id: bowlerDetails._id,
                        name: bowlerDetails.name,
                        avatar: bowlerDetails.avatar
                    } : null
                } : specialEventType === 'FOUR' || specialEventType === 'SIX' ? {
                    boundary: lastBall.runs,
                    batsman: strikerDetails ? {
                        _id: strikerDetails._id,
                        name: strikerDetails.name,
                        avatar: strikerDetails.avatar
                    } : null
                } : {
                    extraType: lastBall.ballType,
                    runs: lastBall.runs
                }
            } : null,
            overAffected: overComplete ? {
                overNumber: lastBall.overNumber,
                action: 'UNDO_COMPLETE'
            } : null,
            timestamp: new Date()
        });

        // Log with more context
        const eventDesc = specialEventType ?
            `${specialEventType} (${lastBall.runs} runs by ${strikerDetails?.name || 'Unknown'})` :
            `Regular ball (${lastBall.runs} runs)`;
        console.log(`Ball undo [${eventDesc}] broadcast to match:${matchId}`);

        // If innings status changed from complete to incomplete, notify
        if (lastBall.isWicket && match[innings].wickets === 9) {
            broadcastMatchEvent(matchId, 'INNINGS_STATUS_CHANGED', {
                matchId,
                innings,
                previousStatus: 'COMPLETE',
                currentStatus: 'IN_PROGRESS',
                currentScore,
                timestamp: new Date()
            });
            console.log(`Innings status change [COMPLETE → IN_PROGRESS] broadcast to match:${matchId}`);
        }

        return res.status(200).json({
            status: true,
            message: 'Ball undone successfully',
            data: populatedMatch
        });
    } catch (error) {
        // Check if session is still active before aborting
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error('Error undoing ball:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Helper function to broadcast match events to all connected clients
 * @param {string} matchId - ID of the match
 * @param {string} eventType - Type of event (BALL_ADDED, BALL_UNDONE, STATUS_CHANGED, etc.)
 * @param {Object} data - Event data to broadcast
 * @param {string} [logMessage] - Optional custom log message
 */
const broadcastMatchEvent = (matchId, eventType, data, logMessage) => {
    if (!global.io) return;

    const eventData = {
        type: eventType,
        matchId,
        ...data,
        timestamp: new Date()
    };

    global.io.to(`match:${matchId}`).emit('matchUpdate', eventData);

    const defaultLogMessage = `Match event [${eventType}] broadcast to match:${matchId}`;
    console.log(logMessage || defaultLogMessage);

    // Store event in memory for recent event history (optional)
    // This could be useful for clients that connect later and want to see recent events
    if (!global.matchEvents) {
        global.matchEvents = {};
    }

    if (!global.matchEvents[matchId]) {
        global.matchEvents[matchId] = [];
    }

    // Store only the last 50 events
    const MAX_EVENTS = 50;
    global.matchEvents[matchId].push({
        ...eventData,
        clientsNotified: global.io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0
    });

    if (global.matchEvents[matchId].length > MAX_EVENTS) {
        global.matchEvents[matchId].shift();
    }
};

/**
 * Get the list of dismissed and remaining batsmen for an innings
 */
export const getBattingStatus = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { innings } = req.query;

        // Validate innings parameter
        if (!innings || !['firstInnings', 'secondInnings'].includes(innings)) {
            return res.status(400).json({
                status: false,
                message: 'Valid innings (firstInnings or secondInnings) is required',
                data: null
            });
        }

        // Find match with relevant data
        const match = await Match.findById(matchId)
            .populate({
                path: `${innings}.battingTeam`,
                select: 'teamName players',
                populate: {
                    path: 'players.player',
                    select: 'name avatar mobile'
                }
            })
            .populate(`${innings}.currentStriker`, 'name avatar')
            .populate(`${innings}.currentNonStriker`, 'name avatar');

        if (!match) {
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Get the batting team and its players
        const battingTeam = match[innings].battingTeam;
        if (!battingTeam || !battingTeam.players) {
            return res.status(400).json({
                status: false,
                message: 'Batting team or players not found for this innings',
                data: null
            });
        }

        // Collect all players who have been dismissed
        const dismissedPlayers = [];
        match[innings].balls.forEach(ball => {
            if (ball.isWicket && ball.playerOut) {
                const playerExists = dismissedPlayers.some(player => player._id.toString() === ball.playerOut.toString());
                if (!playerExists) {
                    dismissedPlayers.push({
                        _id: ball.playerOut,
                        wicketType: ball.wicketType,
                        overNumber: ball.overNumber,
                        ballNumber: ball.ballNumber,
                        timestamp: ball.timestamp
                    });
                }
            }
        });

        // Get current batting players
        const currentBatsmen = [];
        if (match[innings].currentStriker) {
            currentBatsmen.push(match[innings].currentStriker._id.toString());
        }
        if (match[innings].currentNonStriker) {
            currentBatsmen.push(match[innings].currentNonStriker._id.toString());
        }

        // Process team players to identify dismissed and remaining batsmen
        const teamPlayers = battingTeam.players.map(playerInfo => {
            const player = playerInfo.player;
            if (!player) return null;

            const isOut = dismissedPlayers.some(dismissed => dismissed._id.toString() === player._id.toString());
            const isBatting = currentBatsmen.includes(player._id.toString());

            const dismissalInfo = isOut ? dismissedPlayers.find(d => d._id.toString() === player._id.toString()) : null;

            return {
                _id: player._id,
                name: player.name,
                avatar: player.avatar,
                mobile: player.mobile,
                status: isOut ? 'out' : isBatting ? 'batting' : 'yet to bat',
                dismissalInfo: isOut ? {
                    wicketType: dismissalInfo.wicketType,
                    overNumber: dismissalInfo.overNumber,
                    ballNumber: dismissalInfo.ballNumber
                } : null
            };
        }).filter(Boolean); // Remove any null entries

        // Separate players by status
        const playersByStatus = {
            batting: teamPlayers.filter(player => player.status === 'batting'),
            out: teamPlayers.filter(player => player.status === 'out'),
            yetToBat: teamPlayers.filter(player => player.status === 'yet to bat')
        };

        return res.status(200).json({
            status: true,
            message: 'Batting status fetched successfully',
            data: {
                teamName: battingTeam.teamName,
                battingStatus: playersByStatus,
                currentInnings: {
                    runs: match[innings].totalRuns,
                    wickets: match[innings].wickets,
                    overs: match[innings].overs
                }
            }
        });

    } catch (error) {
        console.error('Error fetching batting status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

// Function to be used for the update ball details and update the innings total runs based on the negative run and bonus runs 
export const updateBall = async (req, res) => {
    try {
        const { matchId, ballId } = req.params;
        const { innings, catchMissed, fielder, runSaved, runMissed, fieldingHighlight, negativeRuns, reason, bonusRuns } = req.body;

        console.log("Update Ball API Call : ", req.body);

        // Validate innings parameter
        if (!innings || !['firstInnings', 'secondInnings'].includes(innings)) {
            return res.status(400).json({
                status: false,
                message: 'Valid innings (firstInnings or secondInnings) is required',
                data: null
            });
        }

        // Get the match details
        const match = await Match.findById(matchId);
        if (!match) {
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Initialize historyLogs array if it doesn't exist
        if (!match[innings]?.historyLogs) {
            match[innings]['historyLogs'] = [];
        }

        // Update the single ball details
        match[innings]?.balls?.forEach((element) => {
            if (element?._id == ballId) {
                element['catchMissed'] = catchMissed || element['catchMissed'] || null;
                element['fielder'] = fielder || element['fielder'] || null;
                element['runSaved'] = runSaved || element['runSaved'] || null;
                element['runMissed'] = runMissed || element['runMissed'] || null;
                element['fieldingHighlight'] = fieldingHighlight || element['fieldingHighlight'] || null;
            }
        });

        // Manage array for the manage negative run and bonus run logs
        const historyLogs = [];

        // Minus the negativeRuns from the total runs and create the log
        if (negativeRuns && Number(negativeRuns) > 0) {
            match[innings]['totalRuns'] = Number(match[innings]['totalRuns'] || 0) - Number(negativeRuns);
            historyLogs.push({
                "reason": reason || `Minus run ${negativeRuns}`,
                "isNegativeRun": true,
                "isBonusRun": false,
                "timestamp": new Date(),
                'runs': negativeRuns
            });
        }

        // Add the bonus runs on the totalRuns and create the log
        if (bonusRuns && Number(bonusRuns) > 0) {
            match[innings]['totalRuns'] = Number(match[innings]['totalRuns'] || 0) + Number(bonusRuns);
            historyLogs.push({
                "reason": reason || `Add bonus run ${bonusRuns}`,
                "isNegativeRun": false,
                "isBonusRun": true,
                "timestamp": new Date(),
                'runs': bonusRuns
            });
        }

        // Update history logs
        if (historyLogs.length > 0) {
            match[innings].historyLogs = [...match[innings].historyLogs, ...historyLogs];
        }   

        await match.save();

        return res.status(200).json({
            status: true,
            message: 'Ball Updated Successfully',
            data: match
        });
    } catch (error) {
        console.error('Error while the updating ball details:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}