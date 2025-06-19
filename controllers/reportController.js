import Report from '../models/Report.js';
import CommunityPost from '../models/Community.js';
import { Roles } from '../constant/role.js';

/**
 * Create a new report for community content
 */
export const createReport = async (req, res) => {
    try {
        const { reportedContentId, reportType, description } = req.body;

        // Validate input
        if (!reportedContentId || !reportType || !description) {
            return res.status(400).json({
                status: false,
                message: 'Reported content ID, report type, and description are required',
                data: null
            });
        }

        // Check if the reported content exists
        const reportedContent = await CommunityPost.findById(reportedContentId);
        if (!reportedContent) {
            return res.status(404).json({
                status: false,
                message: 'Reported content not found',
                data: null
            });
        }

        // Check if user has already reported this content
        const existingReport = await Report.findOne({
            reporter: req.user._id,
            reportedContent: reportedContentId
        });

        if (existingReport) {
            return res.status(400).json({
                status: false,
                message: 'You have already reported this content',
                data: null
            });
        }

        // Create new report
        const report = new Report({
            reporter: req.user._id,
            reportedContent: reportedContentId,
            reportType,
            description,
            hideFromReporter: true // Hide content from reporter by default
        });

        await report.save();

        // Update the community post to hide it from the reporter
        await CommunityPost.findByIdAndUpdate(reportedContentId, {
            $addToSet: { hiddenFromUsers: req.user._id }
        });

        return res.status(201).json({
            status: true,
            message: 'Report submitted successfully',
            data: report
        });
    } catch (error) {
        console.error('Error creating report:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get all reports (admin only)
 */
export const getAllReports = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can view all reports',
                data: null
            });
        }

        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) {
            query.status = status;
        }

        // Get reports with pagination
        const reports = await Report.find(query)
            .populate('reporter', 'name email')
            .populate('reportedContent', 'desc url')
            .populate('resolvedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await Report.countDocuments(query);

        return res.status(200).json({
            status: true,
            message: 'Reports fetched successfully',
            data: {
                reports,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get reports submitted by a specific user
 */
export const getUserReports = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const reports = await Report.find({ reporter: req.user._id })
            .populate('reportedContent', 'desc url')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Report.countDocuments({ reporter: req.user._id });

        return res.status(200).json({
            status: true,
            message: 'Your reports fetched successfully',
            data: {
                reports,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user reports:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update report status (admin only)
 */
export const updateReportStatus = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can update report status',
                data: null
            });
        }

        const { reportId } = req.params;
        const { status, adminNotes, hideFromReporter } = req.body;

        // Validate status
        if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid status',
                data: null
            });
        }

        // Find report
        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({
                status: false,
                message: 'Report not found',
                data: null
            });
        }

        // Update report
        report.status = status;
        report.adminNotes = adminNotes;
        if (typeof hideFromReporter === 'boolean') {
            report.hideFromReporter = hideFromReporter;
        }

        if (status === 'resolved' || status === 'dismissed') {
            report.resolvedBy = req.user._id;
            report.resolvedAt = new Date();
        }

        await report.save();

        // Update content visibility based on report status and hideFromReporter setting
        if (status === 'resolved') {
            if (report.hideFromReporter) {
                // Hide content from reporter
                await CommunityPost.findByIdAndUpdate(report.reportedContent, {
                    $addToSet: { hiddenFromUsers: report.reporter }
                });
            } else {
                // Show content to reporter
                await CommunityPost.findByIdAndUpdate(report.reportedContent, {
                    $pull: { hiddenFromUsers: report.reporter }
                });
            }

            // If report is for inappropriate content, handle the reported content
            if (report.reportType === 'inappropriate_content') {
                await CommunityPost.findByIdAndUpdate(report.reportedContent, {
                    isHidden: true,
                    hiddenReason: adminNotes
                });
            }
        }

        return res.status(200).json({
            status: true,
            message: 'Report status updated successfully',
            data: report
        });
    } catch (error) {
        console.error('Error updating report status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get report details by ID
 */
export const getReportById = async (req, res) => {
    try {
        const { reportId } = req.params;

        // Find report
        const report = await Report.findById(reportId)
            .populate('reporter', 'name email')
            .populate('reportedContent', 'desc url')
            .populate('resolvedBy', 'name email');

        if (!report) {
            return res.status(404).json({
                status: false,
                message: 'Report not found',
                data: null
            });
        }

        // Check if user has permission to view this report
        if (req.user.role !== Roles.ADMIN && report.reporter.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: false,
                message: 'You do not have permission to view this report',
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Report details fetched successfully',
            data: report
        });
    } catch (error) {
        console.error('Error fetching report details:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}; 