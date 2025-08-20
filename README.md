# Hell Game Skeleton

Minimal prototype of a multiplayer 3D game set in a fiery world.

## Features
- User registration and login with sessions
- Real-time chat and movement via Socket.io
- Three.js scene with blazing ground
- Virtual currency with a sample purchase (ice cream)
- Guests can only observe; registered users can interact
- Idle or disconnected players remain visible with a floating "zzz" indicator

## Usage
1. Ensure a local MongoDB instance is running on `mongodb://127.0.0.1:27017`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in a browser.

Images or textures for characters can be replaced with openly licensed assets.
