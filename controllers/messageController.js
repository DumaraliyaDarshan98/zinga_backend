import Message from "../models/Message.js";

export const createMessage = async (req, res) => {
    try {
        const { messageType, messageContent, clubId, url } = req.body;
        const senderId = req.user.id;

        const newMessage = new Message({ messageType, messageContent, senderId, clubId, url });
        await newMessage.save();

        res.status(201).json({ message: "Message created successfully", status: true, data: newMessage });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const getMessagesByClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        const messages = await Message.find({ clubId })
            .populate("senderId", "name email")
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        const totalMessages = await Message.countDocuments({ clubId });

        res.status(200).json({
            message: "Messages fetched successfully",
            status: true,
            data: messages,
            pagination: {
                currentPage: pageNumber,
                totalPages: Math.ceil(totalMessages / limitNumber),
                totalMessages,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages", error: error.message, status: false });
    }
};


export const updateMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { messageContent } = req.body;

        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            { messageContent },
            { new: true }
        );

        if (!updatedMessage) {
            return res.status(404).json({ message: "Message not found", status: false, data: null });
        }

        res.status(200).json({ message: "Message updated successfully", status: true, data: updatedMessage });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedMessage = await Message.findByIdAndDelete(id);

        if (!deletedMessage) {
            return res.status(404).json({ message: "Message not found", status: false, data: null });
        }

        res.status(200).json({ message: "Message deleted successfully", status: true, data: deletedMessage });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, data: null });
    }
};
