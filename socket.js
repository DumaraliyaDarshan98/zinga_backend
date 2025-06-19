import { Server } from 'socket.io';

const users = new Map();
const matchRooms = new Map(); // tracks users in each match room
const clubRooms = new Map();  // tracks users in each club room

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`A user connected: ${socket.id}`);

        // Register user with their userId
        socket.on("register", (userId) => {
            users.set(userId, socket.id);
            console.log(`User ${userId} registered with socket ${socket.id}`);
        });

        // Join a match room to receive match updates
        socket.on("joinMatchRoom", (matchId) => {
            socket.join(`match:${matchId}`);
            
            // Track users in the match room
            if (!matchRooms.has(matchId)) {
                matchRooms.set(matchId, new Set());
            }
            matchRooms.get(matchId).add(socket.id);
            
            console.log(`User ${socket.id} joined match room: ${matchId}`);
            
            // Notify others in the room that a new user joined
            socket.to(`match:${matchId}`).emit("userJoinedMatch", {
                matchId,
                userCount: matchRooms.get(matchId).size
            });
        });

        // Allow clients to request recent match events when they join a room
        socket.on("getRecentMatchEvents", (matchId) => {
            // Check if user is in the match room
            if (!socket.rooms.has(`match:${matchId}`)) {
                socket.emit("error", {
                    message: "You must join the match room before requesting events"
                });
                return;
            }
            
            // Get recent events from memory
            const recentEvents = global.matchEvents && global.matchEvents[matchId] 
                ? global.matchEvents[matchId] 
                : [];
                
            // Send events to the requesting client only
            socket.emit("recentMatchEvents", {
                matchId,
                events: recentEvents,
                count: recentEvents.length,
                timestamp: new Date()
            });
            
            console.log(`Sent ${recentEvents.length} recent events to user ${socket.id} for match: ${matchId}`);
        });

        // Leave a match room
        socket.on("leaveMatchRoom", (matchId) => {
            socket.leave(`match:${matchId}`);
            
            // Remove user from match room tracking
            if (matchRooms.has(matchId)) {
                matchRooms.get(matchId).delete(socket.id);
                
                // Clean up empty rooms
                if (matchRooms.get(matchId).size === 0) {
                    matchRooms.delete(matchId);
                }
            }
            
            console.log(`User ${socket.id} left match room: ${matchId}`);
        });

        // Join a club room to receive club updates
        socket.on("joinClubRoom", (clubId) => {
            socket.join(`club:${clubId}`);
            
            // Track users in the club room
            if (!clubRooms.has(clubId)) {
                clubRooms.set(clubId, new Set());
            }
            clubRooms.get(clubId).add(socket.id);
            
            console.log(`User ${socket.id} joined club room: ${clubId}`);
            
            // Notify others in the room that a new user joined
            socket.to(`club:${clubId}`).emit("userJoinedClub", {
                clubId,
                userCount: clubRooms.get(clubId).size
            });
        });

        // Leave a club room
        socket.on("leaveClubRoom", (clubId) => {
            socket.leave(`club:${clubId}`);
            
            // Remove user from club room tracking
            if (clubRooms.has(clubId)) {
                clubRooms.get(clubId).delete(socket.id);
                
                // Clean up empty rooms
                if (clubRooms.get(clubId).size === 0) {
                    clubRooms.delete(clubId);
                }
            }
            
            console.log(`User ${socket.id} left club room: ${clubId}`);
        });

        // Handle direct messages between users
        socket.on("sendMessage", ({ receiverId, message }) => {
            const receiverSocketId = users.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("receiveMessage", {
                    senderId: socket.id,
                    message,
                });
                console.log(`Message sent from ${socket.id} to ${receiverId}`);
            } else {
                console.log(`User ${receiverId} is not online.`);
            }
        });

        // Handle disconnect event
        socket.on("disconnect", () => {
            // Clean up user registration
            for (let [userId, socketId] of users.entries()) {
                if (socketId === socket.id) {
                    users.delete(userId);
                    console.log(`User ${userId} disconnected.`);
                    break;
                }
            }
            
            // Clean up match rooms
            for (let [matchId, userSet] of matchRooms.entries()) {
                if (userSet.has(socket.id)) {
                    userSet.delete(socket.id);
                    
                    // Clean up empty rooms
                    if (userSet.size === 0) {
                        matchRooms.delete(matchId);
                    } else {
                        // Notify remaining users in the room
                        io.to(`match:${matchId}`).emit("userLeftMatch", {
                            matchId,
                            userCount: userSet.size
                        });
                    }
                }
            }
            
            // Clean up club rooms
            for (let [clubId, userSet] of clubRooms.entries()) {
                if (userSet.has(socket.id)) {
                    userSet.delete(socket.id);
                    
                    // Clean up empty rooms
                    if (userSet.size === 0) {
                        clubRooms.delete(clubId);
                    } else {
                        // Notify remaining users in the room
                        io.to(`club:${clubId}`).emit("userLeftClub", {
                            clubId,
                            userCount: userSet.size
                        });
                    }
                }
            }
        });
    });

    return io; // Return the io instance so it can be used in other files
};

// Broadcast match updates to all users in the match room
export const broadcastMatchUpdate = (io, matchId, updateType, data) => {
    io.to(`match:${matchId}`).emit('matchUpdate', {
        matchId,
        updateType,
        data,
        timestamp: new Date()
    });
    console.log(`Match update (${updateType}) broadcast to room: match:${matchId}`);
};

// Broadcast club updates to all users in the club room
export const broadcastClubUpdate = (io, clubId, updateType, data) => {
    io.to(`club:${clubId}`).emit('clubUpdate', {
        clubId,
        updateType,
        data,
        timestamp: new Date()
    });
    console.log(`Club update (${updateType}) broadcast to room: club:${clubId}`);
};
