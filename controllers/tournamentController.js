import Tournament from '../models/Tournament.js';
import Team from '../models/Teams.js';
import Payment from '../models/Payment.js';
import TournamentPass from '../models/TournamentPass.js';
import Ground from '../models/Ground.js';
import { Roles } from '../constant/role.js';
import mongoose from 'mongoose';
import TournamentGroundRegistration from '../models/TournamentGroundRegistration.js';
import TournamentFAQ from '../models/TournamentFAQ.js';
import TournamentRules from '../models/TournamentRules.js';
import TournamentGuidelines from '../models/TournamentGuidelines.js';
import Booking from '../models/GroundBooking.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import TournamentTeam from '../models/TournamentTeam.js';

/**
 * Generate a tournament ID based on format: Gamecode-City-TournamentType-Number (e.g., CKBLRWA0001)
 */
const generateTournamentId = async (tournamentType, city) => {
    const gameCode = "CK"; // Cricket
    const cityCode = city.substring(0, 3).toUpperCase();
    const tournamentTypeCode = tournamentType === "Warriors Cup" ? "WA" :
        tournamentType === "Warriors Cup X" ? "WX" : "CC";

    // Find the last tournament with the same prefix to determine the next number
    const prefix = `${gameCode}${cityCode}${tournamentTypeCode}`;
    const lastTournament = await Tournament.findOne(
        { tournamentId: new RegExp(`^${prefix}`) },
        {},
        { sort: { tournamentId: -1 } }
    );

    let nextNumber = "0001";
    if (lastTournament) {
        const lastNumber = parseInt(lastTournament.tournamentId.slice(-4));
        nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    }

    return `${prefix}${nextNumber}`;
};

/**
 * Schedule matches for a tournament
 * @param {Tournament} tournament - The tournament to schedule matches for
 */
const scheduleMatches = async (tournament) => {
    const teams = tournament.registeredTeams.map(rt => rt.team);
    const venues = tournament.venues;

    if (teams.length < 2) {
        return { matches: [], endDate: tournament.startDate }; // Not enough teams to schedule matches
    }

    const matchSchedule = [];
    const startDate = new Date(tournament.startDate);
    let lastMatchDate = new Date(startDate);

    // Parse match timing parameters
    const [startHour, startMinute] = tournament.matchStartTime.split(':').map(Number);
    const matchDurationMinutes = tournament.matchDuration;
    const matchGapMinutes = tournament.matchGapMinutes || 10; // Default to 10 minutes gap

    // Helper function to calculate the next match time
    const calculateMatchTime = (baseDate, matchIndex) => {
        const matchDate = new Date(baseDate);

        // Total time for one match including gap (in minutes)
        const totalTimePerMatch = matchDurationMinutes + matchGapMinutes;

        // Calculate how many matches we can fit in a day starting from startHour
        const minutesAvailableInDay = (24 - startHour) * 60 - startMinute;
        const matchesPerDay = Math.floor(minutesAvailableInDay / totalTimePerMatch);
        const maxMatchesPerDay = matchesPerDay > 0 ? matchesPerDay : 1; // At least 1 match per day

        // Determine which day and what time the match should be
        const dayOffset = Math.floor(matchIndex / maxMatchesPerDay);
        const matchOffsetInDay = matchIndex % maxMatchesPerDay;

        // Set the date
        matchDate.setDate(matchDate.getDate() + dayOffset);

        // Calculate start time in minutes from midnight
        const startTimeMinutes = (startHour * 60 + startMinute) + (matchOffsetInDay * totalTimePerMatch);
        const startTimeHour = Math.floor(startTimeMinutes / 60);
        const startTimeMin = startTimeMinutes % 60;

        // Calculate end time
        const endTimeMinutes = startTimeMinutes + matchDurationMinutes;
        const endTimeHour = Math.floor(endTimeMinutes / 60);
        const endTimeMin = endTimeMinutes % 60;

        // Format times
        const matchStartTime = `${String(startTimeHour).padStart(2, '0')}:${String(startTimeMin).padStart(2, '0')}`;
        const matchEndTime = `${String(endTimeHour).padStart(2, '0')}:${String(endTimeMin).padStart(2, '0')}`;

        // Set the match date hours and minutes
        matchDate.setHours(startTimeHour, startTimeMin, 0, 0);

        return {
            matchDate: new Date(matchDate),
            matchStartTime,
            matchEndTime
        };
    };

    // Counter for match index to track scheduling across all matches
    let matchIndex = 0;

    // Determine the tournament format based on number of teams
    const numTeams = teams.length;

    // Handle specific team counts with appropriate scheduling patterns
    if (numTeams === 2) {
        // Create 3 matches for Best of 3 series
        for (let i = 0; i < 3; i++) {
            const matchTiming = calculateMatchTime(startDate, matchIndex++);
            matchSchedule.push({
                teamA: teams[0],
                teamB: teams[1],
                venue: venues[0],
                matchDate: matchTiming.matchDate,
                matchStartTime: matchTiming.matchStartTime,
                matchEndTime: matchTiming.matchEndTime,
                matchType: "group",
                groupName: "Best of 3",
                status: "scheduled",
                matchNumber: i + 1
            });

            if (matchTiming.matchDate > lastMatchDate) {
                lastMatchDate = new Date(matchTiming.matchDate);
            }
        }
    } else if (numTeams === 4) {
        // Round Robin format for 4 teams
        // Each team plays against every other team once
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const matchTiming = calculateMatchTime(startDate, matchIndex++);
                matchSchedule.push({
                    teamA: teams[i],
                    teamB: teams[j],
                    venue: venues[matchIndex % venues.length],
                    matchDate: matchTiming.matchDate,
                    matchStartTime: matchTiming.matchStartTime,
                    matchEndTime: matchTiming.matchEndTime,
                    matchType: "group",
                    groupName: "Round Robin",
                    status: "scheduled"
                });

                if (matchTiming.matchDate > lastMatchDate) {
                    lastMatchDate = new Date(matchTiming.matchDate);
                }
            }
        }
    } else {
        // For other number of teams, throw error
        throw new Error(`Unsupported number of teams: ${numTeams}. Only 2 or 4 teams are supported.`);
    }

    // Semi-finals followed by final

    // Semi-final 1: Team 1 vs Team 4
    const sf1Timing = calculateMatchTime(startDate, matchIndex++);
    matchSchedule.push({
        teamA: teams[0],
        teamB: teams[3],
        venue: venues[0],
        matchDate: sf1Timing.matchDate,
        matchStartTime: sf1Timing.matchStartTime,
        matchEndTime: sf1Timing.matchEndTime,
        matchType: "semi-final",
        groupName: "SF1",
        status: "scheduled"
    });

    if (sf1Timing.matchDate > lastMatchDate) {
        lastMatchDate = new Date(sf1Timing.matchDate);
    }

    // Semi-final 2: Team 2 vs Team 3
    const sf2Timing = calculateMatchTime(startDate, matchIndex++);
    matchSchedule.push({
        teamA: teams[1],
        teamB: teams[2],
        venue: venues[0],
        matchDate: sf2Timing.matchDate,
        matchStartTime: sf2Timing.matchStartTime,
        matchEndTime: sf2Timing.matchEndTime,
        matchType: "semi-final",
        groupName: "SF2",
        status: "scheduled"
    });

    if (sf2Timing.matchDate > lastMatchDate) {
        lastMatchDate = new Date(sf2Timing.matchDate);
    }

    // Final match
    const finalDate = new Date(lastMatchDate);
    finalDate.setDate(lastMatchDate.getDate() + 1);

    const finalTiming = calculateMatchTime(finalDate, 0);
    matchSchedule.push({
        teamA: null, // Will be determined after semi-finals
        teamB: null, // Will be determined after semi-finals
        venue: venues[0],
        matchDate: finalTiming.matchDate,
        matchStartTime: finalTiming.matchStartTime,
        matchEndTime: finalTiming.matchEndTime,
        matchType: "final",
        groupName: "Final",
        status: "scheduled"
    });

    lastMatchDate = new Date(finalTiming.matchDate);

    if (numTeams > 4 && numTeams <= 8) {
        // For 5-8 teams: Create 2 groups with round-robin matches
        const group1 = teams.slice(0, Math.ceil(numTeams / 2));
        const group2 = teams.slice(Math.ceil(numTeams / 2));
        let matchDay = 0;

        // Group 1 matches
        for (let i = 0; i < group1.length; i++) {
            for (let j = i + 1; j < group1.length; j++) {
                const matchTime = calculateMatchTime(startDate, matchIndex++);

                matchSchedule.push({
                    teamA: group1[i],
                    teamB: group1[j],
                    venue: venues[matchIndex % venues.length],
                    matchDate: matchTime.matchDate,
                    matchStartTime: matchTime.matchStartTime,
                    matchEndTime: matchTime.matchEndTime,
                    matchType: "group",
                    groupName: "Group A",
                    status: "scheduled"
                });

                if (matchTime.matchDate > lastMatchDate) {
                    lastMatchDate = new Date(matchTime.matchDate);
                }
            }
        }

        // Group 2 matches
        for (let i = 0; i < group2.length; i++) {
            for (let j = i + 1; j < group2.length; j++) {
                const matchTime = calculateMatchTime(startDate, matchIndex++);

                matchSchedule.push({
                    teamA: group2[i],
                    teamB: group2[j],
                    venue: venues[matchIndex % venues.length],
                    matchDate: matchTime.matchDate,
                    matchStartTime: matchTime.matchStartTime,
                    matchEndTime: matchTime.matchEndTime,
                    matchType: "group",
                    groupName: "Group B",
                    status: "scheduled"
                });

                if (matchTime.matchDate > lastMatchDate) {
                    lastMatchDate = new Date(matchTime.matchDate);
                }
            }
        }

        // Semi-finals
        const semiFinalDate = new Date(lastMatchDate);
        semiFinalDate.setDate(lastMatchDate.getDate() + 1);

        // Semi-final 1: Group A winner vs Group B runner-up
        const sf1Timing = calculateMatchTime(semiFinalDate, 0);
        matchSchedule.push({
            teamA: null, // Will be determined after group stage
            teamB: null, // Will be determined after group stage
            venue: venues[0],
            matchDate: sf1Timing.matchDate,
            matchStartTime: sf1Timing.matchStartTime,
            matchEndTime: sf1Timing.matchEndTime,
            matchType: "semi-final",
            groupName: "SF1",
            status: "scheduled"
        });

        // Semi-final 2: Group B winner vs Group A runner-up
        const sf2Timing = calculateMatchTime(semiFinalDate, 1);
        matchSchedule.push({
            teamA: null, // Will be determined after group stage
            teamB: null, // Will be determined after group stage
            venue: venues[0],
            matchDate: sf2Timing.matchDate,
            matchStartTime: sf2Timing.matchStartTime,
            matchEndTime: sf2Timing.matchEndTime,
            matchType: "semi-final",
            groupName: "SF2",
            status: "scheduled"
        });

        if (sf2Timing.matchDate > lastMatchDate) {
            lastMatchDate = new Date(sf2Timing.matchDate);
        }

        // Final
        const finalDate = new Date(lastMatchDate);
        finalDate.setDate(lastMatchDate.getDate() + 1);

        const finalTiming = calculateMatchTime(finalDate, 0);
        matchSchedule.push({
            teamA: null, // Will be determined after semi-finals
            teamB: null, // Will be determined after semi-finals
            venue: venues[0],
            matchDate: finalTiming.matchDate,
            matchStartTime: finalTiming.matchStartTime,
            matchEndTime: finalTiming.matchEndTime,
            matchType: "final",
            groupName: "Final",
            status: "scheduled"
        });

        lastMatchDate = finalDate;
    } else if (numTeams > 8 && numTeams <= 16) {
        // For 9-16 teams: Create 4 groups
        const groupSize = Math.ceil(numTeams / 4);
        const groups = [];

        // Create groups
        for (let i = 0; i < 4; i++) {
            const start = i * groupSize;
            const end = Math.min(start + groupSize, numTeams);
            if (start < numTeams) {
                groups.push(teams.slice(start, end));
            }
        }

        // Schedule group matches
        let matchDay = 0;
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const groupName = `Group ${String.fromCharCode(65 + g)}`; // Group A, B, C, D

            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const matchDate = new Date(startDate);
                    const matchTime = calculateMatchTime(matchDate, matchDay++);

                    matchSchedule.push({
                        teamA: group[i],
                        teamB: group[j],
                        venue: venues[matchDay % venues.length],
                        matchDate: matchTime.matchDate,
                        matchStartTime: matchTime.matchStartTime,
                        matchEndTime: matchTime.matchEndTime,
                        matchType: "group",
                        groupName: groupName,
                        status: "scheduled"
                    });

                    if (matchTime.matchDate > lastMatchDate) {
                        lastMatchDate = new Date(matchTime.matchDate);
                    }
                }
            }
        }

        // Round of 16
        const r16Date = new Date(lastMatchDate);
        r16Date.setDate(lastMatchDate.getDate() + 1);

        for (let i = 0; i < 8; i++) {
            const matchDate = new Date(r16Date);
            const matchTime = calculateMatchTime(matchDate, i);

            matchSchedule.push({
                teamA: null, // Will be determined after group stage
                teamB: null, // Will be determined after group stage
                venue: venues[i % venues.length],
                matchDate: matchTime.matchDate,
                matchStartTime: matchTime.matchStartTime,
                matchEndTime: matchTime.matchEndTime,
                matchType: "round-of-16",
                groupName: `R16-${i + 1}`,
                status: "scheduled"
            });

            if (matchTime.matchDate > lastMatchDate) {
                lastMatchDate = new Date(matchTime.matchDate);
            }
        }

        // Quarter-finals
        const quarterFinalDate = new Date(lastMatchDate);
        quarterFinalDate.setDate(lastMatchDate.getDate() + 1);

        for (let i = 0; i < 4; i++) {
            matchSchedule.push({
                teamA: null, // Will be determined after round of 16
                teamB: null, // Will be determined after round of 16
                venue: venues[i % venues.length],
                matchDate: quarterFinalDate,
                matchStartTime: "14:00",
                matchEndTime: "16:00",
                matchType: "quarter-final",
                groupName: `QF${i + 1}`,
                status: "scheduled"
            });
        }

        if (quarterFinalDate > lastMatchDate) {
            lastMatchDate = quarterFinalDate;
        }

        // Semi-finals
        const semiFinalDate = new Date(lastMatchDate);
        semiFinalDate.setDate(lastMatchDate.getDate() + 1);

        matchSchedule.push({
            teamA: null, // Will be determined after quarter-finals
            teamB: null, // Will be determined after quarter-finals
            venue: venues[0],
            matchDate: semiFinalDate,
            matchStartTime: "16:00",
            matchEndTime: "18:00",
            matchType: "semi-final",
            groupName: "SF1",
            status: "scheduled"
        });

        matchSchedule.push({
            teamA: null, // Will be determined after quarter-finals
            teamB: null, // Will be determined after quarter-finals
            venue: venues[0],
            matchDate: semiFinalDate,
            matchStartTime: "18:00",
            matchEndTime: "20:00",
            matchType: "semi-final",
            groupName: "SF2",
            status: "scheduled"
        });

        if (semiFinalDate > lastMatchDate) {
            lastMatchDate = semiFinalDate;
        }

        // Final
        const finalDate = new Date(lastMatchDate);
        finalDate.setDate(lastMatchDate.getDate() + 1);

        matchSchedule.push({
            teamA: null, // Will be determined after semi-finals
            teamB: null, // Will be determined after semi-finals
            venue: venues[0],
            matchDate: finalDate,
            matchStartTime: "18:00",
            matchEndTime: "20:00",
            matchType: "final",
            groupName: "Final",
            status: "scheduled"
        });

        lastMatchDate = finalDate;
    } else if (numTeams > 16 && numTeams <= 32) {
        // For 17-32 teams: Create 8 groups
        const groupSize = Math.ceil(numTeams / 8);
        const groups = [];

        // Create groups
        for (let i = 0; i < 8; i++) {
            const start = i * groupSize;
            const end = Math.min(start + groupSize, numTeams);
            if (start < numTeams) {
                groups.push(teams.slice(start, end));
            }
        }

        // Schedule group matches
        let matchDay = 0;
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const groupName = `Group ${String.fromCharCode(65 + g)}`; // Group A, B, C, etc.

            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const matchDate = new Date(startDate);
                    const matchTime = calculateMatchTime(matchDate, matchDay++);

                    matchSchedule.push({
                        teamA: group[i],
                        teamB: group[j],
                        venue: venues[matchDay % venues.length],
                        matchDate: matchTime.matchDate,
                        matchStartTime: matchTime.matchStartTime,
                        matchEndTime: matchTime.matchEndTime,
                        matchType: "group",
                        groupName: groupName,
                        status: "scheduled"
                    });

                    if (matchTime.matchDate > lastMatchDate) {
                        lastMatchDate = new Date(matchTime.matchDate);
                    }
                }
            }
        }

        // Round of 16
        const r16Date = new Date(lastMatchDate);
        r16Date.setDate(lastMatchDate.getDate() + 1);

        for (let i = 0; i < 8; i++) {
            const matchDate = new Date(r16Date);
            const matchTime = calculateMatchTime(matchDate, i);

            matchSchedule.push({
                teamA: null, // Will be determined after group stage
                teamB: null, // Will be determined after group stage
                venue: venues[i % venues.length],
                matchDate: matchTime.matchDate,
                matchStartTime: matchTime.matchStartTime,
                matchEndTime: matchTime.matchEndTime,
                matchType: "round-of-16",
                groupName: `R16-${i + 1}`,
                status: "scheduled"
            });

            if (matchTime.matchDate > lastMatchDate) {
                lastMatchDate = new Date(matchTime.matchDate);
            }
        }

        // Quarter-finals
        const quarterFinalDate = new Date(lastMatchDate);
        quarterFinalDate.setDate(lastMatchDate.getDate() + 1);

        for (let i = 0; i < 4; i++) {
            matchSchedule.push({
                teamA: null, // Will be determined after round of 16
                teamB: null, // Will be determined after round of 16
                venue: venues[i % venues.length],
                matchDate: quarterFinalDate,
                matchStartTime: "14:00",
                matchEndTime: "16:00",
                matchType: "quarter-final",
                groupName: `QF${i + 1}`,
                status: "scheduled"
            });
        }

        if (quarterFinalDate > lastMatchDate) {
            lastMatchDate = quarterFinalDate;
        }

        // Semi-finals
        const semiFinalDate = new Date(lastMatchDate);
        semiFinalDate.setDate(lastMatchDate.getDate() + 1);

        matchSchedule.push({
            teamA: null, // Will be determined after quarter-finals
            teamB: null, // Will be determined after quarter-finals
            venue: venues[0],
            matchDate: semiFinalDate,
            matchStartTime: "16:00",
            matchEndTime: "18:00",
            matchType: "semi-final",
            groupName: "SF1",
            status: "scheduled"
        });

        matchSchedule.push({
            teamA: null, // Will be determined after quarter-finals
            teamB: null, // Will be determined after quarter-finals
            venue: venues[0],
            matchDate: semiFinalDate,
            matchStartTime: "18:00",
            matchEndTime: "20:00",
            matchType: "semi-final",
            groupName: "SF2",
            status: "scheduled"
        });

        if (semiFinalDate > lastMatchDate) {
            lastMatchDate = semiFinalDate;
        }

        // Final
        const finalDate = new Date(lastMatchDate);
        finalDate.setDate(lastMatchDate.getDate() + 1);

        matchSchedule.push({
            teamA: null, // Will be determined after semi-finals
            teamB: null, // Will be determined after semi-finals
            venue: venues[0],
            matchDate: finalDate,
            matchStartTime: "18:00",
            matchEndTime: "20:00",
            matchType: "final",
            groupName: "Final",
            status: "scheduled"
        });

        lastMatchDate = finalDate;
    }

    return {
        matches: matchSchedule,
        endDate: lastMatchDate
    };
};

/**
 * Schedule matches specifically for club tournaments
 * @param {Tournament} tournament - The club tournament to schedule matches for
 */
const scheduleClubMatches = async (tournament) => {
    const teams = tournament.registeredTeams.map(rt => rt.team);
    const venues = tournament.venues;

    if (teams.length < 2) {
        return { matches: [], endDate: tournament.startDate }; // Not enough teams to schedule matches
    }

    const matchSchedule = [];
    const startDate = new Date(tournament.startDate);
    let lastMatchDate = new Date(startDate);

    // Parse match timing parameters
    const [startHour, startMinute] = tournament.matchStartTime.split(':').map(Number);
    const matchDurationMinutes = tournament.matchDuration;
    const matchGapMinutes = tournament.matchGapMinutes || 10; // Default to 10 minutes gap

    // Helper function to calculate the next match time - reuse from the existing implementation
    const calculateMatchTime = (baseDate, matchIndex) => {
        const matchDate = new Date(baseDate);

        // Total time for one match including gap (in minutes)
        const totalTimePerMatch = matchDurationMinutes + matchGapMinutes;

        // Calculate how many matches we can fit in a day starting from startHour
        const minutesAvailableInDay = (24 - startHour) * 60 - startMinute;
        const matchesPerDay = Math.floor(minutesAvailableInDay / totalTimePerMatch);
        const maxMatchesPerDay = matchesPerDay > 0 ? matchesPerDay : 1; // At least 1 match per day

        // Determine which day and what time the match should be
        const dayOffset = Math.floor(matchIndex / maxMatchesPerDay);
        const matchOffsetInDay = matchIndex % maxMatchesPerDay;

        // Set the date
        matchDate.setDate(matchDate.getDate() + dayOffset);

        // Calculate start time in minutes from midnight
        const startTimeMinutes = (startHour * 60 + startMinute) + (matchOffsetInDay * totalTimePerMatch);
        const startTimeHour = Math.floor(startTimeMinutes / 60);
        const startTimeMin = startTimeMinutes % 60;

        // Calculate end time
        const endTimeMinutes = startTimeMinutes + matchDurationMinutes;
        const endTimeHour = Math.floor(endTimeMinutes / 60);
        const endTimeMin = endTimeMinutes % 60;

        // Format times
        const matchStartTime = `${String(startTimeHour).padStart(2, '0')}:${String(startTimeMin).padStart(2, '0')}`;
        const matchEndTime = `${String(endTimeHour).padStart(2, '0')}:${String(endTimeMin).padStart(2, '0')}`;

        // Set the match date hours and minutes
        matchDate.setHours(startTimeHour, startTimeMin, 0, 0);

        return {
            matchDate: new Date(matchDate),
            matchStartTime,
            matchEndTime
        };
    };

    // Counter for match index to track scheduling across all matches
    let matchIndex = 0;

    // Get club information for each team to organize teams by clubs
    const teamsWithClubs = await Team.find({ _id: { $in: teams } })
        .populate('createdBy', 'clubs')
        .lean();

    // Group teams by club affiliation
    const clubsMap = {};
    
    teamsWithClubs.forEach(team => {
        if (team.createdBy && team.createdBy.clubs && team.createdBy.clubs.length) {
            team.createdBy.clubs.forEach(clubId => {
                const clubIdStr = clubId.toString();
                if (!clubsMap[clubIdStr]) {
                    clubsMap[clubIdStr] = [];
                }
                clubsMap[clubIdStr].push(team._id);
            });
        } else {
            // Teams without club affiliation are grouped separately
            if (!clubsMap['unaffiliated']) {
                clubsMap['unaffiliated'] = [];
            }
            clubsMap['unaffiliated'].push(team._id);
        }
    });

    // Convert the map to an array of club groups
    const clubGroups = Object.values(clubsMap);
    
    // Determine the tournament format based on club groups
    const numClubs = clubGroups.length;
    
    // Adjust the schedule method based on number of clubs
    if (numClubs <= 2) {
        // For 1-2 clubs: Simple knockout format
        
        // For each club, create internal matches if there are multiple teams
        for (let i = 0; i < numClubs; i++) {
            const clubTeams = clubGroups[i];
            if (clubTeams.length > 1) {
                // Internal club matches
                for (let j = 0; j < clubTeams.length; j += 2) {
                    // Make sure we have pairs of teams
                    if (j + 1 < clubTeams.length) {
                        const matchTiming = calculateMatchTime(startDate, matchIndex++);
                        matchSchedule.push({
                            teamA: clubTeams[j],
                            teamB: clubTeams[j + 1],
                            venue: venues[matchIndex % venues.length],
                            matchDate: matchTiming.matchDate,
                            matchStartTime: matchTiming.matchStartTime,
                            matchEndTime: matchTiming.matchEndTime,
                            matchType: "group",
                            groupName: `Club ${i + 1} Internal`,
                            status: "scheduled"
                        });
                        
                        if (matchTiming.matchDate > lastMatchDate) {
                            lastMatchDate = new Date(matchTiming.matchDate);
                        }
                    }
                }
            }
        }
        
        // If there are two clubs, schedule finals between club champions
        if (numClubs === 2) {
            // Final match between clubs
            const finalDate = new Date(lastMatchDate);
            finalDate.setDate(lastMatchDate.getDate() + 1);
            
            const finalTiming = calculateMatchTime(finalDate, 0);
            matchSchedule.push({
                teamA: null, // Will be determined after club internal matches
                teamB: null, // Will be determined after club internal matches
                venue: venues[0],
                matchDate: finalTiming.matchDate,
                matchStartTime: finalTiming.matchStartTime,
                matchEndTime: finalTiming.matchEndTime,
                matchType: "final",
                groupName: "Final",
                status: "scheduled"
            });
            
            lastMatchDate = new Date(finalTiming.matchDate);
        }
    } else {
        // For 3+ clubs: Create group stages followed by knockouts
        
        // Group stage - each club is a group
        for (let i = 0; i < numClubs; i++) {
            const clubTeams = clubGroups[i];
            if (clubTeams.length > 1) {
                // Round robin within each club
                for (let j = 0; j < clubTeams.length; j++) {
                    for (let k = j + 1; k < clubTeams.length; k++) {
                        const matchTiming = calculateMatchTime(startDate, matchIndex++);
                        matchSchedule.push({
                            teamA: clubTeams[j],
                            teamB: clubTeams[k],
                            venue: venues[matchIndex % venues.length],
                            matchDate: matchTiming.matchDate,
                            matchStartTime: matchTiming.matchStartTime,
                            matchEndTime: matchTiming.matchEndTime,
                            matchType: "group",
                            groupName: `Club ${i + 1}`,
                            status: "scheduled"
                        });
                        
                        if (matchTiming.matchDate > lastMatchDate) {
                            lastMatchDate = new Date(matchTiming.matchDate);
                        }
                    }
                }
            }
        }
        
        // Move to knockout stages after group play
        const knockoutDate = new Date(lastMatchDate);
        knockoutDate.setDate(lastMatchDate.getDate() + 1);
        
        // Semi-finals with winners from each club
        if (numClubs >= 4) {
            // 4 semi-finalists
            const sf1Timing = calculateMatchTime(knockoutDate, 0);
            matchSchedule.push({
                teamA: null, // Will be determined after group stage
                teamB: null, // Will be determined after group stage
                venue: venues[0],
                matchDate: sf1Timing.matchDate,
                matchStartTime: sf1Timing.matchStartTime,
                matchEndTime: sf1Timing.matchEndTime,
                matchType: "semi-final",
                groupName: "SF1",
                status: "scheduled"
            });
            
            const sf2Timing = calculateMatchTime(knockoutDate, 1);
            matchSchedule.push({
                teamA: null, // Will be determined after group stage
                teamB: null, // Will be determined after group stage
                venue: venues[0],
                matchDate: sf2Timing.matchDate,
                matchStartTime: sf2Timing.matchStartTime,
                matchEndTime: sf2Timing.matchEndTime,
                matchType: "semi-final",
                groupName: "SF2",
                status: "scheduled"
            });
            
            if (sf2Timing.matchDate > lastMatchDate) {
                lastMatchDate = new Date(sf2Timing.matchDate);
            }
        } else if (numClubs === 3) {
            // 3 clubs - one gets a bye to the final
            const sf1Timing = calculateMatchTime(knockoutDate, 0);
            matchSchedule.push({
                teamA: null, // Club 1 winner
                teamB: null, // Club 2 winner
                venue: venues[0],
                matchDate: sf1Timing.matchDate,
                matchStartTime: sf1Timing.matchStartTime,
                matchEndTime: sf1Timing.matchEndTime,
                matchType: "semi-final",
                groupName: "SF1",
                status: "scheduled"
            });
            
            if (sf1Timing.matchDate > lastMatchDate) {
                lastMatchDate = new Date(sf1Timing.matchDate);
            }
        }
        
        // Final match
        const finalDate = new Date(lastMatchDate);
        finalDate.setDate(lastMatchDate.getDate() + 1);
        
        const finalTiming = calculateMatchTime(finalDate, 0);
        matchSchedule.push({
            teamA: null, // Will be determined after semi-finals
            teamB: null, // Will be determined after semi-finals
            venue: venues[0],
            matchDate: finalTiming.matchDate,
            matchStartTime: finalTiming.matchStartTime,
            matchEndTime: finalTiming.matchEndTime,
            matchType: "final",
            groupName: "Final",
            status: "scheduled"
        });
        
        lastMatchDate = new Date(finalTiming.matchDate);
    }
    
    return {
        matches: matchSchedule,
        endDate: lastMatchDate
    };
};

const getNextTournamentType = (currentType) => {
    switch (currentType) {
        case "Warriors Cup":
            return "Warriors Cup X";
        case "Warriors Cup X":
            return "Commanders Cup";
        default:
            return null; // No upgrade for Commanders Cup
    }
}; 

/**
 * Create a new tournament
 * @access Admin only
 */
export const createTournament = async (req, res) => {
    try {
        const {
            seriesName,
            tournamentType,
            startDate,
            teamLimit,
            venues,
            cost,
            format,
            stayOnScreen,
            matchStartTime,
            matchDuration,
            // New match-specific fields
            matchType,
            oversPerInnings,
            oversPerBowler,
            ballType,
            pitchType,
            umpires,
            // New team-specific fields
            matchGapMinutes,
            substitute,
            totalMember,
            isClubOnly
        } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can create tournaments',
                data: null
            });
        }

        // Validate venues
        if (!venues || !venues.length) {
            return res.status(400).json({
                status: false,
                message: 'At least one venue is required',
                data: null
            });
        }

        // Validate match timing parameters
        if (!matchStartTime || !matchDuration) {
            return res.status(400).json({
                status: false,
                message: 'Match start time and duration are required',
                data: null
            });
        }

        // Validate match-specific parameters
        if (!matchType || !oversPerInnings || !oversPerBowler || !ballType || !pitchType || !umpires || !umpires.length) {
            return res.status(400).json({
                status: false,
                message: 'All match-specific parameters are required',
                data: null
            });
        }

        // Validate team-specific parameters
        if (!matchGapMinutes || !substitute || !totalMember) {
            return res.status(400).json({
                status: false,
                message: 'All team-specific parameters are required',
                data: null
            });
        }

        // Validate umpires
        if (umpires.length < 2) {
            return res.status(400).json({
                status: false,
                message: 'At least 2 umpires are required',
                data: null
            });
        }

        // Get the first ground to determine city
        const ground = await Ground.findById(venues[0]);
        if (!ground) {
            return res.status(404).json({
                status: false,
                message: 'Ground not found',
                data: null
            });
        }

        // Generate tournament ID
        const tournamentId = await generateTournamentId(tournamentType, ground.city);

        // Create new tournament with match timing details
        const tournament = new Tournament({
            tournamentId,
            seriesName,
            tournamentType,
            startDate,
            teamLimit,
            venues,
            cost,
            format,
            stayOnScreen,
            matchStartTime,
            matchDuration,
            // New match-specific fields
            matchType,
            oversPerInnings,
            oversPerBowler,
            ballType,
            pitchType,
            umpires,
            isClubOnly,
            // New team-specific fields
            matchGapMinutes: matchGapMinutes || 10, // Default to 10 minutes if not provided
            substitute: substitute || 1, // Default to 1 if not provided
            totalMember: totalMember || 11, // Default to 11 if not provided
            createdBy: req.user._id
        });

        await tournament.save();

        return res.status(201).json({
            status: true,
            message: 'Tournament created successfully',
            data: tournament
        });
    } catch (error) {
        console.error('Error creating tournament:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Join a tournament with a team
 * Requires payment verification or a valid pass
 */
export const joinTournament = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { tournamentId, teamId, paymentMethod, passId, transactionId, groundId, booking, from, to, message } = req.body;

        // Validate input
        if (!tournamentId || !teamId || !groundId) {
            return res.status(400).json({
                status: false,
                message: 'Tournament ID, Team ID, and Ground ID are required',
                data: null
            });
        }

        // Validate booking data
        if (!Array.isArray(booking) || booking.length === 0 || !from || !to) {
            return res.status(400).json({
                status: false,
                message: 'Booking details (court/slot information and date range) are required',
                data: null
            });
        }

        // Find tournament
        let tournament = await Tournament.findOne({ tournamentId }).populate('venues').session(session);
        if (!tournament) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if tournament is club-only and validate team eligibility
        if (tournament.isClubOnly) {
            const team = await Team.findById(teamId).populate('createdBy').session(session);
            
            if (!team) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    status: false,
                    message: 'Team not found',
                    data: null
                });
            }
            
            const teamCreator = await User.findById(team.createdBy._id).session(session);
            
            if (!teamCreator || !teamCreator.clubs || teamCreator.clubs.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({
                    status: false,
                    message: 'This tournament is for club members only. The team creator must be a member of a club.',
                    data: null
                });
            }
        }

        // Verify ground is part of tournament venues
        if (!tournament.venues.some(venue => venue._id.toString() === groundId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Selected ground is not part of this tournament',
                data: null
            });
        }

        // Find team
        const team = await Team.findById(teamId).session(session);
        if (!team) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Team not found',
                data: null
            });
        }

        // Check if team already registered for this ground in this tournament
        const existingRegistration = await TournamentGroundRegistration.findOne({
            tournament: tournament._id,
            ground: groundId,
            team: teamId
        }).session(session);

        if (existingRegistration) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Team is already registered for this ground in this tournament',
                data: null
            });
        }

        // Check if tournament is full for this ground or tournament is already live
        const groundRegistrationsCount = await TournamentGroundRegistration.countDocuments({
            tournament: tournament._id,
            ground: groundId
        }).session(session);

        const maxTeamsPerGround = tournament.teamLimit / tournament.venues.length;
        const isTournamentFull = groundRegistrationsCount >= maxTeamsPerGround;
        const isTournamentLive = tournament.status === 'live';

        // If tournament is full or already live, create a new tournament with the same details
        if (isTournamentFull || isTournamentLive) {
            const ground = await Ground.findById(tournament.venues[0]).session(session);
            if (!ground) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    status: false,
                    message: 'Ground not found',
                    data: null
                });
            }

            const newTournamentId = await generateTournamentId(tournament.tournamentType, ground.city);

            const newTournament = new Tournament({
                tournamentId: newTournamentId,
                seriesName: tournament.seriesName,
                tournamentType: tournament.tournamentType,
                startDate: tournament.startDate,
                teamLimit: tournament.teamLimit,
                venues: tournament.venues,
                cost: tournament.cost,
                format: tournament.format,
                stayOnScreen: tournament.stayOnScreen,
                matchStartTime: tournament.matchStartTime,
                matchDuration: tournament.matchDuration,
                matchGapMinutes: tournament.matchGapMinutes,
                matchType: tournament.matchType,
                oversPerInnings: tournament.oversPerInnings,
                oversPerBowler: tournament.oversPerBowler,
                ballType: tournament.ballType,
                pitchType: tournament.pitchType,
                umpires: tournament.umpires || [],
                substitute: tournament.substitute,
                totalMember: tournament.totalMember,
                createdBy: req.user._id
            });

            await newTournament.save({ session });
            tournament = newTournament;
        }

        // Check if tournament status is upcoming globally
        if (tournament.status !== 'upcoming' && tournament.status !== 'live') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Cannot join a tournament that is not in upcoming or live status',
                data: null
            });
        }

        // Verify payment based on payment method
        let paymentStatus = "pending";

        if (paymentMethod === "pass") {
            if (!passId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Pass ID is required for pass payment method',
                    data: null
                });
            }

            const pass = await TournamentPass.findOne({
                passId,
                team: teamId,
                isUsed: false,
                passType: tournament.tournamentType
            }).session(session);

            if (!pass) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    status: false,
                    message: 'Valid pass not found for this team',
                    data: null
                });
            }

            pass.isUsed = true;
            pass.usedAt = new Date();
            pass.usedFor = tournament._id;
            await pass.save({ session });

            paymentStatus = "completed";

            const payment = new Payment({
                tournament: tournament._id,
                team: teamId,
                amount: tournament.cost,
                paymentMethod: "pass",
                passId: passId,
                status: "completed",
                paidBy: req.user._id
            });

            await payment.save({ session });
        } else if (paymentMethod === "direct") {
            if (!transactionId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    status: false,
                    message: 'Transaction ID is required for direct payment method',
                    data: null
                });
            }

            paymentStatus = "completed";

            const payment = new Payment({
                tournament: tournament._id,
                team: teamId,
                amount: tournament.cost,
                paymentMethod: "direct",
                transactionId: transactionId,
                status: "completed",
                paidBy: req.user._id
            });

            await payment.save({ session });
        } else {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Invalid payment method',
                data: null
            });
        }

        // Create tournament team entry
        const tournamentTeam = new TournamentTeam({
            tournament: tournament._id,
            team: teamId,
            players: team.players.map(p => ({
                player: p.player,
                isPlaying: true
            })),
            createdBy: req.user._id
        });

        await tournamentTeam.save({ session });

        // Process the ground booking
        const startDate = new Date(from);
        const endDate = new Date(to);

        if (startDate > endDate) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: "'from' date must be before 'to' date",
                data: null
            });
        }

        // Fetch the ground to verify slots
        const ground = await Ground.findById(groundId).session(session);
        if (!ground) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Ground not found',
                data: null
            });
        }

        const conflicts = [];

        // Iterate through each day in the range
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const currentBookingDate = new Date(date);

            for (let i = 0; i < booking.length; i++) {
                const { courtId, slotId } = booking[i];

                // Ensure the slot has isTournament=true
                let slotHasTournamentFlag = false;
                let slotFound = false;

                // Find the court and slot in the ground data
                for (const court of ground.courts) {
                    if (court._id.toString() === courtId) {
                        for (const time of court.times) {
                            for (const slot of time.slots) {
                                if (slot._id.toString() === slotId) {
                                    slotFound = true;
                                    if (slot.isTournament === true) {
                                        slotHasTournamentFlag = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!slotFound) {
                    conflicts.push({
                        date: currentBookingDate.toISOString().split("T")[0],
                        courtId,
                        slotId,
                        message: "Slot not found in the ground"
                    });
                    continue;
                }

                if (!slotHasTournamentFlag) {
                    conflicts.push({
                        date: currentBookingDate.toISOString().split("T")[0],
                        courtId,
                        slotId,
                        message: "This slot is not marked for tournament use"
                    });
                    continue;
                }

                // Check how many teams have already booked this slot for tournament
                const existingBookings = await Booking.find({
                    courtId: new mongoose.Types.ObjectId(courtId),
                    slotId: new mongoose.Types.ObjectId(slotId),
                    groundId: new mongoose.Types.ObjectId(groundId),
                    bookingDate: currentBookingDate,
                    tournamentId: tournament._id
                }).session(session);

                if (existingBookings.length >= 2) {
                    conflicts.push({
                        date: currentBookingDate.toISOString().split("T")[0],
                        courtId,
                        slotId,
                        message: "This tournament slot already has 2 teams booked"
                    });
                } else {
                    const newBooking = new Booking({
                        groundId: groundId,
                        courtId: courtId,
                        slotId: slotId,
                        userId: req.user._id,
                        teamId: teamId,
                        bookingDate: currentBookingDate,
                        message: message || `Tournament booking: ${tournament.tournamentId}`,
                        tournamentId: tournament._id,
                        isTournamentBooking: true
                    });

                    await newBooking.save({ session });
                }
            }
        }

        if (conflicts.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({
                status: false,
                data: conflicts,
                message: "Some slots could not be booked"
            });
        }

        // Create ground registration record
        const groundRegistration = new TournamentGroundRegistration({
            tournament: tournament._id,
            ground: groundId,
            team: teamId
        });

        await groundRegistration.save({ session });

        // Add team to the tournament's registered teams
        tournament.registeredTeams.push({
            team: teamId,
            tournamentTeam: tournamentTeam._id,
            paymentStatus: paymentStatus
        });

        // After adding the team to registeredTeams
        if (tournament.registeredTeams.length === tournament.teamLimit) {
            let matchResult;
            if (tournament.isClubOnly) {
                matchResult = await scheduleClubMatches(tournament);
            } else {
                matchResult = await scheduleMatches(tournament);
            }
            tournament.matches = matchResult.matches;
            tournament.endDate = matchResult.endDate;
            tournament.status = 'live';
        }
        await tournament.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            status: true,
            message: 'Team successfully joined the tournament and ground booking completed',
            data: {
                tournament: tournament,
                groundRegistration: groundRegistration,
                tournamentTeam: tournamentTeam,
                paymentStatus: paymentStatus
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error joining tournament:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update match result and progress teams to next stage
 */
export const updateMatchResult = async (req, res) => {
    try {
        const { tournamentId, matchIndex, winnerTeamId, score } = req.body;

        // Validate input
        if (!tournamentId || matchIndex === undefined || !winnerTeamId) {
            return res.status(400).json({
                status: false,
                message: 'Tournament ID, match index, and winner team ID are required',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ tournamentId }).populate('matches.teamA matches.teamB');
        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if match exists
        if (!tournament.matches || matchIndex >= tournament.matches.length) {
            return res.status(404).json({
                status: false,
                message: 'Match not found',
                data: null
            });
        }

        // Get the match
        const match = tournament.matches[matchIndex];

        // Check if match is already completed
        if (match.status === 'completed') {
            return res.status(400).json({
                status: false,
                message: 'Match is already completed',
                data: null
            });
        }

        // Verify winner is one of the teams in the match
        const teamAId = match.teamA ? match.teamA._id.toString() : null;
        const teamBId = match.teamB ? match.teamB._id.toString() : null;

        if (winnerTeamId !== teamAId && winnerTeamId !== teamBId) {
            return res.status(400).json({
                status: false,
                message: 'Winner team is not part of this match',
                data: null
            });
        }

        // Update match result
        match.result = {
            winner: winnerTeamId,
            score: score || 'No score provided'
        };
        match.status = 'completed';

        // Handle Best of 3 series
        if (match.groupName === 'Best of 3') {
            // Count wins for each team in the series
            const teamWins = {};
            teamWins[teamAId] = 0;
            teamWins[teamBId] = 0;

            // Count completed matches in the series
            let completedMatches = 0;
            tournament.matches.forEach(m => {
                if (m.groupName === 'Best of 3' && m.status === 'completed' && m.result) {
                    completedMatches++;
                    teamWins[m.result.winner.toString()]++;
                }
            });

            // Check if series is complete (team has won 2 matches)
            if (teamWins[winnerTeamId] >= 2) {
                // Series is complete, update tournament status
                tournament.status = 'completed';
                tournament.winner = winnerTeamId;
                tournament.runnerUp = winnerTeamId === teamAId ? teamBId : teamAId;

                // Record achievements
                const winningTeam = await Team.findById(tournament.winner).populate('createdBy');
                const runnerUpTeam = await Team.findById(tournament.runnerUp).populate('createdBy');

                if (runnerUpTeam && runnerUpTeam.createdBy) {
                    await User.findByIdAndUpdate(
                        runnerUpTeam.createdBy._id,
                        {
                            $push: {
                                tournamentAchievements: {
                                    tournament: tournament._id,
                                    position: 'runner-up',
                                    teamId: tournament.runnerUp,
                                }
                            }
                        }
                    );
                }

                if (winningTeam && winningTeam.createdBy) {
                    const nextTournamentType = getNextTournamentType(tournament.tournamentType);
                    if (nextTournamentType) {
                        // Create passes for winner
                        const teamPass = new TournamentPass({
                            passType: nextTournamentType,
                            team: tournament.winner,
                            issuedFor: tournament._id,
                            issuedBy: req.user._id
                        });
                        await teamPass.save();

                        const creatorPass = new TournamentPass({
                            passType: nextTournamentType,
                            team: tournament.winner,
                            issuedFor: tournament._id,
                            issuedBy: req.user._id
                        });
                        await creatorPass.save();

                        // Record achievement
                        await User.findByIdAndUpdate(
                            winningTeam.createdBy._id,
                            {
                                $push: {
                                    tournamentAchievements: {
                                        tournament: tournament._id,
                                        position: 'winner',
                                        teamId: tournament.winner,
                                    }
                                }
                            }
                        );
                    }
                }
            }
        } else {
            // Handle other match types (Round Robin, etc.)
            await progressTeamsToNextStage(tournament, matchIndex, winnerTeamId);
        }

        await tournament.save();

        return res.status(200).json({
            status: true,
            message: 'Match result updated successfully',
            data: tournament
        });
    } catch (error) {
        console.error('Error updating match result:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Helper function to progress teams to next stage based on match results
 */
const progressTeamsToNextStage = async (tournament, matchIndex, winnerTeamId) => {
    const match = tournament.matches[matchIndex];

    // If not a group match, determine next stage match
    if (match.matchType !== 'group') {
        return;
    }

    // Find all group matches
    const groupMatches = tournament.matches.filter(m =>
        m.matchType === 'group' && m.groupName === match.groupName
    );

    // Check if all group matches are completed
    const allGroupMatchesCompleted = groupMatches.every(m => m.status === 'completed');

    if (!allGroupMatchesCompleted) {
        return; // Wait until all matches in the group are completed
    }

    // Calculate team standings in the group
    const teamStats = {};

    // Initialize team stats
    for (const m of groupMatches) {
        if (m.teamA) {
            const teamAId = m.teamA._id.toString();
            if (!teamStats[teamAId]) {
                teamStats[teamAId] = { wins: 0, matches: 0, team: m.teamA };
            }
        }

        if (m.teamB) {
            const teamBId = m.teamB._id.toString();
            if (!teamStats[teamBId]) {
                teamStats[teamBId] = { wins: 0, matches: 0, team: m.teamB };
            }
        }
    }

    // Count wins for each team
    for (const m of groupMatches) {
        if (m.status === 'completed' && m.result && m.result.winner) {
            if (m.teamA) {
                const teamAId = m.teamA._id.toString();
                teamStats[teamAId].matches++;

                if (m.result.winner.toString() === teamAId) {
                    teamStats[teamAId].wins++;
                }
            }

            if (m.teamB) {
                const teamBId = m.teamB._id.toString();
                teamStats[teamBId].matches++;

                if (m.result.winner.toString() === teamBId) {
                    teamStats[teamBId].wins++;
                }
            }
        }
    }

    // Sort teams by wins
    const sortedTeams = Object.values(teamStats)
        .sort((a, b) => b.wins - a.wins);

    // Get top teams based on group standings
    const topTeams = sortedTeams.map(stat => stat.team);

    // Find next stage matches (semi-finals or final)
    let nextStageMatches;

    if (match.groupName === 'Best of 3') {
        // For 2-team tournament, winner goes directly to final
        nextStageMatches = tournament.matches.filter(m => m.matchType === 'final');

        if (nextStageMatches.length > 0) {
            nextStageMatches[0].teamA = winnerTeamId;
        }
    } else if (match.groupName.startsWith('Group')) {
        const groupName = match.groupName;

        // Find corresponding semi-final match
        if (groupName === 'Group A') {
            nextStageMatches = tournament.matches.filter(m =>
                m.matchType === 'semi-final' && m.groupName === 'SF1'
            );

            if (nextStageMatches.length > 0) {
                nextStageMatches[0].teamA = topTeams[0]; // Group winner
            }
        } else if (groupName === 'Group B') {
            nextStageMatches = tournament.matches.filter(m =>
                m.matchType === 'semi-final' && m.groupName === 'SF1'
            );

            if (nextStageMatches.length > 0) {
                nextStageMatches[0].teamB = topTeams[0]; // Group winner
            }
        }
    } else if (match.matchType === 'semi-final') {
        // Semi-final winners go to final
        const finalMatch = tournament.matches.find(m => m.matchType === 'final');

        if (finalMatch) {
            if (match.groupName === 'SF1') {
                finalMatch.teamA = winnerTeamId;
            } else if (match.groupName === 'SF2') {
                finalMatch.teamB = winnerTeamId;
            }
        }
    } else if (match.matchType === 'quarter-final') {
        // Quarter-final winners go to semi-finals
        const sfMatches = tournament.matches.filter(m => m.matchType === 'semi-final');

        if (sfMatches.length >= 2) {
            if (match.groupName === 'QF1') {
                sfMatches[0].teamA = winnerTeamId;
            } else if (match.groupName === 'QF2') {
                sfMatches[0].teamB = winnerTeamId;
            } else if (match.groupName === 'QF3') {
                sfMatches[1].teamA = winnerTeamId;
            } else if (match.groupName === 'QF4') {
                sfMatches[1].teamB = winnerTeamId;
            }
        }
    }
};

/**
 * Get all tournaments with basic details
 * Can be filtered by status (upcoming, live, completed, all)
 */
export const getAllTournaments = async (req, res) => {
    try {
        const { status, name, startDate, venue } = req.query;

        // Build filter object
        const filter = {
            isDeleted: false // Exclude deleted tournaments
        };
        
        // Add search filters if provided
        if (name) {
            filter.seriesName = { $regex: name, $options: 'i' };
        }
        
        if (startDate) {
            filter.startDate = { $gte: new Date(startDate) };
        }
        
        if (venue) {
            filter.venues = venue;
        }

        // Get tournaments with basic information
        const tournaments = await Tournament.find(filter)
            .populate('venues', 'name city address1')
            .populate('registeredTeams.team', 'teamName logo')
            .populate('winner', 'teamName logo')
            .populate('runnerUp', 'teamName logo')
            .populate('umpire', 'name')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        // Find user's teams if user is authenticated
        let userTeamIds = [];
        if (req.user) {
            const userTeams = await Team.find({ "players.player": { $in: [req.user._id] } });
            userTeamIds = userTeams.map(team => team._id.toString());
        }


        // Transform data to include team-specific status
        let transformedTournaments = tournaments.map(tournament => {
            const tournamentObj = tournament.toObject();

            // Check if user's team is part of this tournament
            const userTeamInTournament = tournamentObj.registeredTeams.some(
                rt => userTeamIds.includes(rt.team._id.toString())
            );

            // Tournament is "live" for user if their team has joined, otherwise use global status
            // Exception: if tournament is completed, it stays completed

            const teamSpecificStatus = userTeamInTournament && tournamentObj.status !== 'completed'
                ? 'live'
                : tournamentObj.status;

            return {
                ...tournamentObj,
                status: teamSpecificStatus,
                userTeamJoined: userTeamInTournament
            };
        });

        // Apply status filter if provided
        if (status && status !== 'all') {
            transformedTournaments = transformedTournaments.filter(a => a.status === status);
        }

        return res.status(200).json({
            status: true,
            message: 'Tournaments fetched successfully',
            data: transformedTournaments
        });
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get tournament by ID with detailed information
 * Including all teams, players, matches, and venue details
 */
export const getTournamentById = async (req, res) => {
    try {
        const { id } = req.params;

        // Find tournament by ID or tournamentId
        let query = {
            isDeleted: false // Exclude deleted tournaments
        };
        if (mongoose.Types.ObjectId.isValid(id)) {
            query._id = id;
        } else {
            query.tournamentId = id;
        }

        // Get tournament with detailed information
        const tournament = await Tournament.findOne(query)
            // Venue details
            .populate('venues')
            // Team details with players
            .populate({
                path: 'registeredTeams.team',
                populate: {
                    path: 'players.player',
                    model: 'User',
                    select: 'name email mobile role'
                }
            })
            // Match details with teams
            .populate('matches.teamA', 'teamName logo players')
            .populate('matches.teamB', 'teamName logo players')
            .populate('matches.venue', 'name address1 city')
            // Other details
            .populate('winner', 'teamName logo players')
            .populate('runnerUp', 'teamName logo players')
            .populate('umpire', 'name email mobile')
            .populate('createdBy', 'name email');

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Filter venue time slots to only include those with isTournament=true
        if (tournament.venues && tournament.venues.length > 0) {
            tournament.venues.forEach(venue => {
                if (venue.courts) {
                    venue.courts.forEach(court => {
                        if (court.times) {
                            court.times.forEach(time => {
                                if (time.slots) {
                                    // Filter slots to only include those with isTournament=true
                                    time.slots = time.slots.filter(slot => slot.isTournament === true);
                                }
                            });
                        }
                    });
                }
            });
        }

        // Get ground-wise registrations count
        const groundRegistrations = await TournamentGroundRegistration.aggregate([
            {
                $match: { tournament: tournament._id }
            },
            {
                $group: {
                    _id: "$ground",
                    teamCount: { $sum: 1 }
                }
            }
        ]);

        // Create a map of ground IDs to their team counts
        const groundTeamCounts = {};
        groundRegistrations.forEach(reg => {
            groundTeamCounts[reg._id.toString()] = reg.teamCount;
        });

        // Calculate probability for each venue
        const venuesWithProbability = tournament.venues.map(venue => {
            const teamCount = groundTeamCounts[venue._id.toString()] || 0;
            let probability = 0;

            if (teamCount % 2 === 0) {
                probability = 50;
            } else {
                probability = 100;
            }

            // Convert to object but preserve the already filtered slots
            const venueObj = venue.toObject ? venue.toObject() : JSON.parse(JSON.stringify(venue));

            return {
                ...venueObj,
                teamCount,
                probability
            };
        });

        // Get payment information for each team
        const payments = await Payment.find({ tournament: tournament._id })
            .populate('team', 'teamName')
            .populate('paidBy', 'name email');

        // Get FAQ, Rules, and Guidelines for the tournament
        const [faq, rules, guidelines] = await Promise.all([
            TournamentFAQ.findOne({ tournament: tournament._id }),
            TournamentRules.findOne({ tournament: tournament._id }),
            TournamentGuidelines.findOne({ tournament: tournament._id })
        ]);

        // Find user's teams if user is authenticated
        let userTeamIds = [];
        let userTeamJoined = false;
        if (req.user) {
            const userTeams = await Team.find({ "players.player": { $in: [req.user._id] } });
            userTeamIds = userTeams.map(team => team._id.toString());

            // Check if user's team is part of this tournament
            userTeamJoined = tournament.registeredTeams.some(
                rt => userTeamIds.includes(rt.team._id.toString())
            );
        }

        // Determine team-specific status
        const teamSpecificStatus = userTeamJoined && tournament.status !== 'completed'
            ? 'live'
            : tournament.status;

        // Create response with all details
        const response = {
            ...tournament.toObject(),
            venues: venuesWithProbability,
            payments: payments,
            faq: faq?.questions || [],
            rules: rules?.rules || [],
            guidelines: guidelines?.guidelines || [],
            teamSpecificStatus,
            userTeamJoined
        };

        return res.status(200).json({
            status: true,
            message: 'Tournament details fetched successfully',
            data: response
        });
    } catch (error) {
        console.error('Error fetching tournament details:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Schedule matches for teams that have already joined the tournament
 * This endpoint can be called manually to schedule matches
 */
export const scheduleTournamentMatches = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { tournamentId } = req.params;

        // Find tournament with populated fields
        const tournament = await Tournament.findOne({ tournamentId })
            .populate('umpires', 'name email mobile')
            .populate('venues', 'name city address1')
            .populate('registeredTeams.team', 'teamName logo players')
            .session(session);

        if (!tournament) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if there are enough teams to schedule matches
        if (tournament.registeredTeams.length < 2) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'At least 2 teams are required to schedule matches',
                data: null
            });
        }

        // Schedule matches based on tournament type (club-only or regular)
        let matchResult;
        if (tournament.isClubOnly) {
            matchResult = await scheduleClubMatches(tournament);
        } else {
            matchResult = await scheduleMatches(tournament);
        }
        
        tournament.matches = matchResult.matches;
        tournament.endDate = matchResult.endDate;

        // Create individual match collections
        const matchCollections = [];
        let matchNumber = 1;

        for (const match of tournament.matches) {
            // Determine match type
            let matchType = 'group';
            if (match.matchType) {
                matchType = match.matchType; // Use the match type set in scheduling
            }

            // Assign umpires in round-robin fashion
            const umpireIndex = (matchNumber - 1) % tournament.umpires.length;
            const assignedUmpires = [
                tournament.umpires[umpireIndex],
                tournament.umpires[(umpireIndex + 1) % tournament.umpires.length]
            ];

            // Create match object with only the fields we have at this point
            const matchObject = {
                tournament: tournament._id,
                matchNumber,
                venue: match.venue,
                matchDate: match.matchDate,
                matchStartTime: match.matchStartTime,
                matchEndTime: match.matchEndTime,
                status: 'scheduled',
                umpires: assignedUmpires.map(umpire => umpire._id),
                matchType: matchType,
                groupName: match.groupName,
                matchGapMinutes: tournament.matchGapMinutes,
                substitute: tournament.substitute,
                totalMember: tournament.totalMember
            };

            // Only add team fields if they exist (for knockout stages)
            if (match.teamA) matchObject.teamA = match.teamA;
            if (match.teamB) matchObject.teamB = match.teamB;

            const newMatch = new Match(matchObject);

            await newMatch.save({ session });
            matchCollections.push(newMatch);
            matchNumber++;
        }

        await tournament.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            status: true,
            message: 'Matches scheduled successfully',
            data: {
                tournament,
                matches: matchCollections
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error scheduling tournament matches:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update tournament status to live
 * This endpoint can be called manually to start the tournament
 */
export const updateTournamentStatus = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { status } = req.body;

        // Validate status
        if (!['upcoming', 'live', 'completed'].includes(status)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid status. Must be one of: upcoming, live, completed',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ tournamentId });
        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if matches are scheduled before allowing status change to live
        if (status === 'live' && (!tournament.matches || tournament.matches.length === 0)) {
            return res.status(400).json({
                status: false,
                message: 'Cannot set status to live without scheduled matches',
                data: null
            });
        }

        // Update status
        tournament.status = status;
        await tournament.save();

        return res.status(200).json({
            status: true,
            message: 'Tournament status updated successfully',
            data: tournament
        });
    } catch (error) {
        console.error('Error updating tournament status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getMyTournaments = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const userTeams = await Team.find({ players: { $in: req.user._id } });
        const teamIds = userTeams.map(team => team._id);

        const tournaments = await Tournament.find({
            tournamentId,
            'registeredTeams.team': { $in: teamIds }
        })
            .populate('venues', 'name city address1')
            .populate('registeredTeams.team', 'teamName logo')
            .populate('winner', 'teamName logo')
            .populate('runnerUp', 'teamName logo')
            .populate('umpire', 'name')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        const tournamentsWithDetails = tournaments.map(tournament => {
            const tournamentObj = tournament.toObject();

            const participatingTeams = tournament.registeredTeams
                .filter(rt => teamIds.includes(rt.team._id.toString()))
                .map(rt => ({
                    team: rt.team,
                    paymentStatus: rt.paymentStatus
                }));

            return {
                ...tournamentObj,
                participatingTeams,
                // For user's tournaments, always set teamSpecificStatus to 'live' if tournament is active
                teamSpecificStatus: tournamentObj.status === 'completed' ? 'completed' : 'live',
                userTeamJoined: true
            };
        });

        return res.status(200).json({
            status: true,
            message: 'Your tournaments fetched successfully',
            data: tournamentsWithDetails
        });
    } catch (error) {
        console.error('Error fetching user tournaments:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Soft delete a tournament
 * @access Admin only
 */
export const deleteTournament = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can delete tournaments',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ tournamentId });
        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if tournament is already deleted
        if (tournament.isDeleted) {
            return res.status(400).json({
                status: false,
                message: 'Tournament is already deleted',
                data: null
            });
        }

        // Soft delete the tournament
        tournament.isDeleted = true;
        await tournament.save();

        return res.status(200).json({
            status: true,
            message: 'Tournament deleted successfully',
            data: tournament
        });
    } catch (error) {
        console.error('Error deleting tournament:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get all club tournaments that the user has access to based on club membership
 */
export const getClubTournaments = async (req, res) => {
    try {
        // Get user's club memberships
        const userId = req.user._id;

        const user = await User.findById(userId).populate('clubs');
        
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
                data: null
            });
        }
        
        // If user is not a member of any club, return empty list
        if (!user.clubs || user.clubs.length === 0) {
            return res.status(200).json({
                status: true,
                message: 'User is not a member of any club',
                data: []
            });
        }
        
        // Get all club-only tournaments
        const clubTournaments = await Tournament.find({ 
            isClubOnly: true,
            isDeleted: false
        })
        .populate('venues', 'name city address1')
        .populate('registeredTeams.team', 'teamName logo')
        .populate('winner', 'teamName logo')
        .populate('runnerUp', 'teamName logo')
        .populate('umpire', 'name')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
        
        // Find user's teams
        const userTeams = await Team.find({ players: { $in: [userId] } });
        const userTeamIds = userTeams.map(team => team._id.toString());
        
        // Transform data to include team-specific status
        const transformedTournaments = clubTournaments.map(tournament => {
            const tournamentObj = tournament.toObject();
            
            // Check if user's team is part of this tournament
            const userTeamInTournament = tournamentObj.registeredTeams.some(
                rt => userTeamIds.includes(rt.team._id.toString())
            );
            
            // Tournament is "live" for user if their team has joined, otherwise use global status
            // Exception: if tournament is completed, it stays completed
            const teamSpecificStatus = userTeamInTournament && tournamentObj.status !== 'completed'
                ? 'live'
                : tournamentObj.status;
                
            return {
                ...tournamentObj,
                status: teamSpecificStatus,
                userTeamJoined: userTeamInTournament
            };
        });
        
        return res.status(200).json({
            status: true,
            message: 'Club tournaments fetched successfully',
            data: transformedTournaments
        });
    } catch (error) {
        console.error('Error fetching club tournaments:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get booking history for tournaments where the user's created teams participated
 * This will show all tournaments with payment information for the user's teams
 */
export const getMyTeamBookings = async (req, res) => {
    try {
        const userId = req.user._id;

        // First find all teams created by the user
        const createdTeams = await Team.find({ createdBy: userId })
            .select('_id teamName logo');

        if (createdTeams.length === 0) {
            return res.status(200).json({
                status: true,
                message: 'You have not created any teams yet.',
                data: []
            });
        }

        // Get all team IDs created by the user
        const teamIds = createdTeams.map(team => team._id);
        
        // Create a map for quick team lookup
        const teamsMap = {};
        createdTeams.forEach(team => {
            teamsMap[team._id.toString()] = team;
        });
        
        // Find all tournaments where user's created teams are registered
        const tournaments = await Tournament.find({
            'registeredTeams.team': { $in: teamIds }
        })
        .populate('venues', 'name city address1 address2 zipCode images')
        .lean();
        
        if (tournaments.length === 0) {
            return res.status(200).json({
                status: true,
                message: 'Your teams have not registered for any tournaments yet.',
                data: []
            });
        }

        // Get payment information for these tournaments and teams
        const payments = await Payment.find({
            tournament: { $in: tournaments.map(t => t._id) },
            team: { $in: teamIds }
        })
        .populate('tournament', 'tournamentId seriesName')
        .populate('team', 'teamName logo')
        .populate('paidBy', 'name email avatar mobile')
        .lean();

        // Group payments by tournament ID
        const paymentsByTournament = {};
        payments.forEach(payment => {
            const tournamentId = payment.tournament._id.toString();
            if (!paymentsByTournament[tournamentId]) {
                paymentsByTournament[tournamentId] = [];
            }
            paymentsByTournament[tournamentId].push(payment);
        });

        // Structure the response data
        const tournamentsWithTeams = tournaments.map(tournament => {
            const tournamentId = tournament._id.toString();
            
            return {
                tournament: {
                    _id: tournament._id,
                    tournamentId: tournament.tournamentId,
                    seriesName: tournament.seriesName,
                    tournamentType: tournament.tournamentType,
                    status: tournament.status,
                    startDate: tournament.startDate,
                    endDate: tournament.endDate,
                    cost: tournament.cost,
                    venues: tournament.venues,
                    payments: paymentsByTournament[tournamentId][0] || []
                }
            };
        });

        return res.status(200).json({
            status: true,
            message: 'Tournament booking history retrieved successfully',
            data: tournamentsWithTeams
        });
    } catch (error) {
        console.error('Error retrieving team booking history:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getTournaments = async (req, res) => {
    try {
        const { status, type, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query based on filters
        const query = {};
        if (status) query.status = status;
        if (type) query.tournamentType = type;

        // If user is a player, only show tournaments they are part of
        if (req.user.role === 'player') {
            const tournamentTeams = await TournamentTeam.find({
                'players.player': req.user._id,
                'players.isPlaying': true
            }).select('tournament');

            const tournamentIds = tournamentTeams.map(tt => tt.tournament);
            query._id = { $in: tournamentIds };
        }

        const tournaments = await Tournament.find(query)
            .populate('venues')
            .populate('registeredTeams.team')
            .populate('registeredTeams.tournamentTeam')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Tournament.countDocuments(query);

        return res.status(200).json({
            status: true,
            message: 'Tournaments retrieved successfully',
            data: {
                tournaments,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting tournaments:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};
