import os
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='public')
CORS(app)

# --- 1. Database Connection ---
try:
    client = MongoClient(os.getenv('MONGO_URI'))
    # Get the default database from the URI
    db = client.get_database() 
    cafes_collection = db.cafes # Correct pluralization
    items_collection = db.items # Separate collection for items
    cafe_reviews_collection = db.cafe_reviews # Reviews for cafes
    item_reviews_collection = db.item_reviews # Reviews for items
    print("✅ Connected to Firestore via MongoDB API!")
except Exception as e:
    print(f"❌ Connection Failed: {e}")
    exit(1)

# --- Helper Functions ---
def serialize_doc(doc):
    """Convert ObjectId to string for JSON serialization"""
    if not doc:
        return None
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if 'cafeId' in doc and isinstance(doc['cafeId'], ObjectId):
        doc['cafeId'] = str(doc['cafeId'])
    if 'itemId' in doc and isinstance(doc['itemId'], ObjectId):
        doc['itemId'] = str(doc['itemId'])
    if 'timestamp' in doc and isinstance(doc['timestamp'], datetime.datetime):
        doc['timestamp'] = doc['timestamp'].isoformat()
    # Handle embedded items if they exist
    if 'items' in doc:
        for item in doc['items']:
            if '_id' in item:
                item['_id'] = str(item['_id'])
    return doc

# --- 2. API Routes ---

@app.route('/')
def serve_index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

@app.route('/cafes', methods=['GET'])
def get_cafes():
    try:
        cafes = list(cafes_collection.find())
        # Items are now embedded, just calculate stats for each cafe
        for cafe in cafes:
            cafe_id = cafe['_id']
            
            # Stats
            total_ratings = cafe_reviews_collection.count_documents({'cafeId': cafe_id})
            
            pipeline = [
                {'$match': {'cafeId': cafe_id}},
                {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}}}
            ]
            avg_result = list(cafe_reviews_collection.aggregate(pipeline))
            average_rating = round(avg_result[0]['avgRating'], 1) if avg_result and len(avg_result) > 0 else 0.0
            
            cafe['totalRatings'] = total_ratings
            cafe['averageRating'] = average_rating

        return jsonify([serialize_doc(cafe) for cafe in cafes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cafes', methods=['POST'])
def create_cafe():
    try:
        data = request.json
        # Basic validation
        if not data.get('name') or not data.get('building'):
            return jsonify({'error': 'Name and building are required'}), 400
            
        # Check uniqueness of name
        if cafes_collection.find_one({'name': data['name']}):
             return jsonify({'error': 'Cafe with this name already exists'}), 400

        new_cafe = {
            'name': data['name'],
            'building': data['building']
        }
        result = cafes_collection.insert_one(new_cafe)
        new_cafe['_id'] = result.inserted_id
        return jsonify(serialize_doc(new_cafe)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/cafes/<cafe_id>/items', methods=['POST'])
def add_item(cafe_id):
    try:
        data = request.json
        if not data.get('name'):
            return jsonify({'error': 'Item name is required'}), 400

        # Verify cafe exists
        cafe = cafes_collection.find_one({'_id': ObjectId(cafe_id)})
        if not cafe:
            return jsonify({'error': 'Cafe not found'}), 404

        # Create new item to embed
        new_item = {
            '_id': ObjectId(),  # Generate ID for the embedded item
            'name': data['name'],
            'price': data.get('price', 0.0),
            'type': data.get('type', 'other')
        }

        # Add item to embedded array
        cafes_collection.update_one(
            {'_id': ObjectId(cafe_id)},
            {'$push': {'items': new_item}}
        )
        
        return jsonify(serialize_doc(new_item)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    try:
        # Find and remove the item from embedded array
        result = cafes_collection.update_one(
            {'items._id': ObjectId(item_id)},
            {'$pull': {'items': {'_id': ObjectId(item_id)}}}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Item not found'}), 404
        
        # Delete associated item reviews
        item_reviews_collection.delete_many({'itemId': ObjectId(item_id)})
        
        return jsonify({'message': 'Item and its reviews deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/items/<item_id>/stats', methods=['GET'])
def get_item_stats(item_id):
    try:
        # Find the cafe that contains this item
        cafe = cafes_collection.find_one({'items._id': ObjectId(item_id)})
        if not cafe:
            return jsonify({'error': 'Item not found'}), 404
        
        # Find the specific item in the embedded array
        item = None
        for embedded_item in cafe.get('items', []):
            if embedded_item['_id'] == ObjectId(item_id):
                item = embedded_item
                break
        
        if not item:
            return jsonify({'error': 'Item not found'}), 404

        # Calculate average rating for this item
        pipeline = [
            {'$match': {'itemId': ObjectId(item_id)}},
            {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}, 'totalRatings': {'$sum': 1}}}
        ]
        avg_result = list(item_reviews_collection.aggregate(pipeline))
        
        average_rating = 0.0
        total_ratings = 0
        if avg_result and len(avg_result) > 0:
            average_rating = round(avg_result[0]['avgRating'], 1)
            total_ratings = avg_result[0]['totalRatings']

        # Get recent reviews for this item
        recent_reviews_cursor = item_reviews_collection.find({'itemId': ObjectId(item_id)})\
            .sort('timestamp', -1)\
            .limit(10)
        
        recent_reviews = [serialize_doc(doc) for doc in recent_reviews_cursor]

        return jsonify({
            'item': serialize_doc(item),
            'averageRating': average_rating,
            'totalRatings': total_ratings,
            'reviews': recent_reviews
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cafes/<cafe_id>', methods=['DELETE'])
def delete_cafe(cafe_id):
    try:
        # Delete cafe (items are embedded, so they're deleted automatically)
        cafes_collection.delete_one({'_id': ObjectId(cafe_id)})
        # Delete associated cafe reviews
        cafe_reviews_collection.delete_many({'cafeId': ObjectId(cafe_id)})
        # Delete associated item reviews
        item_reviews_collection.delete_many({'cafeId': ObjectId(cafe_id)})
        
        return jsonify({'message': 'Cafe, items, and reviews deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reviews', methods=['POST'])
def create_review():
    try:
        data = request.json
        # Validation
        if not data.get('cafeId') or not data.get('rating'):
            return jsonify({'error': 'cafeId and rating are required'}), 400
        
        rating = int(data['rating'])
        if rating < 1 or rating > 5:
             return jsonify({'error': 'Rating must be between 1 and 5'}), 400

        # Determine if this is a cafe review or item review
        if data.get('itemId'):
            # Item review
            new_review = {
                'itemId': ObjectId(data['itemId']),
                'cafeId': ObjectId(data['cafeId']),  # Keep cafeId for reference
                'rating': rating,
                'comment': data.get('comment', ''),
                'timestamp': datetime.datetime.utcnow()
            }
            result = item_reviews_collection.insert_one(new_review)
        else:
            # Cafe review
            new_review = {
                'cafeId': ObjectId(data['cafeId']),
                'rating': rating,
                'comment': data.get('comment', ''),
                'timestamp': datetime.datetime.utcnow()
            }
            result = cafe_reviews_collection.insert_one(new_review)
        
        new_review['_id'] = result.inserted_id
        return jsonify(serialize_doc(new_review)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cafes/<cafe_id>/stats', methods=['GET'])
def get_cafe_stats(cafe_id):
    try:
        cafe = cafes_collection.find_one({'_id': ObjectId(cafe_id)})
        if not cafe:
            return jsonify({'error': 'Cafe not found'}), 404

        # Count total ratings for this cafe (not items)
        total_ratings = cafe_reviews_collection.count_documents({'cafeId': ObjectId(cafe_id)})

        # Calculate average rating for cafe
        pipeline = [
            {'$match': {'cafeId': ObjectId(cafe_id)}},
            {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}}}
        ]
        avg_result = list(cafe_reviews_collection.aggregate(pipeline))
        average_rating = round(avg_result[0]['avgRating'], 1) if avg_result and len(avg_result) > 0 else 0.0

        # Get recent cafe ratings
        recent_ratings_cursor = cafe_reviews_collection.find({'cafeId': ObjectId(cafe_id)})\
            .sort('timestamp', -1)\
            .limit(5)
        
        recent_ratings = []
        for r in recent_ratings_cursor:
            # Make a copy to avoid modifying the cursor object
            r_copy = dict(r)
            r_serialized = serialize_doc(r_copy)
            r_serialized['cafeId'] = {'name': cafe['name'], '_id': str(cafe['_id'])}
            recent_ratings.append(r_serialized)

        # Get items from embedded array with their average ratings
        items = cafe.get('items', [])
        items_with_ratings = []
        
        for item in items:
            item_id = item['_id']
            
            # Calculate average rating for this item
            item_pipeline = [
                {'$match': {'itemId': item_id}},
                {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}, 'totalRatings': {'$sum': 1}}}
            ]
            item_avg_result = list(item_reviews_collection.aggregate(item_pipeline))
            
            item_data = serialize_doc(item)
            if item_avg_result and len(item_avg_result) > 0:
                item_data['averageRating'] = round(item_avg_result[0]['avgRating'], 1)
                item_data['totalRatings'] = item_avg_result[0]['totalRatings']
            else:
                item_data['averageRating'] = 0.0
                item_data['totalRatings'] = 0
            
            items_with_ratings.append(item_data)

        return jsonify({
            'cafeName': cafe['name'],
            'totalRatings': total_ratings,
            'averageRating': average_rating,
            'recentRatings': recent_ratings,
            'items': items_with_ratings
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_global_stats():
    try:
        # Global stats for cafe reviews only (not item reviews)
        total_ratings = cafe_reviews_collection.count_documents({})

        pipeline = [
            {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}}}
        ]
        avg_result = list(cafe_reviews_collection.aggregate(pipeline))
        average_rating = round(avg_result[0]['avgRating'], 1) if avg_result and len(avg_result) > 0 else 0.0

        recent_ratings_cursor = cafe_reviews_collection.find()\
            .sort('timestamp', -1)\
            .limit(5)
            
        recent_ratings = []
        for r in recent_ratings_cursor:
            # Make a copy to avoid modifying the cursor object
            r_copy = dict(r)
            # Populate cafe name manually
            cafe = cafes_collection.find_one({'_id': r_copy['cafeId']})
            r_serialized = serialize_doc(r_copy)
            if cafe:
                r_serialized['cafeId'] = {'name': cafe['name'], '_id': str(cafe['_id'])}
            recent_ratings.append(r_serialized)

        return jsonify({
            'totalRatings': total_ratings,
            'averageRating': average_rating,
            'recentRatings': recent_ratings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- 3. Start Server ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"🚀 Cafe Rater Server running on port {port}")
    print(f"👉 Open http://localhost:{port} in your browser!")
    app.run(host='0.0.0.0', port=port, debug=True)
