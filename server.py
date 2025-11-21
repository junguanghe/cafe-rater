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
    cafes_collection = db.caves # Mongoose pluralized 'Cafe' to 'caves'
    reviews_collection = db.reviews
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

@app.route('/cafes', methods=['GET'])
def get_cafes():
    try:
        cafes = list(cafes_collection.find())
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
            'building': data['building'],
            'items': [] # Initialize empty items array
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

        # Create new item with its own ObjectId
        new_item = {
            '_id': ObjectId(),
            'name': data['name'],
            'price': data.get('price', 0.0),  # Default to 0.0 if not provided
            'type': data.get('type', 'other')  # Default to 'other' if not provided
        }

        result = cafes_collection.update_one(
            {'_id': ObjectId(cafe_id)},
            {'$push': {'items': new_item}}
        )

        if result.matched_count == 0:
            return jsonify({'error': 'Cafe not found'}), 404

        # Return the updated cafe
        updated_cafe = cafes_collection.find_one({'_id': ObjectId(cafe_id)})
        return jsonify(serialize_doc(updated_cafe)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cafes/<cafe_id>', methods=['DELETE'])
def delete_cafe(cafe_id):
    try:
        # Delete cafe
        cafes_collection.delete_one({'_id': ObjectId(cafe_id)})
        # Delete associated reviews
        reviews_collection.delete_many({'cafeId': ObjectId(cafe_id)})
        return jsonify({'message': 'Cafe and associated reviews deleted'})
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

        new_review = {
            'cafeId': ObjectId(data['cafeId']),
            'rating': rating,
            'comment': data.get('comment', ''),
            'timestamp': datetime.datetime.utcnow()
        }

        # Optional: Item ID
        if data.get('itemId'):
            new_review['itemId'] = ObjectId(data['itemId'])

        result = reviews_collection.insert_one(new_review)
        new_review['_id'] = result.inserted_id
        
        # Convert ObjectIds to strings for response
        new_review['cafeId'] = str(new_review['cafeId'])
        if 'itemId' in new_review:
            new_review['itemId'] = str(new_review['itemId'])
            
        return jsonify(serialize_doc(new_review)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/cafes/<cafe_id>/stats', methods=['GET'])
def get_cafe_stats(cafe_id):
    try:
        cafe = cafes_collection.find_one({'_id': ObjectId(cafe_id)})
        if not cafe:
            return jsonify({'error': 'Cafe not found'}), 404

        # Count total ratings
        total_ratings = reviews_collection.count_documents({'cafeId': ObjectId(cafe_id)})

        # Calculate average rating
        pipeline = [
            {'$match': {'cafeId': ObjectId(cafe_id)}},
            {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}}}
        ]
        avg_result = list(reviews_collection.aggregate(pipeline))
        average_rating = round(avg_result[0]['avgRating'], 1) if avg_result and len(avg_result) > 0 else 0.0

        # Get recent ratings
        recent_ratings_cursor = reviews_collection.find({'cafeId': ObjectId(cafe_id)})\
            .sort('timestamp', -1)\
            .limit(5)
        
        recent_ratings = []
        for r in recent_ratings_cursor:
            # Make a copy to avoid modifying the cursor object
            r_copy = dict(r)
            r_serialized = serialize_doc(r_copy)
            r_serialized['cafeId'] = {'name': cafe['name'], '_id': str(cafe['_id'])}
            recent_ratings.append(r_serialized)

        return jsonify({
            'cafeName': cafe['name'],
            'totalRatings': total_ratings,
            'averageRating': average_rating,
            'recentRatings': recent_ratings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_global_stats():
    try:
        total_ratings = reviews_collection.count_documents({})

        pipeline = [
            {'$group': {'_id': None, 'avgRating': {'$avg': '$rating'}}}
        ]
        avg_result = list(reviews_collection.aggregate(pipeline))
        average_rating = round(avg_result[0]['avgRating'], 1) if avg_result and len(avg_result) > 0 else 0.0

        recent_ratings_cursor = reviews_collection.find()\
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
