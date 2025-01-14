const User = require('../../models/User');
const CryptoJs = require('crypto-js');
const jwt = require('jsonwebtoken');

module.exports = {
    regU: async (req, res) => {
        try {
            const { username, email, password, avatar } = req.body;
    
            const encryptedPassword = CryptoJs.AES.encrypt(password, process.env.SECRET).toString();
            const newUser = new User({
                username,
                email,
                password: encryptedPassword,
                avatar: avatar || '/atau.jpg',
                status: 'offline',
                winRate: 0,
                gameHistory: [],
            });
    
            const savedUser = await newUser.save();
            res.json({
                savedUser: {
                    ...savedUser._doc,
                    password: undefined,
                }
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }
            res.status(500).json({ error: error.message });
        }
    },    
    logU: async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
    
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }
    
            const bytes = CryptoJs.AES.decrypt(user.password, process.env.SECRET);
            const originalPassword = bytes.toString(CryptoJs.enc.Utf8);
    
            if (originalPassword !== password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
    
            const token = jwt.sign(
                { userId: user._id },
                process.env.JWT_SEC,
                { expiresIn: '1h' }
            );
    
            // Phát sự kiện userStatus trước khi gửi response
            const io = req.app.get('io');
            if (io) {
                io.emit('userStatus', { userId: user._id, status: 'online' });
            }
    
            res.json({
                user: {
                    _id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    status: 'online',
                    winRate: user.winRate,
                    gameHistory: user.gameHistory,
                },
                token: token,
                message: 'User logged in successfully',
            });
        } catch (error) {
            console.error('Error during login:', error.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    
    getUserById: async (req, res) => {
        try {
            const { userId } = req.params;
            const user = await User.findById(userId);
    
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
    
            res.status(200).json({
                user: {
                    _id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    status: user.status,
                    winRate: user.winRate,
                    gameHistory: user.gameHistory,
                },
            });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    updateUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const updates = req.body;
    
            const user = await User.findByIdAndUpdate(userId, updates, { new: true });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
    
            res.status(200).json({
                message: 'User updated successfully',
                user,
            });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
          
};