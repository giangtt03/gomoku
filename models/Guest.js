const mongoose = require('mongoose');


function generateRandomGuestName() {
    const adjectives = ['Thiendiahoi', 'Hophoantong', 'Thaiamtong', 'Amduongtong'];
    const nouns = ['1','0'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 1000);
    return `${randomAdjective}${randomNoun}${randomNumber}`;
}

const guestSchema = new mongoose.Schema({
    guestId: { type: String, unique: true, required: true },
    guestName: {type:String, unique: true, required: true},
    joinedAt: { type: Date, default: Date.now },
    lastPlayed: Date, 
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    winRate: { type: Number, default: 0 }, 
    avatar: { type: String, default: '/atau.jpg' },
    gameHistory: [
        {
            roomId: String,
            result: String, // 'win', 'lose' hoặc 'draw'
            playedAt: Date
        }
    ],
  
},{ timestamps: true });

// Middleware để random guestName
guestSchema.pre('save', function (next) {
    if (!this.guestName) {
        this.guestName = generateRandomGuestName();
        console.log('Generated guestName:', this.guestName);
    }
    next();
});

const Guest = mongoose.model('Guest', guestSchema);

module.exports = Guest;
