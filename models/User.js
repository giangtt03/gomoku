const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    avatar: {
        type: String,
    },
    joinedAt: { type: Date, default: Date.now },
    lastPlayed: Date,
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    winRate: { type: Number, default: 0 },
    avatar: { type: String, default: '/atau.jpg' },
    gameHistory: [
        {
            roomId: String,
            result: String,
            playedAt: Date
        }
    ],

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);