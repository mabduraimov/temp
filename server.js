const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const uuid = require('uuid');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
  secret: 'hell-secret',
  resave: false,
  saveUninitialized: false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));
io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res || {}, next));

const client = new MongoClient('mongodb://127.0.0.1:27017');
let usersCol;
client.connect().then(() => {
  usersCol = client.db('hellgame').collection('users');
}).catch(err => console.error('Mongo connection error', err));

// Registration endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing fields');
  const existing = await usersCol.findOne({ username });
  if (existing) return res.status(400).send('User exists');
  const hash = await bcrypt.hash(password, 10);
  await usersCol.insertOne({ username, password: hash, balance: 100, id: uuid.v4() });
  res.sendStatus(200);
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await usersCol.findOne({ username });
  if (!user) return res.status(400).send('No user');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).send('Bad password');
  req.session.user = { username, id: user.id };
  res.json({ username, balance: user.balance });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(200));
});

// Fetch current user info
app.get('/me', async (req, res) => {
  if (!req.session.user) return res.json({ guest: true });
  const user = await usersCol.findOne({ username: req.session.user.username });
  res.json({ guest: false, username: user.username, balance: user.balance });
});

// Purchase endpoint
app.post('/buy', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const { item, price } = req.body;
  const user = await usersCol.findOne({ username: req.session.user.username });
  if (user.balance < price) return res.status(400).send('Insufficient funds');
  await usersCol.updateOne({ username: user.username }, { $inc: { balance: -price } });
  const updated = await usersCol.findOne({ username: user.username });
  res.json({ balance: updated.balance, item });
});

// Socket.io logic
const positions = {}; // {id: {pos, username, sleeping, lastActive}}

io.on('connection', socket => {
  socket.on('init', () => {
    const sessUser = socket.request.session.user;
    if (!sessUser) return;
    socket.user = sessUser;
    if (!positions[sessUser.id]) {
      positions[sessUser.id] = { pos: { x: 0, y: 0, z: 0 }, username: sessUser.username, sleeping: false, lastActive: Date.now() };
      socket.broadcast.emit('playerJoin', { id: sessUser.id, pos: positions[sessUser.id].pos, username: sessUser.username });
    }
    const state = { ...positions };
    delete state[sessUser.id];
    socket.emit('state', state);
  });

  socket.on('move', pos => {
    if (!socket.user) return; // guests cannot move
    const p = positions[socket.user.id];
    p.pos = pos;
    p.lastActive = Date.now();
    if (p.sleeping) {
      p.sleeping = false;
      io.emit('playerWake', socket.user.id);
    }
    socket.broadcast.emit('playerMove', { id: socket.user.id, pos, username: socket.user.username });
  });

  socket.on('chat', msg => {
    if (!socket.user) return; // guests cannot chat
    const p = positions[socket.user.id];
    p.lastActive = Date.now();
    if (p.sleeping) {
      p.sleeping = false;
      io.emit('playerWake', socket.user.id);
    }
    io.emit('chat', { name: socket.user.username, msg });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      const p = positions[socket.user.id];
      if (p) {
        p.sleeping = true;
        io.emit('playerSleep', socket.user.id);
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of Object.entries(positions)) {
    if (!data.sleeping && now - data.lastActive > 30000) {
      data.sleeping = true;
      io.emit('playerSleep', id);
    }
  }
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
