# ☕ Google Cafe Rater

A full-stack web application for rating cafes and menu items at Google offices.

## 🌐 Live Demo

- **Vue Version (Default)**: https://ace-botany-478821-h7.web.app/
- **Vanilla JS Version**: https://ace-botany-478821-h7.web.app/vanilla.html
- **Backend API**: https://cafe-rater--ace-botany-478821-h7.us-east4.hosted.app/

## 🏗️ Architecture

### Frontend
- **Vue 3** (CDN) - Reactive UI framework
- **Vanilla JavaScript** - Alternative implementation
- **Firebase Authentication** - User login/signup
- **Firebase Hosting** - Static file hosting

### Backend
- **Node.js + Express** - REST API server
- **Mongoose** - MongoDB ODM
- **Firebase App Hosting** - Cloud Run deployment
- **MongoDB (Firestore API)** - Database

### Communication
- **HTTP/REST API** - Frontend ↔ Backend
- **JSON** - Data format

## 📁 Project Structure

```
cafe-rater/
├── public/                    # Frontend files (deployed to Firebase Hosting)
│   ├── index.html            # Vue version (default)
│   ├── vanilla.html          # Vanilla JS version
│   ├── vue_app.js            # Vue application logic
│   ├── app.js                # Vanilla JS application logic
│   ├── auth.js               # Authentication logic (vanilla)
│   ├── firebase-config.js    # Firebase configuration
│   └── styles.css            # Shared styles
├── server.js                 # Express backend (deployed to Cloud Run)
├── apphosting.yaml           # Firebase App Hosting config
├── firebase.json             # Firebase project config
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
└── package.json              # Node.js dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase CLI: `npm install -g firebase-tools`
- MongoDB connection (Firestore MongoDB API)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/junguanghe/cafe-rater.git
   cd cafe-rater
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```
   MONGO_URI=your_mongodb_connection_string
   PORT=3000
   ```

4. **Run the server**
   ```bash
   node server.js
   ```

5. **Open in browser**
   - Vue version: http://localhost:3000
   - Vanilla version: http://localhost:3000/vanilla.html

### Deployment

#### Frontend (Firebase Hosting)
```bash
firebase deploy --only hosting
```

#### Backend (Firebase App Hosting)
```bash
git push origin main
# Automatically deploys via Firebase Console (connected to GitHub repo)
```

## 🔑 Features

### ✅ Implemented
- User authentication (login/signup)
- Create and delete cafes
- Add and delete menu items
- Rate cafes and items
- View statistics (average ratings, total ratings)
- Responsive UI
- Two frontend implementations (Vue + Vanilla)
- Automatic GitHub deployment
- Embedded items in cafe documents (MongoDB)

### 📋 TODO

#### Security
- [ ] **Backend Authentication** - Verify Firebase ID tokens on backend
  - Add Firebase Admin SDK to `server.js`
  - Create authentication middleware
  - Protect API endpoints (POST, DELETE)
  - Only allow authenticated users to create/delete content
  
#### Features
- [ ] **User-specific data** - Track which user created each cafe/item
- [ ] **Edit functionality** - Allow users to edit cafes/items
- [ ] **Image uploads** - Add photos for cafes and items
- [ ] **Search/Filter** - Search cafes by name or building
- [ ] **Sorting** - Sort by rating, name, date
- [ ] **Pagination** - Handle large numbers of cafes

#### UI/UX
- [ ] **Loading states** - Show spinners during API calls
- [ ] **Error handling** - Better error messages
- [ ] **Confirmation dialogs** - Improve delete confirmations
- [ ] **Mobile optimization** - Better mobile experience
- [ ] **Dark mode** - Theme toggle

#### Performance
- [ ] **Caching** - Cache API responses
- [ ] **Lazy loading** - Load data on demand
- [ ] **Image optimization** - Compress and resize images
- [ ] **Code splitting** - Consider migrating to Vite

#### DevOps
- [ ] **Environment configs** - Separate dev/prod configs
- [ ] **Monitoring** - Add error tracking (Sentry)
- [ ] **Analytics** - Track user behavior
- [ ] **CI/CD improvements** - Add testing to pipeline

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Vue 3 (CDN) |
| Frontend Alternative | Vanilla JavaScript |
| Backend Framework | Express.js |
| Database | MongoDB (Firestore API) |
| ODM | Mongoose |
| Authentication | Firebase Auth |
| Hosting (Frontend) | Firebase Hosting |
| Hosting (Backend) | Firebase App Hosting (Cloud Run) |
| CI/CD | GitHub Actions |

## 📊 Data Model

### Cafe
```javascript
{
  name: String (required),
  building: String,
  items: [Item],  // Embedded items
  createdAt: Date
}
```

### Item (Embedded in Cafe)
```javascript
{
  _id: ObjectId,
  name: String (required),
  price: Number,
  type: String (entree/drink/side/dessert/other)
}
```

### Review
```javascript
{
  cafeId: ObjectId (optional),
  itemId: ObjectId (optional),
  rating: Number (1-5, required),
  comment: String (max 200 chars),
  timestamp: Date
}
```

## 🔒 Security Notes

⚠️ **Current Security Status:**
- ✅ Frontend authentication (login required to see UI)
- ❌ Backend authentication (APIs are public!)
- ❌ Anyone can call APIs directly (bypassing frontend)

**Action Required:** Implement backend token verification (see TODO)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is for educational purposes.

## 👤 Author

**Jason He**
- GitHub: [@junguanghe](https://github.com/junguanghe)

## 🙏 Acknowledgments

- Firebase for hosting and authentication
- MongoDB for database
- Vue.js for reactive UI
- Express.js for backend framework
