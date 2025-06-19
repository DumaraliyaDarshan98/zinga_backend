import Club from "../models/Club.js";
import RequestClub from "../models/RequestClub.js";
import User from "../models/User.js";
import VoteClub from "../models/VoteClub.js";
import mongoose from "mongoose";
import Tournament from "../models/Tournament.js";

export const createClub = async (req, res) => {
    try {
        const { name, members, logo, description, joiningSettings } = req.body;
        const createdBy = req.user.id;

        const existingClub = await Club.findOne({ name });
        if (existingClub) {
            return res.status(400).json({ data: null, status: false, message: "Club name already exists." });
        }

        const userIds = [{ userId: createdBy }];
        if (members && members.length) {
            const promises = members.map(async ({ name, email, mobile }) => {
                const userExists = await User.findOne({ email: email?.toLowerCase() });

                if (!userExists) {
                    const data = {
                        name,
                        email,
                        password: mobile,
                        mobile
                    };
                    const id = await User.create(data);
                    userIds.push({ userId: id._id });
                } else {
                    userIds.push({ userId: userExists._id });
                }
            });

            await Promise.all(promises);
        }

        const newClub = new Club({
            name,
            members: userIds,
            isActive: members?.length >= 20 ? true : false,
            createdBy,
            captains: createdBy,
            logo,
            description,
            joiningSettings
        });

        await newClub.save();

        await User.updateMany(
            { _id: { $in: userIds.map(({ userId }) => userId) } },
            { $push: { clubs: newClub._id } }
        );

        res.status(201).json({
            message: "Club created successfully.",
            data: newClub,
            status: true,
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const getAllClubs = async (req, res) => {
    const { search, isActive } = req.query;
    const userId = req.user.id;

    try {
        const filter = {};
        if (search) filter.name = { $regex: search, $options: "i" };
        if (isActive) filter.isActive = isActive === "true";

        const club = await Club.find({
            members: { $elemMatch: { userId: userId } }
        }).populate('createdBy', 'name email');

        if (club.length) {
            return res.status(200).json({
                data: club,
                status: true,
                joined: true,
                message: "Club fetched successfully",
            });
        }

        const clubs = await Club.find(filter);

        res.status(200).json({ data: clubs, status: true, message: "Clubs fetched successfully", joined: false });
    } catch (error) {
        res.status(500).json({ message: error.message, data: null, status: true });
    }
};

export const getClubDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const club = await Club.findById(id)
            .populate({
                path: "members.userId",
                select: "name email role mobile groundAdded",
                populate: {
                    path: "groundAdded",
                    model: "Ground",
                    select: "name"
                }
            })
            .populate("captains", "name email")
            .populate("createdBy", "name email")
            .populate("tournaments", "tournamentId seriesName startDate endDate status");


        if (!club) {
            return res.status(404).json({ data: null, status: false, message: "Club not found." });
        }

        const requests = await RequestClub.find({ clubId: id }).select('userId').populate("userId", "name email");
        const captainsRequest = await VoteClub.find({ clubId: id }).select("userId votes").populate("userId", "name email");
        const user = await User.findById(userId)
            .select("groundAdded")
            .populate("groundAdded", "name");

        const homeGround = user?.groundAdded?.[0]?.name || "";

        // Process members data to include tournament participation
        const membersWithTournaments = club.members.map(member => {
            // Get tournament status for each member
            const tournamentData = member.tournaments ? 
                member.tournaments.map(tournamentEntry => {
                    // Find the tournament in club tournaments
                    const tournament = club.tournaments.find(t => 
                        t._id.toString() === tournamentEntry.tournamentId?.toString()
                    );
                    
                    return {
                        tournament: tournament || tournamentEntry.tournamentId,
                        joinStatus: tournamentEntry.joinStatus,
                        joinedAt: tournamentEntry.joinedAt
                    };
                }) : [];
            
            const memberData = member.toObject();
            memberData.tournamentParticipation = tournamentData;
            return memberData;
        });

        // Include the current user's tournament status
        const currentUserMember = membersWithTournaments.find(
            member => member.userId._id.toString() === userId
        );

        const userTournamentStatus = currentUserMember ? 
            currentUserMember.tournamentParticipation : [];

        res.status(200).json({ 
            data: { 
                ...club.toObject(), 
                requests, 
                captainsRequest, 
                homeGround,
                membersWithTournaments,
                userTournamentStatus
            }, 
            status: true, 
            message: "Clubs fetched successfully" 
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching club details.", message: error.message, status: false, data: null });
    }
};

export const joinClub = async (req, res) => {
    try {
        const { clubId } = req.body;
        const userId = req.user.id;

        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ data: null, status: false, message: "Club not found." });
        }

        if (club.members.some((member) => member.userId.toString() === userId)) {
            return res.status(400).json({ data: null, status: false, message: "You are already a member of this club." });
        }

        if (club.joiningSettings === "request") {
            // Check if the request already exists
            const existingRequest = await RequestClub.findOne({ userId, clubId });
            if (existingRequest) {
                return res.status(400).json({ data: null, status: false, message: "You have already sent a request to join this club." });
            }

            // Create a new join request
            const request = new RequestClub({ userId, clubId });
            await request.save();

            return res.status(200).json({ message: "Join request sent successfully.", data: request, status: true });
        }

        club.members.push({ userId });
        if (club?.members?.length >= 20) {
            club.isActive = true;
        }
        await club.save();

        await User.findByIdAndUpdate(userId, { $push: { clubs: clubId } });

        res.status(200).json({ message: "Successfully joined the club.", data: club, status: true });
    } catch (error) {
        res.status(500).json({ message: "Error joining club.", message: error.message, status: false, data: null });
    }
};

export const leaveClub = async (req, res) => {
    try {
        const { clubId } = req.body;
        const userId = req.user.id;

        const club = await Club.findById(clubId);

        if (!club) {
            return res.status(404).json({ data: null, status: false, message: "Club not found." });
        }

        const member = club.members.find(
            (member) => member.userId.toString() === userId
        );

        if (!member) {
            return res.status(400).json({ data: null, status: false, message: "You are not a member of this club." });
        }

        const joinDate = new Date(member.joinDate);
        const now = new Date();

        const daysInClub = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
        if (daysInClub < 30) {
            return res.status(400).json({
                data: null, status: false,
                message: `You cannot leave this club yet. You must remain in the club for at least 30 days.`,
            });
        }

        club.members = club.members.filter(
            (member) => member.userId.toString() !== userId
        );

        if (club?.members?.length < 20) {
            club.isActive = false;
        }

        await club.save();

        await User.findByIdAndUpdate(userId, { $pull: { clubs: clubId } });

        res.status(200).json({ message: "Successfully left the club.", data: club, status: false });
    } catch (error) {
        res.status(500).json({ message: "Error leaving club.", message: error.message, status: false, data: null });
    }
};

export const applyForCaptain = async (req, res) => {
    try {
        const { clubId } = req.params;
        const userId = req.user.id;

        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ message: "Club not found", status: false });
        }

        if (!club.members.some((member) => member.userId.toString() === userId)) {
            return res.status(403).json({ message: "You are not a member of this club", status: false, data: null });
        }

        const existingApplication = await VoteClub.findOne({ clubId, userId });
        if (existingApplication) {
            return res.status(400).json({ message: "You have already applied for captaincy", status: false, data: null });
        }

        const newVoteClub = new VoteClub({ userId, clubId, votes: [] });
        await newVoteClub.save();

        res.status(201).json({ message: "Application submitted successfully", status: true, data: newVoteClub });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const removeCaptain = async (req, res) => {
    try {
        const { userId } = req.params;

        const voteClub = await VoteClub.findOne({ userId });
        if (!voteClub) {
            return res.status(404).json({ message: "Captain application not found", status: false, data: null });
        }

        const club = await Club.findById(voteClub.clubId);
        if (!club) {
            return res.status(404).json({ message: "Club not found", status: false, data: null });
        }

        if (club.captains.toString() !== voteClub.userId.toString()) {
            return res.status(403).json({ message: "You are not the captain of this club", status: false, data: null });
        }

        club.captains = null;
        await club.save();
        res.status(200).json({ message: "Captain removed successfully", status: true, data: club });

    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const voteForCaptain = async (req, res) => {
    try {
        const { voteId } = req.body;
        const voterId = req.user.id;

        const voteClub = await VoteClub.findById(voteId);
        if (!voteClub) {
            return res.status(404).json({ message: "Player has not applied for captaincy", status: false, data: null });
        }

        if (voteClub.votes.includes(voterId)) {
            return res.status(403).json({ message: "You have already voted for this player", status: false, data: null });
        }

        voteClub.votes.push(voterId);
        await voteClub.save();

        res.status(200).json({ message: "Vote registered successfully", status: true, data: voteClub });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const approveCaptain = async (req, res) => {
    try {
        const { voteId } = req.body;

        const captainApplication = await VoteClub.findById(voteId);
        if (!captainApplication) {
            return res.status(404).json({ message: "Captain application not found", status: false, data: null });
        }

        const club = await Club.findById(captainApplication.clubId);
        if (!club) {
            return res.status(404).json({ message: "Club not found", status: false, data: null });
        }

        club.captains = captainApplication.userId;
        await club.save();

        await VoteClub.deleteMany({ clubId: captainApplication.clubId });

        res.status(200).json({ message: "Captain approved successfully", status: true, data: club });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const updateClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const { name, members, logo, description, joiningSettings } = req.body;

        // Find the existing club
        const existingClub = await Club.findById(clubId);
        if (!existingClub) {
            return res.status(404).json({ data: null, status: false, message: "Club not found." });
        }

        // Check if the new name already exists (excluding the current club)
        if (name && name !== existingClub.name) {
            const duplicateClub = await Club.findOne({ name });
            if (duplicateClub) {
                return res.status(400).json({ data: null, status: false, message: "Club name already exists." });
            }
        }

        let userIds = [];

        if (members && members.length > 0) {
            const promises = members.map(async ({ name, email, mobile }) => {
                const userExists = await User.findOne({ email: email?.toLowerCase() });

                if (!userExists) {
                    const data = {
                        name,
                        email,
                        password: mobile,
                        mobile
                    };
                    const newUser = await User.create(data);
                    userIds.push({ userId: newUser._id });
                } else {
                    userIds.push({ userId: userExists._id });
                }
            });

            await Promise.all(promises);
        }

        // Remove users that are no longer in the club
        const existingMemberIds = existingClub.members.map(m => m.userId.toString());
        const newMemberIds = userIds.map(m => m.userId.toString());

        const removedMembers = existingMemberIds.filter(id => !newMemberIds.includes(id));

        await User.updateMany(
            { _id: { $in: removedMembers } },
            { $pull: { clubs: existingClub._id } }
        );

        await User.updateMany(
            { _id: { $in: newMemberIds } },
            { $addToSet: { clubs: existingClub._id } }
        );

        // Update club details
        existingClub.name = name || existingClub.name;
        existingClub.members = userIds;
        existingClub.logo = logo || existingClub.logo;
        existingClub.description = description || existingClub.description;
        existingClub.joiningSettings = joiningSettings || existingClub.joiningSettings;
        existingClub.isActive = userIds.length >= 20;

        await existingClub.save();

        res.status(200).json({
            message: "Club updated successfully.",
            data: existingClub,
            status: true,
        });

    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const requestProcessClub = async (req, res) => {
    try {
        const { id } = req.params;
        const { allow } = req.query;

        const request = await RequestClub.findById(id);

        if (!request) {
            return res.status(404).json({ data: null, status: false, message: "Request not found." });
        }

        const { clubId, userId } = request;
        if (allow === "true") {
            const club = await Club.findById(clubId);
            if (!club) {
                return res.status(404).json({ data: null, status: false, message: "Club not found." });
            }

            if (club.members.some((member) => member.userId.toString() === userId)) {
                return res.status(400).json({ data: null, status: false, message: "You are already a member of this club." });
            }

            club.members.push({ userId });
            await club.save();

            await User.findByIdAndUpdate(userId, { $push: { clubs: clubId } });

            await RequestClub.deleteMany({ userId });

        } else {
            await RequestClub.findByIdAndDelete(id);
        }


        return res.status(200).json({
            message: allow === "true" ? "Request accepted successfully." : "Request rejected successfully.",
            data: null,
            status: true,
        });


    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
}

/**
 * Simple API for club to join tournament
 * @route POST /api/clubs/join-tournament
 * @access Private - Club captains only
 */
export const clubJoinTournament = async (req, res) => {
    try {
        const { clubId, tournamentId } = req.body;
        const userId = req.user.id;

        if (!clubId || !tournamentId) {
            return res.status(400).json({
                status: false,
                message: 'Club ID and Tournament ID are required',
                data: null
            });
        }

        // Find the club
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({
                status: false,
                message: 'Club not found',
                data: null
            });
        }

        // Check if user is club captain
        if (!club.captains || club.captains.toString() !== userId) {
            return res.status(403).json({
                status: false,
                message: 'Only club captains can register for tournaments',
                data: null
            });
        }

        // Find the tournament
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if club already joined
        if (club.tournaments && club.tournaments.includes(tournamentId)) {
            return res.status(400).json({
                status: false,
                message: 'Club already joined this tournament',
                data: null
            });
        }

        // Add tournament to club
        if (!club.tournaments) {
            club.tournaments = [];
        }
        club.tournaments.push(tournamentId);

        // Initialize tournament status for all members
        club.members.forEach(member => {
            if (!member.tournaments) {
                member.tournaments = [];
            }
            
            member.tournaments.push({
                tournamentId,
                joinStatus: 'pending',
                joinedAt: null
            });
        });

        await club.save();
        
        // Get populated club data for the response and broadcast
        const populatedClub = await Club.findById(clubId)
            .populate({
                path: "tournaments",
                select: "tournamentId seriesName startDate endDate status"
            })
            .populate("captains", "name email");

        // Broadcast tournament join event to all club members
        if (global.io) {
            global.io.to(`club:${clubId}`).emit('clubUpdate', {
                type: 'TOURNAMENT_JOINED',
                clubId,
                tournamentId,
                tournament: tournament,
                updatedBy: {
                    userId,
                    role: 'captain'
                },
                timestamp: new Date()
            });
            console.log(`Club tournament join update broadcast to club:${clubId}`);
        }

        return res.status(200).json({
            status: true,
            message: 'Club successfully joined tournament',
            data: populatedClub
        });
    } catch (error) {
        console.error('Error joining tournament:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Simple API for member to join/leave tournament
 * @route POST /api/clubs/member-join-tournament
 * @access Private - Club members
 */
export const memberJoinTournament = async (req, res) => {
    try {
        const { clubId, tournamentId, status } = req.body;
        const userId = req.user.id;

        if (!clubId || !tournamentId || !status) {
            return res.status(400).json({
                status: false,
                message: 'Club ID, Tournament ID, and status are required',
                data: null
            });
        }

        // Validate status
        if (!['joined', 'declined'].includes(status)) {
            return res.status(400).json({
                status: false,
                message: 'Status must be either "joined" or "declined"',
                data: null
            });
        }

        // Find the club
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({
                status: false,
                message: 'Club not found',
                data: null
            });
        }

        // Check if user is club member
        const memberIndex = club.members.findIndex(
            member => member.userId.toString() === userId
        );

        if (memberIndex === -1) {
            return res.status(403).json({
                status: false,
                message: 'You are not a member of this club',
                data: null
            });
        }

        // Update member's tournament status
        if (!club.members[memberIndex].tournaments) {
            club.members[memberIndex].tournaments = [];
        }

        const tournamentIndex = club.members[memberIndex].tournaments.findIndex(
            t => t.tournamentId && t.tournamentId.toString() === tournamentId
        );

        if (tournamentIndex === -1) {
            // Add tournament entry if it doesn't exist
            club.members[memberIndex].tournaments.push({
                tournamentId,
                joinStatus: status,
                joinedAt: status === 'joined' ? new Date() : null
            });
        } else {
            // Update existing tournament entry
            club.members[memberIndex].tournaments[tournamentIndex].joinStatus = status;
            club.members[memberIndex].tournaments[tournamentIndex].joinedAt = 
                status === 'joined' ? new Date() : null;
        }

        await club.save();
        
        // Find user info for broadcast
        const user = await User.findById(userId).select('name email');

        // Get tournament info for broadcast
        const tournament = await Tournament.findById(tournamentId)
            .select('tournamentId seriesName startDate endDate status');

        // Broadcast member tournament status update to all club members
        if (global.io) {
            global.io.to(`club:${clubId}`).emit('clubUpdate', {
                type: 'MEMBER_TOURNAMENT_STATUS_CHANGED',
                clubId,
                tournamentId,
                tournament: tournament,
                member: {
                    userId,
                    name: user?.name,
                    email: user?.email
                },
                status,
                timestamp: new Date()
            });
            console.log(`Member tournament status update broadcast to club:${clubId}`);
        }

        return res.status(200).json({
            status: true,
            message: `Successfully ${status === 'joined' ? 'joined' : 'declined'} the tournament`,
            data: club
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