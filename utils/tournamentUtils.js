/**
 * Utility functions for tournament operations
 */

/**
 * Determines the tournament format based on the number of teams
 * @param {number} teamsCount - Number of teams in the tournament
 * @param {string} tournamentType - Type of tournament ('warriors-cup', 'warriors-cup-x', 'commanders-cup')
 * @returns {string} The tournament format
 */
export const determineTournamentFormat = (teamsCount, tournamentType) => {
    if (tournamentType === 'commanders-cup') {
        if (teamsCount === 32) {
            return 'group-stage';
        }
        return 'pending'; // Not enough teams yet
    }
    
    // For Warriors Cup and Warriors Cup X
    switch (teamsCount) {
        case 2:
            return 'best-of-3';
        case 4:
            return 'round-robin';
        case 6:
            return 'round-robin-plus-best-of-3';
        case 8:
            return 'group-stage';
        default:
            return 'pending';
    }
};

/**
 * Calculates the probability of a tournament happening at a ground
 * @param {number} teamsCount - Number of teams that have booked a slot
 * @returns {number} The probability percentage
 */
export const calculateTournamentProbability = (teamsCount) => {
    if (teamsCount === 0) return 50;
    if (teamsCount === 1) return 100;
    return 50; // For 3rd+ teams
};

/**
 * Checks if a ground can host a tournament based on city limits
 * @param {Array} grounds - List of grounds in the city
 * @param {Object} cityLimit - City limit configuration
 * @param {string} groundId - ID of the ground to check
 * @returns {boolean} Whether the ground can host a tournament
 */
export const canGroundHostTournament = (grounds, cityLimit, groundId) => {
    if (!cityLimit) return true; // No limits set
    
    // Filter grounds that have 2 or more teams registered
    const eligibleGrounds = grounds.filter(ground => 
        ground.bookingCount >= 2 && 
        ground.bookingCount % 2 === 0
    );
    
    // Sort by booking count (highest first)
    eligibleGrounds.sort((a, b) => b.bookingCount - a.bookingCount);
    
    // Take only the top N grounds based on daily limit
    const selectedGrounds = eligibleGrounds.slice(0, cityLimit.dailyLimit);
    
    // Check if our ground is in the selected list
    return selectedGrounds.some(ground => ground.ground._id.toString() === groundId);
};

/**
 * Gets the reward type for a tournament winner
 * @param {string} tournamentType - Type of tournament
 * @returns {Object} The reward information
 */
export const getTournamentReward = (tournamentType) => {
    switch (tournamentType) {
        case 'warriors-cup':
            return {
                passType: 'warriors-cup-x',
                description: 'PASS to the Warriors Cup X tournament'
            };
        case 'warriors-cup-x':
            return {
                passType: 'commanders-cup',
                description: 'PASS to the Commanders Cup tournament'
            };
        case 'commanders-cup':
            return {
                passType: 'none',
                description: 'Exclusive tournament qualification and rewards'
            };
        default:
            return {
                passType: 'none',
                description: 'No reward specified'
            };
    }
}; 