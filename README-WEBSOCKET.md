
# WebSocket Implementation Guide - Zinga Cricket Platform

This document provides detailed information about the WebSocket implementation for real-time updates in the Zinga Cricket application.

## Server Connection Details

- **Port**: 6000 (configurable via environment variable PORT)
- **Connection URL**: `http://your-server-address:6000`
- **Implementation**: Socket.IO
- 
## How to Connect

### Client-side connection (JavaScript/Browser)

```javascript
import { io } from 'socket.io-client';
// Connect to the server
const socket = io('http://your-server-address:6000');
// Register user when connected
socket.on('connect', () => {
console.log('Connected to server');
socket.emit('register', userId);
});

// Handle connection errors
socket.on('connect_error', (error) => {
console.error('Connection error:', error);
});

socket.on('disconnect', () => {
console.log('Disconnected from server');
});

```

  

### Join Rooms to Receive Updates

```javascript
// Join a match room to get match updates
socket.emit('joinMatchRoom', matchId);
// Join a club room to get club updates
socket.emit('joinClubRoom', clubId);
// Leave rooms when no longer needed
socket.emit('leaveMatchRoom', matchId);
socket.emit('leaveClubRoom', clubId);
```

## Event Types and Message Content

### Match Events
All match events are received on the `matchUpdate` event with a `type` field indicating the specific event type.
```javascript
socket.on('matchUpdate', (event) => {
console.log(`Received match event: ${event.type}`);
// Handle different event types
switch(event.type) {
case 'BALL_ADDED':
// Handle new ball
break;
case 'BALL_UNDONE':
// Handle ball undo
break;
case 'STATUS_CHANGED':
// Handle match status change
break;
// etc.
}
});
```
  
#### Match Event Types
1. **BALL_ADDED**: New ball added to a match
```javascript
{
type: 'BALL_ADDED',
matchId: '123456',
innings: 'firstInnings',
ball: {
overNumber: 5,
ballNumber: 3,
runs: 4,
isWicket: false,
striker: { _id: '123', name: 'John Smith' },
bowler: { _id: '456', name: 'James Anderson' }
}
```

2. **BALL_UNDONE**: Last ball removed from match
```javascript

{
type: 'BALL_UNDONE',
matchId: '123456',
innings: 'firstInnings',
removedBall: { /* ball details */ },
timestamp: '2023-06-15T12:31:15.000Z'
}
```
  
3. **STATUS_CHANGED**: Match status updated
```javascript
{
type: 'STATUS_CHANGED',
matchId: '123456',
previousStatus: 'scheduled',
currentStatus: 'live',
timestamp: '2023-06-15T12:00:00.000Z'
}
```

4. **TOSS_UPDATED**: Toss information updated
```javascript
{
type: 'TOSS_UPDATED',
matchId: '123456',
tossWinner: { id: '111', name: 'Team A' },
tossDecision: 'batting',
timestamp: '2023-06-15T12:05:00.000Z'
}
```

5. **PLAYERS_UPDATED**: Current players updated
```javascript
{
type: 'PLAYERS_UPDATED',
matchId: '123456',
innings: 'firstInnings',
changedRoles: ['striker', 'bowler'],
currentPlayers: {
striker: { _id: '123', name: 'John Smith' },
nonStriker: { _id: '124', name: 'Joe Root' },
bowler: { _id: '456', name: 'James Anderson' },
keeper: { _id: '457', name: 'Jos Buttler' }
},
timestamp: '2023-06-15T12:32:00.000Z'
}
```
6. **OVER_COMPLETE**: Over completed
```javascript
{
type: 'OVER_COMPLETE',
matchId: '123456',
innings: 'firstInnings',
overNumber: 5,
overSummary: {
runs: 12,
wickets: 1,
boundaries: 2,
extras: 1
},
timestamp: '2023-06-15T12:35:00.000Z'
}
```

7. **FINAL_OVER**: Final over notification
```javascript
{
type: 'FINAL_OVER',
matchId: '123456',
innings: 'firstInnings',
ballsRemaining: 6,
message: 'Final over of the first innings!',
timestamp: '2023-06-15T13:15:00.000Z'
}
```

8. **INNINGS_COMPLETE**: Innings completed
```javascript
{
type: 'INNINGS_COMPLETE',
matchId: '123456',
innings: 'firstInnings',
inningsSummary: {
totalRuns: 150,
wickets: 6,
overs: 20.0
},
timestamp: '2023-06-15T13:20:00.000Z'
}
```

### Club Events
Club events are received on the `clubUpdate` event.
```javascript
socket.on('clubUpdate', (event) => {
console.log(`Received club event: ${event.type}`);
switch(event.type) {
case 'TOURNAMENT_JOINED':
// Handle tournament joined
break;
case 'MEMBER_TOURNAMENT_STATUS_CHANGED':
// Handle member status change
break;
}
});

```
#### Club Event Types
1. **TOURNAMENT_JOINED**: Club joined a tournament
```javascript
{
type: 'TOURNAMENT_JOINED',
clubId: '789',
tournamentId: '456',
tournament: { /* tournament details */ },
timestamp: '2023-06-15T11:00:00.000Z'
}
```
2. **MEMBER_TOURNAMENT_STATUS_CHANGED**: Member changed tournament status
```javascript
{
type: 'MEMBER_TOURNAMENT_STATUS_CHANGED',
clubId: '789',
tournamentId: '456',
member: {
userId: '123',
name: 'John Smith'
},
status: 'joined',
timestamp: '2023-06-15T11:15:00.000Z'
}
```

### Room Events
Events when users join or leave rooms.
```javascript
// Match room events
socket.on('userJoinedMatch', (data) => {
console.log(`User joined match: ${data.matchId}`);
});
socket.on('userLeftMatch', (data) => {
console.log(`User left match: ${data.matchId}`);
});
// Club room events
socket.on('userJoinedClub', (data) => {
console.log(`User joined club: ${data.clubId}`);
});
socket.on('userLeftClub', (data) => {
console.log(`User left club: ${data.clubId}`);
});
```
### Direct Messaging
```javascript
// Send a direct message
socket.emit('sendMessage', {
receiverId: '456',
message: 'Hello, how are you?'
});
// Receive direct messages
socket.on('receiveMessage', (data) => {
console.log(`Message from ${data.senderId}: ${data.message}`);
});

```