import CommunityPost from '../models/Community.js';
import { Roles } from '../constant/role.js';

/**
 * Create a new report for a comment
 */
export const createCommentReport = async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { reportType, description } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!reportType || !description) {
            return res.status(400).json({
                status: false,
                message: 'Report type and description are required',
                data: null
            });
        }

        // Find the post and comment
        const post = await CommunityPost.findById(postId);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
                data: null
            });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({
                status: false,
                message: 'Comment not found',
                data: null
            });
        }

        // Check if user has already reported this comment
        const hasReported = comment.reports.some(
            report => report.reporter.toString() === userId.toString()
        );

        if (hasReported) {
            return res.status(400).json({
                status: false,
                message: 'You have already reported this comment',
                data: null
            });
        }

        // Add report to comment
        comment.reports.push({
            reporter: userId,
            reportType,
            description
        });

        // Hide comment from reporter
        if (!comment.hiddenFromUsers.includes(userId)) {
            comment.hiddenFromUsers.push(userId);
        }

        await post.save();

        const updatedPost = await CommunityPost.findById(postId)
            .populate('postedBy', 'name email')
            .populate('likes', 'name email')
            .populate('comments.user', 'name email');

        return res.status(201).json({
            status: true,
            message: 'Comment reported successfully',
            data: updatedPost
        });
    } catch (error) {
        console.error('Error reporting comment:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get all reported comments (admin only)
 */
export const getAllCommentReports = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can view all comment reports',
                data: null
            });
        }

        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Find all posts with reported comments
        const posts = await CommunityPost.find({
            'comments.reports': { $exists: true, $ne: [] }
        })
        .populate('postedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('comments.reports.reporter', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // Format the response to show only reported comments
        const reportedComments = posts.flatMap(post => 
            post.comments
                .filter(comment => comment.reports && comment.reports.length > 0)
                .map(comment => ({
                    postId: post._id,
                    postDesc: post.desc,
                    commentId: comment._id,
                    comment: comment.comment,
                    commentUser: comment.user,
                    reports: comment.reports,
                    isHidden: comment.isHidden,
                    hiddenFromUsers: comment.hiddenFromUsers
                }))
        );

        const total = await CommunityPost.countDocuments({
            'comments.reports': { $exists: true, $ne: [] }
        });

        return res.status(200).json({
            status: true,
            message: 'Comment reports fetched successfully',
            data: {
                reportedComments,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching comment reports:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Get user's reported comments
 */
export const getUserCommentReports = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const posts = await CommunityPost.find({
            'comments.reports.reporter': req.user._id
        })
        .populate('postedBy', 'name email')
        .populate('comments.user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // Format the response to show only user's reported comments
        const userReportedComments = posts.flatMap(post => 
            post.comments
                .filter(comment => 
                    comment.reports.some(report => 
                        report.reporter.toString() === req.user._id.toString()
                    )
                )
                .map(comment => ({
                    postId: post._id,
                    postDesc: post.desc,
                    commentId: comment._id,
                    comment: comment.comment,
                    commentUser: comment.user,
                    report: comment.reports.find(report => 
                        report.reporter.toString() === req.user._id.toString()
                    )
                }))
        );

        const total = await CommunityPost.countDocuments({
            'comments.reports.reporter': req.user._id
        });

        return res.status(200).json({
            status: true,
            message: 'Your reported comments fetched successfully',
            data: {
                reportedComments: userReportedComments,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user comment reports:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

/**
 * Update comment report status (admin only)
 */
export const updateCommentReportStatus = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== Roles.ADMIN) {
            return res.status(403).json({
                status: false,
                message: 'Only admins can update comment report status',
                data: null
            });
        }

        const { postId, commentId, reportId } = req.params;
        const { status, adminNotes, hideFromReporter } = req.body;

        // Find the post and comment
        const post = await CommunityPost.findById(postId);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
                data: null
            });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({
                status: false,
                message: 'Comment not found',
                data: null
            });
        }

        const report = comment.reports.id(reportId);
        if (!report) {
            return res.status(404).json({
                status: false,
                message: 'Report not found',
                data: null
            });
        }

        // Update report status
        report.status = status;
        report.adminNotes = adminNotes;

        // Handle comment visibility
        if (status === 'resolved') {
            if (hideFromReporter) {
                if (!comment.hiddenFromUsers.includes(report.reporter)) {
                    comment.hiddenFromUsers.push(report.reporter);
                }
            } else {
                comment.hiddenFromUsers = comment.hiddenFromUsers.filter(
                    userId => userId.toString() !== report.reporter.toString()
                );
            }

            // If comment is inappropriate, hide it globally
            if (report.reportType === 'inappropriate_content') {
                comment.isHidden = true;
                comment.hiddenReason = adminNotes;
            }
        }

        await post.save();

        const updatedPost = await CommunityPost.findById(postId)
            .populate('postedBy', 'name email')
            .populate('likes', 'name email')
            .populate('comments.user', 'name email');

        return res.status(200).json({
            status: true,
            message: 'Comment report status updated successfully',
            data: updatedPost
        });
    } catch (error) {
        console.error('Error updating comment report status:', error);
        return res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
}; 