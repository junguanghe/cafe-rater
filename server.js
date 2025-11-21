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
    building: { type: String, required: true }
});

const ItemSchema = new mongoose.Schema({
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0.0 },
    type: { type: String, default: 'other' }
});

const CafeReviewSchema = new mongoose.Schema({
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 200 },
    timestamp: { type: Date, default: Date.now }
});

const ItemReviewSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cafeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true }, // For reference
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 200 },
    timestamp: { type: Date, default: Date.now }
});

const Cafe = mongoose.model('Cafe', CafeSchema);
const Item = mongoose.model('Item', ItemSchema);
const CafeReview = mongoose.model('CafeReview', CafeReviewSchema);
const ItemReview = mongoose.model('ItemReview', ItemReviewSchema);

// --- 3. API Routes ---
app.get('/cafes', async (req, res) => {
    try {
        const cafes = await Cafe.find();
        // Populate items for each cafe
        const cafesWithItems = await Promise.all(cafes.map(async (cafe) => {
            const items = await Item.find({ cafeId: cafe._id });
            return { ...cafe.toObject(), items };
        }));
        res.json(cafesWithItems);
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

app.post('/cafes/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, type } = req.body;
        if (!name) return res.status(400).json({ error: 'Item name is required' });

        const cafe = await Cafe.findById(id);
        if (!cafe) return res.status(404).json({ error: 'Cafe not found' });

        const newItem = new Item({
            cafeId: id,
            name,
            price: price || 0.0,
            type: type || 'other'
        });
        const savedItem = await newItem.save();
        res.status(201).json(savedItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/cafes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Cafe.findByIdAndDelete(id);
        await Item.deleteMany({ cafeId: id });
        await CafeReview.deleteMany({ cafeId: id });
        await ItemReview.deleteMany({ cafeId: id });
        res.json({ message: 'Cafe, items, and reviews deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/reviews', async (req, res) => {
    try {
        // Determine if this is a cafe or item review
        if (req.body.itemId) {
            const newReview = new ItemReview(req.body);
            await newReview.save();
            res.status(201).json(newReview);
        } else {
            const newReview = new CafeReview(req.body);
            await newReview.save();
            res.status(201).json(newReview);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/cafes/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const cafe = await Cafe.findById(id);
        if (!cafe) {
            return res.status(404).json({ error: 'Cafe not found' });
        }

        const totalRatings = await CafeReview.countDocuments({ cafeId: id });

        const avgResult = await CafeReview.aggregate([
            { $match: { cafeId: new mongoose.Types.ObjectId(id) } },
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);
        const averageRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : 0;

        const recentRatings = await CafeReview.find({ cafeId: id })
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('cafeId', 'name');

        res.json({
            cafeName: cafe.name,
            totalRatings,
            averageRating,
            recentRatings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const totalRatings = await CafeReview.countDocuments();

        const avgResult = await CafeReview.aggregate([
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);
        const averageRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : 0;

        const recentRatings = await CafeReview.find()
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