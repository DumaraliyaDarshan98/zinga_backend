import CommunityPost from '../models/Community.js';
import { Roles } from '../constant/role.js';

export const createPost = async (req, res) => {
    try {
        const { url, desc, state } = req.body;
        const userId = req.user._id;

        const newPost = new CommunityPost({
            url,
            desc,
            state,
            postedBy: userId,
            likes: [],
            comments: [],
        });

        await newPost.save();
        res.status(201).json({
            status: true,
            message: 'Post created successfully',
            data: newPost,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

export const likePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const post = await CommunityPost.findById(id);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
            });
        }

        // Check if the user has already liked the post
        const hasLiked = post.likes.includes(userId);

        if (hasLiked) {
            // Unlike the post by removing the user's ID from the likes array
            post.likes = post.likes.filter(like => like.toString() !== userId.toString());
            await post.save();

            const posts = await CommunityPost.findById(post._id)
                .populate('postedBy', 'name email')
                .populate('likes', 'name email')
                .populate('comments.user', 'name email');

            return res.status(200).json({
                status: true,
                message: 'Post unliked successfully',
                data: posts,
            });
        } else {
            // Like the post by adding the user's ID to the likes array
            post.likes.push(userId);
            await post.save();

            const posts = await CommunityPost.findById(post._id)
                .populate('postedBy', 'name email')
                .populate('likes', 'name email')
                .populate('comments.user', 'name email');

            return res.status(200).json({
                status: true,
                message: 'Post liked successfully',
                data: posts,
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

export const commentPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user._id;

        const post = await CommunityPost.findById(id);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
            });
        }

        const newComment = {
            user: userId,
            comment,
        };

        post.comments.push(newComment);
        await post.save();

        const posts = await CommunityPost.findById(post._id)
            .populate('postedBy', 'name email')
            .populate('likes', 'name email')
            .populate('comments.user', 'name email');

        res.status(200).json({
            status: true,
            message: 'Comment added successfully',
            data: posts,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

export const reportComment = async (req, res) => {
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

        return res.status(200).json({
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

export const getAllPosts = async (req, res) => {
    try {

        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query to exclude hidden posts and posts hidden from the user
        let query = {
            $and: [
                { isHidden: false },
                { hiddenFromUsers: { $ne: userId } }
            ]
        };

        if(req.query.state){
            query.state = req.query.state;
        }

        const posts = await CommunityPost.find(query)
            .populate('postedBy', 'name email')
            .populate('likes', 'name email')
            .populate('comments.user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Filter out hidden comments for the current user
        const filteredPosts = posts.map(post => {
            const filteredComments = post.comments.filter(comment =>
                !comment.isHidden &&
                !comment.hiddenFromUsers.includes(userId)
            );
            return {
                ...post.toObject(),
                comments: filteredComments
            };
        });

        const total = await CommunityPost.countDocuments(query);

        res.status(200).json({
            status: true,
            message: 'Posts retrieved successfully',
            data: {
                posts: filteredPosts,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

export const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const post = await CommunityPost.findById(id);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
            });
        }

        if (post.postedBy.toString() !== userId.toString()) {
            return res.status(403).json({
                status: false,
                message: 'You can only delete your own posts',
            });
        }

        await CommunityPost.findByIdAndDelete(id);

        res.status(200).json({
            status: true,
            message: 'Post deleted successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

export const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { url, desc } = req.body;
        const userId = req.user._id;

        const post = await CommunityPost.findById(id);
        if (!post) {
            return res.status(404).json({
                status: false,
                message: 'Post not found',
            });
        }

        if (post.postedBy.toString() !== userId.toString()) {
            return res.status(403).json({
                status: false,
                message: 'You can only update your own posts',
            });
        }

        if (url) post.url = url;
        if (desc) post.desc = desc;

        await post.save();

        res.status(200).json({
            status: true,
            message: 'Post updated successfully',
            data: post,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};
