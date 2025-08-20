const socket = io();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x330000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
scene.add(player);

camera.position.y = 2;
camera.position.z = 5;

const players = {};

function createTextSprite(message) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = '24px Arial';
  context.fillStyle = 'white';
  context.fillText(message, 0, 24);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(2, 1, 1);
  return sprite;
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

function update() {
  let moved = false;
  if (keys['w']) { player.position.z -= 0.1; moved = true; }
  if (keys['s']) { player.position.z += 0.1; moved = true; }
  if (keys['a']) { player.position.x -= 0.1; moved = true; }
  if (keys['d']) { player.position.x += 0.1; moved = true; }
  camera.position.x = player.position.x;
  camera.position.z = player.position.z + 5;
  camera.lookAt(player.position);
  if (moved) {
    socket.emit('move', player.position);
  }
  setTimeout(update, 50);
}
update();

// Chat
const messages = document.getElementById('messages');
document.getElementById('send').onclick = () => {
  socket.emit('chat', document.getElementById('m').value);
  document.getElementById('m').value = '';
};
socket.on('chat', data => {
  const li = document.createElement('li');
  li.textContent = `${data.name}: ${data.msg}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

// Account and auth
const auth = document.getElementById('auth');
const account = document.getElementById('account');
fetch('/me').then(r => r.json()).then(u => {
  if (!u.guest) {
    auth.style.display = 'none';
    account.style.display = 'block';
    document.getElementById('user').textContent = u.username;
    document.getElementById('balance').textContent = u.balance;
    socket.emit('init');
  }
});

document.getElementById('login').onclick = async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (res.ok) {
    const u = await res.json();
    auth.style.display = 'none';
    account.style.display = 'block';
    document.getElementById('user').textContent = u.username;
    document.getElementById('balance').textContent = u.balance;
    socket.emit('init');
  } else {
    alert('login failed');
  }
};

document.getElementById('register').onclick = async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (res.ok) alert('registered'); else alert('register failed');
};

document.getElementById('logout').onclick = async () => {
  await fetch('/logout', { method: 'POST' });
  location.reload();
};

document.getElementById('buy').onclick = async () => {
  const res = await fetch('/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: 'ice cream', price: 10 }) });
  if (res.ok) {
    const u = await res.json();
    document.getElementById('balance').textContent = u.balance;
    alert('Bought ' + u.item);
  } else {
    alert('purchase failed');
  }
};

socket.on('playerMove', data => {
  let p = players[data.id];
  if (!p) {
    p = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    players[data.id] = p;
    scene.add(p);
  }
  p.position.set(data.pos.x, data.pos.y, data.pos.z);
});

socket.on('playerJoin', data => {
  if (!players[data.id]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    players[data.id] = p;
    p.position.set(data.pos.x, data.pos.y, data.pos.z);
    scene.add(p);
  }
});

socket.on('state', state => {
  for (const id in state) {
    const info = state[id];
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    p.position.set(info.pos.x, info.pos.y, info.pos.z);
    if (info.sleeping) {
      const z = createTextSprite('zzz');
      z.position.set(0, 2.5, 0);
      p.add(z);
      p.sleepSprite = z;
    }
    players[id] = p;
    scene.add(p);
  }
});

socket.on('playerSleep', id => {
  const p = players[id];
  if (p && !p.sleepSprite) {
    const z = createTextSprite('zzz');
    z.position.set(0, 2.5, 0);
    p.add(z);
    p.sleepSprite = z;
  }
});

socket.on('playerWake', id => {
  const p = players[id];
  if (p && p.sleepSprite) {
    p.remove(p.sleepSprite);
    p.sleepSprite = null;
  }
});
