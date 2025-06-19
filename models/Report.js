import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        reportedContent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CommunityPost',
            required: true
        },
        reportType: {
            type: String,
            enum: [
                'inappropriate_content',
                'spam',
                'harassment',
                'fake_profile',
                'violence',
                'hate_speech',
                'other'
            ],
            required: true
        },
        description: {
            type: String,
            required: true,
            maxLength: 500
        },
        status: {
            type: String,
            enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
            default: 'pending'
        },
        adminNotes: {
            type: String,
            maxLength: 1000
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        resolvedAt: {
            type: Date
        },
        hideFromReporter: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Index for efficient querying
reportSchema.index({ reportedContent: 1, reporter: 1 }, { unique: true });
reportSchema.index({ status: 1 });
reportSchema.index({ reporter: 1, hideFromReporter: 1 });

const Report = mongoose.model('Report', reportSchema);

export default Report; 