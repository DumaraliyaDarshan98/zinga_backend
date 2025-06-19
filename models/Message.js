import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        messageType: {
            type: String,
            enum: ["text", "image", "video", "file"],
            required: true,
        },
        messageContent: {
            type: String,
            required: true,
        },
        url: {
            type: String,
            default: ""
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        clubId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Club",
            required: true,
        },
    },
    { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
