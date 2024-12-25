const Guest = require('../models/Guest');
const crypto = require('crypto');

const activeGuests = {};

function generateRandomGuestName() {
    const adjectives = ['Thiendiahoi', 'Hophoantong', 'Thaiamtong', 'Amduongtong'];
    const nouns = ['1','0'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 1000);
    return `${randomAdjective}${randomNoun}${randomNumber}`;
}

const guestController = (io) => {
    return {
        createGuest: async (req, res) => {
            try {
                const guestId = crypto.randomUUID();
                const guestName = generateRandomGuestName();
                const guest = new Guest({
                    guestId,
                    guestName,
                    status: 'online'
                });

                await guest.save();
                res.status(201).json({ guestId, guestName, message: 'Guest created successfully' });

                setImmediate(() => {
                    io.emit('guestStatus', { guestId, status: 'online' });
                    io.emit('guest-created', guestId);
                    console.log(`Guest created with ID: ${guestId}`);});
            } catch (error) {
                console.error('Error creating guest:', error)
                res.status(500).json({ message: 'Error creating guest', error });
            }
        },

        getGuestById: async (req, res) => {
            const { guestId } = req.params;
            try {
                const guest = await Guest.findOne({ guestId });
                if (!guest) {
                    return res.status(404).json({ message: 'Guest not found' });
                }
                res.json({guest});
            } catch (error) {
                res.status(500).json({ message: 'Server error', error: error.message });
            }
        },

        updateGuest: async (req, res) => {
            const { guestId } = req.params;
            const { result, roomId } = req.body;

            try {
                const guest = await Guest.findOne({ guestId });
                if (!guest) {
                    return res.status(404).json({ message: 'Guest not found' });
                }

                guest.status = 'online';
                guest.lastPlayed = new Date();
                guest.gameHistory.push({ roomId, result, playedAt: new Date() });

                const winCount = guest.gameHistory.filter(game => game.result === 'win').length;
                guest.winRate = (winCount / guest.gameHistory.length) * 100;

                await guest.save();
                res.status(200).json({ message: 'Guest updated successfully', guest });

                // Gửi cập nhật dữ liệu guest đến client
                io.to(activeGuests[guestId]).emit('updateGuestData', guest);
            } catch (error) {
                res.status(500).json({ message: 'Error updating guest', error });
            }
        },

        handleSocketConnection: (socket) => {
            const { guestId } = socket.handshake.query;

            if (guestId) {
                activeGuests[guestId] = socket.id; 

                socket.on('disconnect', async () => {
                    await Guest.findOneAndUpdate({ guestId }, { status: 'offline' });
                    delete activeGuests[guestId];
                    io.emit('guestStatus', { guestId, status: 'offline' });
                });
            }
        },

        updateStatus: async (req, res) => {
            const { guestId } = req.params;
            const { status } = req.body;

            try {
                const guest = await Guest.findOne({ guestId });
                if (!guest) {
                    return res.status(404).json({ message: 'Guest not found' });
                }

                guest.status = status;
                await guest.save();
                res.status(200).json({ message: `Guest status updated to ${status}` });
            } catch (error) {
                res.status(500).json({ message: 'Error updating status', error });
            }
        },

        deleteGuest: async (req, res) => {
            const { guestId } = req.params;

            try {
                await Guest.deleteOne({ guestId });
                res.status(200).json({ message: 'Guest deleted successfully' });
            } catch (error) {
                res.status(500).json({ message: 'Error deleting guest', error });
            }
        }
    };
};

module.exports = guestController; 