import Tournament from '../models/Tournament.js';
import Match from '../models/Match.js';

/**
 * Get tournament point table
 */
export const getTournamentPointTable = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Find tournament
        const tournament = await Tournament.findOne({ 
            tournamentId,
            isDeleted: false // Exclude deleted tournaments
        })
            .populate('registeredTeams.team', 'teamName logo');

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Get all completed matches for this tournament
        const matches = await Match.find({
            tournament: tournament._id,
            status: 'completed'
        }).populate('teamA teamB');

        // Initialize point table
        const pointTable = tournament.registeredTeams.map(rt => ({
            team: rt.team,
            matches: 0,
            won: 0,
            lost: 0,
            points: 0,
            nrr: 0
        }));

        // Calculate points and NRR
        for (const match of matches) {
            if (!match.result || !match.result.winner) continue;

            const winnerId = match.result.winner.toString();
            const teamAId = match.teamA._id.toString();
            const teamBId = match.teamB._id.toString();

            // Update matches played
            pointTable.find(pt => pt.team._id.toString() === teamAId).matches++;
            pointTable.find(pt => pt.team._id.toString() === teamBId).matches++;

            // Update wins and losses
            if (winnerId === teamAId) {
                pointTable.find(pt => pt.team._id.toString() === teamAId).won++;
                pointTable.find(pt => pt.team._id.toString() === teamBId).lost++;
            } else {
                pointTable.find(pt => pt.team._id.toString() === teamBId).won++;
                pointTable.find(pt => pt.team._id.toString() === teamAId).lost++;
            }

            // Calculate points (2 points per win)
            pointTable.find(pt => pt.team._id.toString() === winnerId).points += 2;
        }

        // Sort by points (descending) and then by NRR (descending)
        pointTable.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            return b.nrr - a.nrr;
        });

        return res.status(200).json({
            status: true,
            message: 'Point table fetched successfully',
            data: pointTable
        });
    } catch (error) {
        console.error('Error fetching point table:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};


/**
 * Get comprehensive tournament statistics including batting and bowling records
 */
export const getTournamentStats = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Find tournament
        const tournament = await Tournament.findOne({ 
            tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });
        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Get all completed matches
        const matches = await Match.find({
            tournament: tournament._id
        }).populate('teamA teamB');

        // Initialize player stats
        const playerStats = {};

        // Process each match
        for (const match of matches) {
            // Process first innings
            if (match.firstInnings && match.firstInnings.balls) {
                for (const ball of match.firstInnings.balls) {
                    // Process batting stats
                    if (ball.striker) {
                        const strikerId = ball.striker.toString();
                        if (!playerStats[strikerId]) {
                            playerStats[strikerId] = {
                                player: ball.striker,
                                matches: 0,
                                innings: 0,
                                batting: {
                                    runs: 0,
                                    balls: 0,
                                    fours: 0,
                                    sixes: 0,
                                    highestScore: 0,
                                    strikeRate: 0,
                                    average: 0,
                                    notOuts: 0,
                                    hundreds: 0,
                                    fifties: 0,
                                    nineties: 0
                                },
                                bowling: {
                                    overs: 0,
                                    runs: 0,
                                    wickets: 0,
                                    economy: 0,
                                    average: 0,
                                    bestBowling: { wickets: 0, runs: 0 },
                                    fiveWickets: 0
                                }
                            };
                        }

                        playerStats[strikerId].batting.runs += ball.runs;
                        playerStats[strikerId].batting.balls++;
                        if (ball.runs === 4) playerStats[strikerId].batting.fours++;
                        if (ball.runs === 6) playerStats[strikerId].batting.sixes++;
                    }

                    // Process bowling stats
                    if (ball.bowler) {
                        const bowlerId = ball.bowler.toString();
                        if (!playerStats[bowlerId]) {
                            playerStats[bowlerId] = {
                                player: ball.bowler,
                                matches: 0,
                                innings: 0,
                                batting: {
                                    runs: 0,
                                    balls: 0,
                                    fours: 0,
                                    sixes: 0,
                                    highestScore: 0,
                                    strikeRate: 0,
                                    average: 0,
                                    notOuts: 0,
                                    hundreds: 0,
                                    fifties: 0,
                                    nineties: 0
                                },
                                bowling: {
                                    overs: 0,
                                    runs: 0,
                                    wickets: 0,
                                    economy: 0,
                                    average: 0,
                                    bestBowling: { wickets: 0, runs: 0 },
                                    fiveWickets: 0
                                }
                            };
                        }

                        playerStats[bowlerId].bowling.runs += ball.runs;
                        playerStats[bowlerId].bowling.overs += 1/6;
                        if (ball.isWicket) playerStats[bowlerId].bowling.wickets++;
                    }
                }
            }

            // Process second innings
            if (match.secondInnings && match.secondInnings.balls) {
                for (const ball of match.secondInnings.balls) {
                    // Process batting stats
                    if (ball.striker) {
                        const strikerId = ball.striker.toString();
                        if (!playerStats[strikerId]) {
                            playerStats[strikerId] = {
                                player: ball.striker,
                                matches: 0,
                                innings: 0,
                                batting: {
                                    runs: 0,
                                    balls: 0,
                                    fours: 0,
                                    sixes: 0,
                                    highestScore: 0,
                                    strikeRate: 0,
                                    average: 0,
                                    notOuts: 0,
                                    hundreds: 0,
                                    fifties: 0,
                                    nineties: 0
                                },
                                bowling: {
                                    overs: 0,
                                    runs: 0,
                                    wickets: 0,
                                    economy: 0,
                                    average: 0,
                                    bestBowling: { wickets: 0, runs: 0 },
                                    fiveWickets: 0
                                }
                            };
                        }

                        playerStats[strikerId].batting.runs += ball.runs;
                        playerStats[strikerId].batting.balls++;
                        if (ball.runs === 4) playerStats[strikerId].batting.fours++;
                        if (ball.runs === 6) playerStats[strikerId].batting.sixes++;
                    }

                    // Process bowling stats
                    if (ball.bowler) {
                        const bowlerId = ball.bowler.toString();
                        if (!playerStats[bowlerId]) {
                            playerStats[bowlerId] = {
                                player: ball.bowler,
                                matches: 0,
                                innings: 0,
                                batting: {
                                    runs: 0,
                                    balls: 0,
                                    fours: 0,
                                    sixes: 0,
                                    highestScore: 0,
                                    strikeRate: 0,
                                    average: 0,
                                    notOuts: 0,
                                    hundreds: 0,
                                    fifties: 0,
                                    nineties: 0
                                },
                                bowling: {
                                    overs: 0,
                                    runs: 0,
                                    wickets: 0,
                                    economy: 0,
                                    average: 0,
                                    bestBowling: { wickets: 0, runs: 0 },
                                    fiveWickets: 0
                                }
                            };
                        }

                        playerStats[bowlerId].bowling.runs += ball.runs;
                        playerStats[bowlerId].bowling.overs += 1/6;
                        if (ball.isWicket) playerStats[bowlerId].bowling.wickets++;
                    }
                }
            }
        }

        // Calculate additional statistics
        const statsArray = Object.values(playerStats).map(stat => {
            // Calculate batting statistics
            stat.batting.strikeRate = stat.batting.balls > 0 
                ? (stat.batting.runs / stat.batting.balls) * 100 
                : 0;
            stat.batting.average = (stat.innings - stat.batting.notOuts) > 0 
                ? stat.batting.runs / (stat.innings - stat.batting.notOuts) 
                : 0;

            // Calculate bowling statistics
            stat.bowling.economy = stat.bowling.overs > 0 
                ? stat.bowling.runs / stat.bowling.overs 
                : 0;
            stat.bowling.average = stat.bowling.wickets > 0 
                ? stat.bowling.runs / stat.bowling.wickets 
                : 0;

            // Calculate matches and innings
            stat.matches = Math.ceil(stat.innings / 2);
            stat.innings = Math.ceil(stat.innings);

            // Calculate milestones
            if (stat.batting.runs >= 100) stat.batting.hundreds++;
            if (stat.batting.runs >= 50 && stat.batting.runs < 100) stat.batting.fifties++;
            if (stat.batting.runs >= 90 && stat.batting.runs < 100) stat.batting.nineties++;
            if (stat.bowling.wickets >= 5) stat.bowling.fiveWickets++;

            return stat;
        });

        // Sort and organize statistics
        const stats = {
            batting: {
                mostRuns: [...statsArray]
                    .sort((a, b) => b.batting.runs - a.batting.runs)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        runs: stat.batting.runs,
                        balls: stat.batting.balls,
                        strikeRate: stat.batting.strikeRate,
                        average: stat.batting.average,
                        matches: stat.matches,
                        innings: stat.innings
                    })),
                highestScore: [...statsArray]
                    .sort((a, b) => b.batting.highestScore - a.batting.highestScore)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        highestScore: stat.batting.highestScore,
                        matches: stat.matches,
                        innings: stat.innings
                    })),
                bestAverage: [...statsArray]
                    .sort((a, b) => b.batting.average - a.batting.average)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        average: stat.batting.average,
                        runs: stat.batting.runs,
                        innings: stat.innings,
                        notOuts: stat.batting.notOuts
                    })),
                bestStrikeRate: [...statsArray]
                    .sort((a, b) => b.batting.strikeRate - a.batting.strikeRate)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        strikeRate: stat.batting.strikeRate,
                        runs: stat.batting.runs,
                        balls: stat.batting.balls
                    })),
                mostHundreds: [...statsArray]
                    .sort((a, b) => b.batting.hundreds - a.batting.hundreds)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        hundreds: stat.batting.hundreds,
                        runs: stat.batting.runs,
                        matches: stat.matches
                    })),
                mostFifties: [...statsArray]
                    .sort((a, b) => b.batting.fifties - a.batting.fifties)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        fifties: stat.batting.fifties,
                        runs: stat.batting.runs,
                        matches: stat.matches
                    })),
                mostFours: [...statsArray]
                    .sort((a, b) => b.batting.fours - a.batting.fours)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        fours: stat.batting.fours,
                        runs: stat.batting.runs,
                        matches: stat.matches
                    })),
                mostSixes: [...statsArray]
                    .sort((a, b) => b.batting.sixes - a.batting.sixes)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        sixes: stat.batting.sixes,
                        runs: stat.batting.runs,
                        matches: stat.matches
                    })),
                mostNineties: [...statsArray]
                    .sort((a, b) => b.batting.nineties - a.batting.nineties)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        nineties: stat.batting.nineties,
                        runs: stat.batting.runs,
                        matches: stat.matches
                    }))
            },
            bowling: {
                mostWickets: [...statsArray]
                    .sort((a, b) => b.bowling.wickets - a.bowling.wickets)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        wickets: stat.bowling.wickets,
                        overs: stat.bowling.overs,
                        runs: stat.bowling.runs,
                        average: stat.bowling.average,
                        economy: stat.bowling.economy,
                        matches: stat.matches
                    })),
                bestAverage: [...statsArray]
                    .sort((a, b) => a.bowling.average - b.bowling.average)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        average: stat.bowling.average,
                        wickets: stat.bowling.wickets,
                        runs: stat.bowling.runs,
                        matches: stat.matches
                    })),
                bestEconomy: [...statsArray]
                    .sort((a, b) => a.bowling.economy - b.bowling.economy)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        economy: stat.bowling.economy,
                        wickets: stat.bowling.wickets,
                        overs: stat.bowling.overs,
                        runs: stat.bowling.runs,
                        matches: stat.matches
                    })),
                mostFiveWickets: [...statsArray]
                    .sort((a, b) => b.bowling.fiveWickets - a.bowling.fiveWickets)
                    .slice(0, 10)
                    .map(stat => ({
                        player: stat.player,
                        fiveWickets: stat.bowling.fiveWickets,
                        wickets: stat.bowling.wickets,
                        matches: stat.matches
                    }))
            }
        };

        return res.status(200).json({
            status: true,
            message: 'Tournament statistics fetched successfully',
            data: stats
        });
    } catch (error) {
        console.error('Error fetching tournament statistics:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};