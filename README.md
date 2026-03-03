# Human Video Wall 📱🎥

A synchronized, multi-device "Video Wall" application that splits a single video file across multiple connected smartphones or laptops to collectively form one massive screen grid. 

## 🚀 Features
- **Real-Time Sync**: Driven by Socket.io, all devices play, pause, and scrub the video in perfect harmony.
- **Admin Dashboard**: A secure portal to manage the grid dimensions, kick users, upload videos, and control playback.
- **Firebase Auth**: The `[/admin]` portal is protected by Firebase Email/Password authentication.
- **Cloud Storage**: Videos uploaded by the Admin are streamed directly from a Firebase Storage Bucket.
- **Dynamic Device Grid**: Supports any `M x N` matrix topology configuration (e.g., 10x10 devices).

## 🛠️ Tech Stack
- **Frontend**: React (Vite), TailwindCSS, Socket.io-client, Firebase SDK
- **Backend**: Node.js, Express, Socket.io server

## 📦 Local Development

### Prerequisites
- Node.js (v18+)
- Firebase Account (for Storage and Auth credentials)

### 1. Start the Backend Server
```bash
cd server
npm install
node index.js
```
*The backend server will run on `http://localhost:3001`*

### 2. Start the Frontend Client
```bash
cd client
npm install
npm run dev
```
*The React app will run on `http://localhost:5173`*

### 3. Firebase Configuration
Update `client/src/firebase.js` with your Firebase project configurations. Ensure **Authentication** (Email/Password) and **Storage** are enabled in your Google Firebase Console.

## 🚢 Deployment

The architecture is designed to be split across two scalable cloud providers:

### Frontend (Vercel / Netlify)
1. Set the Root Directory to `client`.
2. Add the Environment Variable `VITE_SOCKET_URL` pointing to the deployed backend URL (e.g., `https://my-backend.onrender.com`).
3. Deploy!

### Backend (Render / Railway)
1. Set the Root Directory to `server`.
2. Build Command: `npm install`
3. Start Command: `node index.js`
4. Copy the resulting Live URL back to your Frontend's Environment Variable.
