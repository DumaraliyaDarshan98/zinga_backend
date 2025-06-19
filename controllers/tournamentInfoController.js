import TournamentFAQ from '../models/TournamentFAQ.js';
import TournamentRules from '../models/TournamentRules.js';
import TournamentGuidelines from '../models/TournamentGuidelines.js';
import Tournament from '../models/Tournament.js';
import mongoose from 'mongoose';
import { Roles } from '../constant/role.js';

// FAQ Controllers
export const createTournamentFAQ = async (req, res) => {
    try {
        const { tournamentId, questions } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament FAQs',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if FAQ already exists for this tournament
        let faq = await TournamentFAQ.findOne({ tournament: tournament._id });

        if (faq) {
            return res.status(409).json({
                status: false,
                message: 'FAQ already exists for this tournament. Use update API.',
                data: null
            });
        }

        // Create new FAQ
        faq = new TournamentFAQ({
            tournament: tournament._id,
            questions,
            createdBy: req.user.id
        });

        await faq.save();

        return res.status(201).json({
            status: true,
            message: 'Tournament FAQ created successfully',
            data: faq
        });
    } catch (error) {
        console.error('Error creating tournament FAQ:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getTournamentFAQByTournamentId = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Find tournament
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find FAQ
        const faq = await TournamentFAQ.findOne({ tournament: tournament._id })
            .populate('createdBy', 'name');

        if (!faq) {
            return res.status(404).json({
                status: false,
                message: 'FAQ not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament FAQ fetched successfully',
            data: faq
        });
    } catch (error) {
        console.error('Error fetching tournament FAQ:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const updateTournamentFAQ = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { questions } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament FAQs',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find and update FAQ
        const faq = await TournamentFAQ.findOneAndUpdate(
            { tournament: tournament._id },
            { questions },
            { new: true, runValidators: true }
        );

        if (!faq) {
            return res.status(404).json({
                status: false,
                message: 'FAQ not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament FAQ updated successfully',
            data: faq
        });
    } catch (error) {
        console.error('Error updating tournament FAQ:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const deleteTournamentFAQ = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament FAQs',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Delete FAQ
        const result = await TournamentFAQ.findOneAndDelete({ tournament: tournament._id });

        if (!result) {
            return res.status(404).json({
                status: false,
                message: 'FAQ not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament FAQ deleted successfully',
            data: null
        });
    } catch (error) {
        console.error('Error deleting tournament FAQ:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

// Rules Controllers
export const createTournamentRules = async (req, res) => {
    try {
        const { tournamentId, rules } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament rules',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if rules already exist for this tournament
        let tournamentRules = await TournamentRules.findOne({ tournament: tournament._id });

        if (tournamentRules) {
            return res.status(409).json({
                status: false,
                message: 'Rules already exist for this tournament. Use update API.',
                data: null
            });
        }

        // Create new rules
        tournamentRules = new TournamentRules({
            tournament: tournament._id,
            rules,
            createdBy: req.user.id
        });

        await tournamentRules.save();

        return res.status(201).json({
            status: true,
            message: 'Tournament rules created successfully',
            data: tournamentRules
        });
    } catch (error) {
        console.error('Error creating tournament rules:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getTournamentRulesByTournamentId = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find rules
        const rules = await TournamentRules.findOne({ tournament: tournament._id })
            .populate('createdBy', 'name');

        if (!rules) {
            return res.status(404).json({
                status: false,
                message: 'Rules not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament rules fetched successfully',
            data: rules
        });
    } catch (error) {
        console.error('Error fetching tournament rules:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const updateTournamentRules = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { rules } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament rules',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find and update rules
        const tournamentRules = await TournamentRules.findOneAndUpdate(
            { tournament: tournament._id },
            { rules },
            { new: true, runValidators: true }
        );

        if (!tournamentRules) {
            return res.status(404).json({
                status: false,
                message: 'Rules not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament rules updated successfully',
            data: tournamentRules
        });
    } catch (error) {
        console.error('Error updating tournament rules:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const deleteTournamentRules = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament rules',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Delete rules
        const result = await TournamentRules.findOneAndDelete({ tournament: tournament._id });

        if (!result) {
            return res.status(404).json({
                status: false,
                message: 'Rules not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament rules deleted successfully',
            data: null
        });
    } catch (error) {
        console.error('Error deleting tournament rules:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

// Guidelines Controllers
export const createTournamentGuidelines = async (req, res) => {
    try {
        const { tournamentId, guidelines } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament guidelines',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Check if guidelines already exist for this tournament
        let tournamentGuidelines = await TournamentGuidelines.findOne({ tournament: tournament._id });

        if (tournamentGuidelines) {
            return res.status(409).json({
                status: false,
                message: 'Guidelines already exist for this tournament. Use update API.',
                data: null
            });
        }

        // Create new guidelines
        tournamentGuidelines = new TournamentGuidelines({
            tournament: tournament._id,
            guidelines,
            createdBy: req.user.id
        });

        await tournamentGuidelines.save();

        return res.status(201).json({
            status: true,
            message: 'Tournament guidelines created successfully',
            data: tournamentGuidelines
        });
    } catch (error) {
        console.error('Error creating tournament guidelines:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const getTournamentGuidelinesByTournamentId = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find guidelines
        const guidelines = await TournamentGuidelines.findOne({ tournament: tournament._id })
            .populate('createdBy', 'name');

        if (!guidelines) {
            return res.status(404).json({
                status: false,
                message: 'Guidelines not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament guidelines fetched successfully',
            data: guidelines
        });
    } catch (error) {
        console.error('Error fetching tournament guidelines:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const updateTournamentGuidelines = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { guidelines } = req.body;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament guidelines',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Find and update guidelines
        const tournamentGuidelines = await TournamentGuidelines.findOneAndUpdate(
            { tournament: tournament._id },
            { guidelines },
            { new: true, runValidators: true }
        );

        if (!tournamentGuidelines) {
            return res.status(404).json({
                status: false,
                message: 'Guidelines not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament guidelines updated successfully',
            data: tournamentGuidelines
        });
    } catch (error) {
        console.error('Error updating tournament guidelines:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

export const deleteTournamentGuidelines = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Check if admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can manage tournament guidelines',
                data: null
            });
        }

        // Find tournament
        const tournament = await Tournament.findOne({ 
            _id: tournamentId,
            isDeleted: false // Exclude deleted tournaments
        });

        if (!tournament) {
            return res.status(404).json({
                status: false,
                message: 'Tournament not found',
                data: null
            });
        }

        // Delete guidelines
        const result = await TournamentGuidelines.findOneAndDelete({ tournament: tournament._id });

        if (!result) {
            return res.status(404).json({
                status: false,
                message: 'Guidelines not found for this tournament',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Tournament guidelines deleted successfully',
            data: null
        });
    } catch (error) {
        console.error('Error deleting tournament guidelines:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}; 