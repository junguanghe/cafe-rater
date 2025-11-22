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
// Embedded Item Schema (no cafeId needed since it's embedded)
const EmbeddedItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, default: 0.0 },
    type: { type: String, default: 'other' }
});

const CafeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    building: { type: String, required: true },
    items: [EmbeddedItemSchema]  // Embedded items array
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

const Cafe = mongoose.model('Cafe', CafeSchema, 'cafes');
const CafeReview = mongoose.model('CafeReview', CafeReviewSchema, 'cafe_reviews');
const ItemReview = mongoose.model('ItemReview', ItemReviewSchema, 'item_reviews');

// --- 3. API Routes ---
app.get('/cafes', async (req, res) => {
    try {
        const cafes = await Cafe.find();
        // Calculate stats for each cafe
        const cafesWithData = await Promise.all(cafes.map(async (cafe) => {
            // Calculate stats
            const totalRatings = await CafeReview.countDocuments({ cafeId: cafe._id });
            const avgResult = await CafeReview.aggregate([
                { $match: { cafeId: cafe._id } },
                { $group: { _id: null, avgRating: { $avg: "$rating" } } }
            ]);
            const averageRating = avgResult.length > 0 ? parseFloat(avgResult[0].avgRating.toFixed(1)) : 0.0;

            return {
                ...cafe.toObject(),
                totalRatings,
                averageRating
            };
        }));
        res.json(cafesWithData);
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

        const newItem = {
            name,
            price: price || 0.0,
            type: type || 'other'
        };

        cafe.items.push(newItem);
        await cafe.save();

        // Return the newly added item (it now has an _id)
        const addedItem = cafe.items[cafe.items.length - 1];
        res.status(201).json(addedItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Find the cafe that contains this item
        const cafe = await Cafe.findOne({ 'items._id': id });
        if (!cafe) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Remove the item from the array
        cafe.items.pull({ _id: id });
        await cafe.save();

        // Delete associated item reviews
        await ItemReview.deleteMany({ itemId: id });

        res.json({ message: 'Item and its reviews deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/items/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        // Find the cafe that contains this item
        const cafe = await Cafe.findOne({ 'items._id': id });
        if (!cafe) return res.status(404).json({ error: 'Item not found' });

        // Find the specific item in the array
        const item = cafe.items.id(id);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const stats = await ItemReview.aggregate([
            { $match: { itemId: new mongoose.Types.ObjectId(id) } },
            { $group: { _id: null, avgRating: { $avg: "$rating" }, totalRatings: { $sum: 1 } } }
        ]);

        const averageRating = stats.length > 0 ? parseFloat(stats[0].avgRating.toFixed(1)) : 0;
        const totalRatings = stats.length > 0 ? stats[0].totalRatings : 0;

        const reviews = await ItemReview.find({ itemId: id }).sort({ timestamp: -1 }).limit(10);

        res.json({
            item,
            averageRating,
            totalRatings,
            reviews
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/cafes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Cafe.findByIdAndDelete(id);
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

        // Get items from embedded array with their average ratings
        const itemsWithRatings = await Promise.all(cafe.items.map(async (item) => {
            const itemAvgResult = await ItemReview.aggregate([
                { $match: { itemId: item._id } },
                { $group: { _id: null, avgRating: { $avg: "$rating" }, totalRatings: { $sum: 1 } } }
            ]);

            return {
                ...item.toObject(),
                averageRating: itemAvgResult.length > 0 ? itemAvgResult[0].avgRating.toFixed(1) : 0,
                totalRatings: itemAvgResult.length > 0 ? itemAvgResult[0].totalRatings : 0
            };
        }));

        res.json({
            cafeName: cafe.name,
            totalRatings,
            averageRating,
            recentRatings,
            items: itemsWithRatings  // Items with their ratings
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