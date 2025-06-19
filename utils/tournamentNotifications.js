/**
 * Utility functions for tournament notifications
 */

/**
 * Send notification to a user about tournament invitation
 * @param {Object} user - User to notify
 * @param {Object} tournament - Tournament details
 * @param {Object} inviter - User who sent the invitation
 */
export const sendTournamentInvitation = async (user, tournament, inviter) => {
    // This is a placeholder for actual notification logic
    // In a real implementation, this would send push notifications, emails, or SMS
    
    const notificationData = {
        userId: user._id,
        type: 'TOURNAMENT_INVITATION',
        title: 'Tournament Invitation',
        message: `${inviter.username} has invited you to join the tournament: ${tournament.name}`,
        data: {
            tournamentId: tournament._id,
            tournamentName: tournament.name,
            inviterId: inviter._id,
            inviterName: inviter.username
        },
        timestamp: new Date()
    };
    
    console.log('Tournament invitation notification:', notificationData);
    
    // Implement actual notification sending here
    // e.g., saveNotification(notificationData)
    //       sendPushNotification(user.deviceTokens, notificationData)
    //       sendEmail(user.email, 'Tournament Invitation', emailTemplate)
    
    return notificationData;
};

/**
 * Send notification to a user about tournament status change
 * @param {Object} user - User to notify
 * @param {Object} tournament - Tournament details
 * @param {string} status - New tournament status
 */
export const sendTournamentStatusNotification = async (user, tournament, status) => {
    let title, message;
    
    switch (status) {
        case 'live':
            title = 'Tournament is Live';
            message = `The tournament ${tournament.name} is now live!`;
            break;
        case 'completed':
            title = 'Tournament Completed';
            message = `The tournament ${tournament.name} has been completed.`;
            break;
        case 'cancelled':
            title = 'Tournament Cancelled';
            message = `The tournament ${tournament.name} has been cancelled.`;
            break;
        default:
            title = 'Tournament Update';
            message = `The tournament ${tournament.name} status has changed to ${status}.`;
    }
    
    const notificationData = {
        userId: user._id,
        type: 'TOURNAMENT_STATUS',
        title,
        message,
        data: {
            tournamentId: tournament._id,
            tournamentName: tournament.name,
            status
        },
        timestamp: new Date()
    };
    
    console.log('Tournament status notification:', notificationData);
    
    // Implement actual notification sending here
    
    return notificationData;
};

/**
 * Send notification to a user about match updates
 * @param {Object} user - User to notify
 * @param {Object} tournament - Tournament details
 * @param {Object} match - Match details
 */
export const sendMatchUpdateNotification = async (user, tournament, match) => {
    const winnerTeam = match.winner ? 'Winner: Team ' + match.winner : 'Match in progress';
    
    const notificationData = {
        userId: user._id,
        type: 'MATCH_UPDATE',
        title: 'Match Update',
        message: `Match update for ${tournament.name}: ${winnerTeam}`,
        data: {
            tournamentId: tournament._id,
            tournamentName: tournament.name,
            matchId: match._id,
            status: match.status,
            winner: match.winner
        },
        timestamp: new Date()
    };
    
    console.log('Match update notification:', notificationData);
    
    // Implement actual notification sending here
    
    return notificationData;
};

/**
 * Send notification about new tournament availability
 * @param {Object} user - User to notify
 * @param {Object} tournament - Tournament details
 */
export const sendNewTournamentNotification = async (user, tournament) => {
    const notificationData = {
        userId: user._id,
        type: 'NEW_TOURNAMENT',
        title: 'New Tournament Available',
        message: `A new tournament is now available: ${tournament.name}`,
        data: {
            tournamentId: tournament._id,
            tournamentName: tournament.name,
            type: tournament.type,
            startDate: tournament.startDate
        },
        timestamp: new Date()
    };
    
    console.log('New tournament notification:', notificationData);
    
    // Implement actual notification sending here
    
    return notificationData;
};

/**
 * Send notification when a tournament pass is awarded
 * @param {Object} user - User to notify
 * @param {Object} tournament - Tournament where pass was earned
 * @param {Object} pass - Pass details
 */
export const sendPassAwardedNotification = async (user, tournament, pass) => {
    let passTypeName;
    switch (pass.passType) {
        case 'warriors-cup-x':
            passTypeName = 'Warriors Cup X';
            break;
        case 'commanders-cup':
            passTypeName = 'Commanders Cup';
            break;
        default:
            passTypeName = 'Tournament';
    }
    
    const notificationData = {
        userId: user._id,
        type: 'PASS_AWARDED',
        title: 'Tournament Pass Awarded',
        message: `Congratulations! You've earned a ${passTypeName} pass for winning ${tournament.name}`,
        data: {
            tournamentId: tournament._id,
            tournamentName: tournament.name,
            passId: pass._id,
            passType: pass.passType,
            expiryDate: pass.expiryDate
        },
        timestamp: new Date()
    };
    
    console.log('Pass awarded notification:', notificationData);
    
    // Implement actual notification sending here
    
    return notificationData;
}; 