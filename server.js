require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

// --- 1. Database Connection ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            autoIndex: true,
        });
        console.log('✅ Connected to Firestore via MongoDB API!');
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    }
};

// --- 2. Schemas ---
const CafeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    building: { type: String, required: true },
    cuisine: [String],
    isOpen: { type: Boolean, default: true },
    highTraffic: { type: Boolean, default: false }
});

const ReviewSchema = new mongoose.Schema({
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const Cafe = mongoose.model('Cafe', CafeSchema);
const Review = mongoose.model('Review', ReviewSchema);

// --- 3. API Routes ---
app.get('/cafes', async (req, res) => {
    try {
        const cafes = await Cafe.find();
        res.json(cafes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/cafes', async (req, res) => {
    try {
        const newCafe = new Cafe(req.body);
        const savedCafe = await newCafe.save();
        res.status(201).json(savedCafe);
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ error: 'Cafe with this name already exists' });
        } else {
            res.status(400).json({ error: err.message });
        }
    }
});

app.delete('/cafes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Cafe.findByIdAndDelete(id);
        await Review.deleteMany({ cafeId: id });
        res.json({ message: 'Cafe and associated reviews deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/reviews', async (req, res) => {
    try {
        const newReview = new Review(req.body);
        await newReview.save();
        res.status(201).json(newReview);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const totalRatings = await Review.countDocuments();

        const avgResult = await Review.aggregate([
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);
        const averageRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : 0;

        const recentRatings = await Review.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('cafeId', 'name');

        res.json({
            totalRatings,
            averageRating,
            recentRatings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. Start Server ---
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Cafe Rater Server running on port ${PORT}`);
        console.log(`👉 Open http://localhost:${PORT} in your browser!`);
    });
});