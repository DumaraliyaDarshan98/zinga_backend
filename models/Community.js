import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        comment: {
            type: String,
            required: true,
        },
        isHidden: {
            type: Boolean,
            default: false
        },
        hiddenReason: {
            type: String,
            maxLength: 500
        },
        hiddenFromUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        reports: [{
            reporter: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            reportType: {
                type: String,
                enum: [
                    'inappropriate_content',
                    'spam',
                    'harassment',
                    'hate_speech',
                    'other'
                ]
            },
            description: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }
);

const communityPostSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
        },
        desc: {
            type: String,
            required: true,
        },
        state:{
            type: String,
            default: '',
        },
        postedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        likes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        comments: [commentSchema],
        isHidden: {
            type: Boolean,
            default: false
        },
        hiddenReason: {
            type: String,
            maxLength: 500
        },
        hiddenFromUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Index for efficient querying
communityPostSchema.index({ postedBy: 1 });
communityPostSchema.index({ isHidden: 1 });
communityPostSchema.index({ hiddenFromUsers: 1 });
communityPostSchema.index({ 'comments.isHidden': 1 });
communityPostSchema.index({ 'comments.hiddenFromUsers': 1 });

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

export default CommunityPost;
