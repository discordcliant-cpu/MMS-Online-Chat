/*****************************************************************
 Geometry Dash — Server-Integrated 800x500 Clone (Final Fixed Edition)
*****************************************************************/
(function () {
  if (window.__GD_CLONE_RUNNING) { console.warn('Already running'); return; }
  window.__GD_CLONE_RUNNING = true;


  /* ---------- Firebase Server Configuration ---------- */
  const FIREBASE_BASE_URL = "https://geometry-dash-93d88-default-rtdb.firebaseio.com/";
  
  async function firebaseRequest(endpoint, method = 'GET', data = null) {
    const url = `${FIREBASE_BASE_URL}${endpoint}.json`;
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);
    
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('Firebase request failed:', error);
      throw error;
    }
  }


  /* ---------- Safe Storage Helper ---------- */
  const safeStorage = {
    getItem: (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {}
    },
    removeItem: (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {}
    }
  };


  /* ---------- Audio Management ---------- */
  let menuMusic = null;
  let levelMusic = null;
  
  function stopAllAudio() {
    if (menuMusic && !menuMusic.paused) {
      menuMusic.pause();
      menuMusic.currentTime = 0;
    }
    
    if (levelMusic && !levelMusic.paused) {
      levelMusic.pause();
      levelMusic.currentTime = 0;
    }
  }
  
  function initMainLevelMusic() {
    stopAllAudio();
    
    levelMusic = new Audio("https://dl.dropboxusercontent.com/scl/fi/20dopf6mfw1svwgjshrzp/Screen-Recording-2026-01-11-143556-2.mp3?rlkey=eicet0j6tn55rflpnpinl5qzp&e=1&st=yy9kwb35&dl=0");
    levelMusic.loop = false;
    levelMusic.volume = 0.7;
    
    levelMusic.play().catch(e => {
      console.log("Audio may require user interaction first");
    });
    
    const startOnClick = () => {
      levelMusic.play().catch(e => {});
      canvas.removeEventListener('click', startOnClick);
      window.removeEventListener('keydown', startOnClick);
    };
    
    canvas.addEventListener('click', startOnClick);
    window.addEventListener('keydown', startOnClick);
  }
  
  function initMenuMusic() {
    if (levelMusic && !levelMusic.paused) {
      levelMusic.pause();
      levelMusic.currentTime = 0;
    }
    
    if (!menuMusic) {
      menuMusic = new Audio("https://www.myinstants.com/media/sounds/geometry-dash-menu.mp3");
      menuMusic.loop = true;
      menuMusic.volume = 0.5;
    }
    menuMusic.currentTime = 0;
    menuMusic.play().catch(() => {});
  }


  /* ---------- Config & DOM ---------- */
  const RECT_WIDTH = 800;
  const RECT_HEIGHT = 500;
  const DPR = Math.max(1, window.devicePixelRatio || 1);


  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', left: 0, top: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', zIndex: 2147483647
  });
  document.body.appendChild(container);


  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    width: RECT_WIDTH + 'px', height: RECT_HEIGHT + 'px', position: 'relative',
    overflow: 'hidden', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)'
  });
  container.appendChild(wrapper);


  const canvas = document.createElement('canvas');
  canvas.width = RECT_WIDTH * DPR;
  canvas.height = RECT_HEIGHT * DPR;
  canvas.style.width = RECT_WIDTH + 'px';
  canvas.style.height = RECT_HEIGHT + 'px';
  wrapper.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);


  const menuPanel = document.createElement('div');
  Object.assign(menuPanel.style, {
    position: 'absolute', left: '8px', right: '8px', top: '56px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', zIndex: 40
  });
  wrapper.appendChild(menuPanel);


  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'absolute', left: '8px', top: '8px', color: '#fff', fontFamily: 'Arial, sans-serif', fontSize: '13px', zIndex: 50, textShadow: '0 2px 6px rgba(0,0,0,0.9)'
  });
  wrapper.appendChild(hud);


  const footer = document.createElement('div');
  Object.assign(footer.style, { 
    position: 'absolute', left: '8px', bottom: '8px', color: '#fff', fontSize: '12px', zIndex: 50, textShadow: '0 2px 4px rgba(0,0,0,0.5)' 
  });
  footer.innerText = 'Space/Click = jump/hold • Esc = menu • M = mute • Game by Jackson';
  wrapper.appendChild(footer);


  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute', right: '8px', top: '8px', zIndex: 60,
    padding: '6px 8px', background: '#ff3366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
  });
  wrapper.appendChild(closeBtn);


  /* ---------- Game state ---------- */
  const GAME = {
    width: RECT_WIDTH, height: RECT_HEIGHT, groundY: RECT_HEIGHT * 0.82,
    gravity: 1400, jumpV: -480, baseSpeed: 220, speed: 220,
    score: 0, best: 0,
    speedMultiplier: 1,
    mode: 'cube',
    gravityMode: 'normal',
    flipCooldown: 0
  };


  const player = { 
    x: GAME.width * 0.14, y: GAME.groundY - 34, w: 34, h: 34, 
    vy: 0, onGround: true, color: '#ffd200',
    prevY: GAME.groundY - 34,
    trail: [],
    rotation: 0,
    tilt: 0,
    cubeRotationSpeed: 0,
    gravityFlipped: false,
    gravityOrbs: []
  };


  /* ---------- Real Geometry Dash Difficulty Faces ---------- */
  const GD_DIFFICULTIES = [
    { 
      id: 1, 
      name: 'Easy', 
      color: '#4CAF50', 
      stars: 2,
      face: '😊',
      epicFace: '😊⭐'
    },
    { 
      id: 2, 
      name: 'Normal', 
      color: '#2196F3', 
      stars: 3,
      face: '😃',
      epicFace: '😃⭐'
    },
    { 
      id: 3, 
      name: 'Hard', 
      color: '#FF9800', 
      stars: 5,
      face: '😨',
      epicFace: '😨⭐'
    },
    { 
      id: 4, 
      name: 'Harder', 
      color: '#F44336', 
      stars: 6,
      face: '😰',
      epicFace: '😰⭐'
    },
    { 
      id: 5, 
      name: 'Insane', 
      color: '#9C27B0', 
      stars: 8,
      face: '🤯',
      epicFace: '🤯⭐'
    },
    { 
      id: 6, 
      name: 'Demon', 
      color: '#000000', 
      stars: 10,
      face: '😈',
      epicFace: '😈⭐'
    },
    { 
      id: 7, 
      name: 'Extreme Demon', 
      color: '#000000', 
      stars: 12,
      face: '👹',
      epicFace: '👹⭐'
    }
  ];


  /* ---------- Speed Modes ---------- */
  const SPEED_MODES = [
    { name: 'slow', multiplier: 0.5, color: '#00ccff' },
    { name: 'normal', multiplier: 1.0, color: '#00ff00' },
    { name: 'fast', multiplier: 1.5, color: '#ff9900' },
    { name: 'veryFast', multiplier: 2.0, color: '#ff3366' },
    { name: 'insane', multiplier: 3.0, color: '#ff00ff' }
  ];


  /* ---------- Wave Mode ---------- */
  const waveMode = {
    hitboxWidth: 24, // Reduced from 34
    hitboxHeight: 24, // Reduced from 34
    iconWidth: 34,
    iconHeight: 34,
    waveSpeed: 400,
    waveGravity: 1200
  };


  /* ---------- Spike hitbox reduction ---------- */
  function getSpikeHitbox(ob) {
    // Smaller rectangle inside the spike (like real GD)
    const widthReduction = 8; // Reduce width by 8px
    const heightReduction = 8; // Reduce height by 8px
    const offsetX = widthReduction / 2;
    const offsetY = heightReduction / 2;
    
    return {
      x: ob.x + offsetX,
      y: ob.y + offsetY,
      w: ob.w - widthReduction,
      h: ob.h - heightReduction
    };
  }


  /* ---------- Yellow Orb functionality ---------- */
  const yellowOrb = {
    width: 30,
    height: 30,
    collected: false,
    effect: function(player) {
      if (GAME.mode === 'cube' && !player.onGround) {
        player.vy = GAME.jumpV; // Jump boost
        createOrbEffect(player.x + player.w/2, player.y + player.h/2, '#ffd200');
        return true;
      }
      return false;
    }
  };


  /* ---------- Orb effects ---------- */
  function createOrbEffect(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      const size = 2 + Math.random() * 4;
      
      player.gravityOrbs.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        gravity: GAME.gravity,
        life: 0.8,
        color: color
      });
    }
  }


  /* ---------- Main Level (Updated with new features) ---------- */
  const prebuiltMainLevel = {
    mode: 'cube',
    length: 15000,
    name: '180 BPM Odyssey',
    difficulty: 4,
    description: 'A rhythm-based challenge perfectly synced to 180 BPM music!',
    obstacles: [
      { x: 500, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 650, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 800, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 950, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      // Add a yellow orb before a jump section
      { x: 1100, y: GAME.groundY - 150, w: 30, h: 30, type: 'yellowOrb', rotation: 0 },
      { x: 1133, y: GAME.groundY - 80, w: 80, h: 18, type: 'block', rotation: 0 },
      { x: 1250, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      // Add another yellow orb
      { x: 1400, y: GAME.groundY - 200, w: 30, h: 30, type: 'yellowOrb', rotation: 0 },
      { x: 1466, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 1600, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 1799, y: GAME.groundY - 150, w: 120, h: 18, type: 'platform', rotation: 0 },
      { x: 2000, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 2150, y: GAME.groundY - 28, w: 26, h: 28, type: 'spike', rotation: 0 },
      { x: 2300, y: 150, w: 40, h: 40, type: 'normalSpeedPortal', rotation: 0 },
      // New features
      { x: 2500, y: GAME.groundY - 40, w: 40, h: 40, type: 'gravityPortal', rotation: 0, gravityType: 'flip' },
      { x: 2700, y: 100, w: 40, h: 40, type: 'speedPortal', rotation: 0, speedMode: 'fast' },
      // Yellow orb after speed portal
      { x: 2850, y: GAME.groundY - 100, w: 30, h: 30, type: 'yellowOrb', rotation: 0 },
      { x: 2900, y: GAME.groundY - 60, w: 120, h: 30, type: 'textLabel', rotation: 0, text: 'Gravity Zone!', color: '#ff00ff' },
      { x: 3100, y: GAME.groundY - 40, w: 40, h: 40, type: 'gravityPortal', rotation: 0, gravityType: 'normal' }
    ]
  };


  /* ---------- Editor State ---------- */
  const editorState = {
    level: { mode: 'cube', length: 5000, obstacles: [], name: 'Untitled Level', difficulty: 1 },
    tool: 'place',
    placeType: 'spike',
    viewOffset: 0,
    snapToGrid: true,
    gridSize: 20,
    panning: false,
    startX: 0,
    startOffset: 0,
    selectedObject: null
  };


  // Try to load saved level
  try {
    const saved = safeStorage.getItem('gd_clone_custom_level');
    if (saved) editorState.level = JSON.parse(saved);
  } catch (e) {}


  let running = false, inMenu = false, inGame = false, inEditor = false, inLevelBrowser = false;
  let animationHandle = null, lastTime = 0, levelPlayState = null;
  let input = { hold: false };
  let editorSidebar = null;


  /* ---------- User System ---------- */
  let currentUser = null;
  
const userSystem = {
  async login(username, password) {
    try {
      const account = await firebaseRequest(`accounts/${username}`);
      
      if (account && account.password === password) {
        const modStatus = await firebaseRequest(`mods/moderator%20manager/${username}`);
        const elderStatus = await firebaseRequest(`ElderMods/ElderManager/${username}`);
        
        currentUser = {
          username: username,
          role: username === "Jackson" ? "owner" : elderStatus ? "elder" : modStatus ? "moderator" : "normal",
          isModerator: !!modStatus,
          isElder: !!elderStatus,
          isOwner: username === "Jackson",
          creatorPoints: account.creatorPoints || 0,
          banned: account.banned || false
        };
        
        safeStorage.setItem('gd_current_user', JSON.stringify(currentUser));
        return currentUser;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  },
  
 async register(username, password) {
  try {
    const existing = await firebaseRequest(`accounts/${username}`);
    if (existing) return { error: 'Username already exists' };


    await firebaseRequest(`accounts/${username}`, 'PUT', {
      password: password,
      creatorPoints: 0,
      likedLevels: [],
      joined: Date.now(),
      banned: false,
      role: 'normal'
    });


    return await this.login(username, password);
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Registration failed' };
  }
},
  
  getBadge(username) {
    if (username === "Jackson") return "👑";
    if (currentUser?.username === username && currentUser?.isElder) return "Ⓜ️👑";
    if (currentUser?.username === username && currentUser?.isModerator) return "Ⓜ️";
    return "";
  },
  
  async hasLikedLevel(levelId) {
    if (!currentUser || !currentUser.username) return false;
    try {
      const account = await firebaseRequest(`accounts/${currentUser.username}`);
      if (!account || !account.likedLevels) return false;
      return account.likedLevels.includes(levelId);
    } catch (error) {
      return false;
    }
  },
  
  async addLikedLevel(levelId) {
    if (!currentUser || !currentUser.username) return false;
    try {
      const account = await firebaseRequest(`accounts/${currentUser.username}`);
      if (!account) return false;
      
      const likedLevels = account.likedLevels || [];
      if (!likedLevels.includes(levelId)) {
        likedLevels.push(levelId);
        await firebaseRequest(`accounts/${currentUser.username}`, 'PATCH', {
          likedLevels: likedLevels
        });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
};


  /* ---------- Server Level System ---------- */
  const levelDatabase = {
    async saveLevel(level) {
      try {
        const response = await firebaseRequest('levels', 'POST', {
          ...level,
          creator: currentUser?.username || "Anonymous",
          published: Date.now(),
          plays: 0,
          likes: 0,
          rating: 0,
          ratings: [],
          comments: [],
          difficulty: level.difficulty || 1,
          featured: false,
          moderationStatus: "pending",
          flaggedBy: null,
          sentToJacksonBy: null,
          ratedByJackson: false,
          creatorPointsAwarded: false
        });
        
        return response.name;
      } catch (error) {
        console.error('Save level error:', error);
        throw error;
      }
    },
    
    async getLevels() {
      try {
        const levels = await firebaseRequest('levels');
        if (!levels) return [];
        
        return Object.entries(levels).map(([id, level]) => ({
          id: id,
          ...level
        })).sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.plays - a.plays || b.id.localeCompare(a.id);
        });
      } catch (error) {
        console.error('Get levels error:', error);
        return [];
      }
    },
    
    async getLevel(id) {
      try {
        const level = await firebaseRequest(`levels/${id}`);
        if (!level) return null;
        return { id: id, ...level };
      } catch (error) {
        return null;
      }
    },
    
    async updateLevel(id, updates) {
      try {
        await firebaseRequest(`levels/${id}`, 'PATCH', updates);
        return true;
      } catch (error) {
        return false;
      }
    },
    
    async incrementPlays(id) {
      try {
        const level = await this.getLevel(id);
        if (level) {
          await this.updateLevel(id, { plays: (level.plays || 0) + 1 });
          return level.plays + 1;
        }
      } catch (error) {}
      return null;
    },
    
    async likeLevel(id) {
      try {
        const level = await this.getLevel(id);
        if (!level) return null;
        
        const hasLiked = await userSystem.hasLikedLevel(id);
        if (hasLiked) {
          return level.likes;
        }
        
        await userSystem.addLikedLevel(id);
        
        const newLikes = (level.likes || 0) + 1;
        await this.updateLevel(id, { likes: newLikes });
        return newLikes;
      } catch (error) {
        console.error('Like error:', error);
        return null;
      }
    },
    
    async addRating(id, ratingInput) {
      // Only allow logged-in users to rate
      if (!currentUser || currentUser.username === 'Guest') {
        alert('Please log in to rate levels!');
        return null;
      }
      
      try {
        const ratingNum = parseFloat(ratingInput);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
          alert('Please enter a number between 1 and 10.');
          return null;
        }
        
        const level = await this.getLevel(id);
        if (!level) return null;
        
        const ratings = level.ratings || [];
        ratings.push({
          rating: ratingNum,
          rater: currentUser.username,
          timestamp: Date.now()
        });
        
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        const averageRating = Math.round((sum / ratings.length) * 10) / 10;
        
        const updates = {
          rating: averageRating,
          ratings: ratings
        };
        
        if (averageRating > 5 && !level.featured) {
          updates.featured = true;
        }
        
        await this.updateLevel(id, updates);
        return averageRating;
      } catch (error) {
        console.error('Add rating error:', error);
        return null;
      }
    },
    
    async addComment(levelId, commentText) {
      if (!currentUser || currentUser.username === 'Guest') {
        alert('Please log in to comment!');
        return null;
      }
      
      try {
        const level = await levelDatabase.getLevel(levelId);
        if (!level) return null;
        
        const comments = level.comments || [];
        const newComment = {
          author: currentUser.username,
          authorBadge: userSystem.getBadge(currentUser.username),
          text: commentText.substring(0, 200),
          timestamp: Date.now()
        };
        
        comments.push(newComment);
        
        await this.updateLevel(levelId, { comments: comments });
        return newComment;
      } catch (error) {
        console.error('Add comment error:', error);
        return null;
      }
    },
    
    async flagLevelForElder(levelId) {
      try {
        await this.updateLevel(levelId, {
          moderationStatus: "flagged",
          flaggedBy: currentUser?.username
        });
        return true;
      } catch (error) {
        console.error('Flag level error:', error);
        return false;
      }
    }
  };


  /* ---------- FIXED: Creator Points System ---------- */
  async function awardCreatorPoints(levelId, creatorUsername) {
    if (!currentUser || !currentUser.isOwner) {
      alert('Only Jackson can award Creator Points!');
      return;
    }
    
    try {
      // First, get the latest level data to ensure we have correct creator info
      const levelData = await levelDatabase.getLevel(levelId);
      if (!levelData) {
        alert('Error: Level not found!');
        return;
      }
      
      // Get the creator username from the level data (this is the FIX)
      const creatorName = levelData.creator || creatorUsername || levelData.author || "Anonymous";
      
      if (!creatorName || creatorName === "Anonymous" || creatorName === "Guest") {
        alert(`Cannot award Creator Points. Level creator is: "${creatorName}"`);
        return;
      }
      
      // Get creator's current account
      const creatorAccount = await firebaseRequest(`accounts/${creatorName}`);
      if (!creatorAccount) {
        alert(`Creator Account not found!\n\nUsername: "${creatorName}"\n\nThe user "${creatorName}" may have:\n1. Deleted their account\n2. Never registered properly\n3. Used a different username\n\nPlease check the Firebase "accounts" node.`);
        return;
      }
      
      // Award 1 CP
      const currentCP = creatorAccount.creatorPoints || 0;
      const newCP = currentCP + 1;
      
      await firebaseRequest(`accounts/${creatorName}`, 'PATCH', {
        creatorPoints: newCP
      });
      
      // Update current user's CP display if it's them
      if (currentUser.username === creatorName) {
        currentUser.creatorPoints = newCP;
        safeStorage.setItem('gd_current_user', JSON.stringify(currentUser));
      }
      
      // Mark level as rated
      await levelDatabase.updateLevel(levelId, {
        moderationStatus: 'rated',
        ratedByJackson: true,
        creatorPointsAwarded: true
      });
      
      alert(`✅ Awarded 1 🛠️ to ${creatorName}!\nThey now have ${newCP} Creator Points.`);
      
    } catch (error) {
      console.error('Error awarding CP:', error);
      alert('Failed to award Creator Points. Check console for details.');
    }
  }


  /* ---------- FIXED: Login System (Fixed CSS) ---------- */
  function showLoginScreen() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    inMenu = false; inGame = false; inEditor = false; inLevelBrowser = false;
    
    clearCanvas();
    
    const loginContainer = document.createElement('div');
    // FIXED CSS: Using proper kebab-case instead of camelCase
    loginContainer.style.cssText = `
      background: rgba(0,0,0,0.85);
      padding: 30px;
      border-radius: 15px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      width: 300px;
      border: 2px solid #4a8cff;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'GEOMETRY DASH';
    title.style.cssText = 'color: #fff; margin: 0 0 20px 0; text-align: center;';
    
const usernameInput = document.createElement('input');
usernameInput.type = 'text';
usernameInput.placeholder = 'Username';
usernameInput.maxLength = 12;  // Add this line
usernameInput.style.cssText = `
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #4a8cff;
  background: #222;
  color: #fff;
  width: 100%;
  box-sizing: border-box;
`;
    
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: 2px solid #4a8cff;
      background: #222;
      color: #fff;
      width: 100%;
      box-sizing: border-box;
    `;
    
    const loginBtn = document.createElement('button');
    loginBtn.textContent = 'LOGIN';
    loginBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #4a8cff;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      font-size: 16px;
    `;
    
    const registerBtn = document.createElement('button');
    registerBtn.textContent = 'REGISTER';
    registerBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #ff3366;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      font-size: 16px;
    `;
    
    const demoBtn = document.createElement('button');
    demoBtn.textContent = 'PLAY AS GUEST';
    demoBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #666;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      margin-top: 10px;
    `;
    
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'color: #ff3366; font-size: 12px; min-height: 20px; text-align: center;';
    
    loginContainer.appendChild(title);
    loginContainer.appendChild(usernameInput);
    loginContainer.appendChild(passwordInput);
    loginContainer.appendChild(loginBtn);
    loginContainer.appendChild(registerBtn);
    loginContainer.appendChild(demoBtn);
    loginContainer.appendChild(errorMsg);
    
    menuPanel.appendChild(loginContainer);
    
    // Draw background
    const time = Date.now() / 1000;
    const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
    const hue = (time * 50) % 360;
    g.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
    g.addColorStop(1, `hsl(${(hue + 60) % 360}, 100%, 50%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('GEOMETRY', GAME.width/2, 120);
    ctx.fillText('DASH', GAME.width/2, 160);
    ctx.shadowBlur = 0;
    
    loginBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (!username || !password) {
        errorMsg.textContent = 'Please enter username and password.';
        return;
      }
      
      const user = await userSystem.login(username, password);
      if (user) {
        if (user.banned) {
          errorMsg.textContent = 'This account has been banned.';
          return;
        }
        errorMsg.textContent = '';
        showLoadingThenMenu();
      } else {
        errorMsg.textContent = 'Invalid username or password.';
      }
    });
    
    registerBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (!username || !password) {
        errorMsg.textContent = 'Please enter username and password.';
        return;
      }
      
      const result = await userSystem.register(username, password);
      if (result.error) {
        errorMsg.textContent = result.error;
      } else {
        errorMsg.textContent = '';
        showLoadingThenMenu();
      }
    });
    
    demoBtn.addEventListener('click', () => {
      currentUser = {
        username: "Guest",
        role: "normal",
        isModerator: false,
        isElder: false,
        isOwner: false,
        creatorPoints: 0,
        banned: false,
        likedLevels: []
      };
      showLoadingThenMenu();
    });
  }


  /* ---------- Menu System ---------- */
  let menuKeyHandler = null;
  
  function showLoadingThenMenu() {
    menuPanel.innerHTML = '';
    inMenu = false; inGame = false; inEditor = false; inLevelBrowser = false;
    hud.innerText = '';
    
    let progress = 0;
    function drawLoading(progress) {
      clearCanvas();
      
      const time = Date.now() / 1000;
      const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
      const hue = (time * 50) % 360;
      g.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
      g.addColorStop(1, `hsl(${(hue + 60) % 360}, 100%, 50%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText('GEOMETRY', GAME.width/2, 120);
      ctx.fillText('DASH', GAME.width/2, 160);
      ctx.shadowBlur = 0;
      
      const barWidth = 300;
      const barHeight = 20;
      const barX = (GAME.width - barWidth) / 2;
      const barY = 220;
      
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, barX, barY, barWidth, barHeight, 10);
      
      ctx.fillStyle = '#fff';
      roundRect(ctx, barX, barY, (barWidth * progress) / 100, barHeight, 10);
      
      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText(`Loading ${Math.floor(progress)}%`, GAME.width/2, barY + barHeight + 25);
      
      ctx.textAlign = 'left';
    }
    
    function tick() {
      progress += 2 + Math.random() * 3;
      if (progress >= 100) {
        progress = 100;
        drawLoading(progress);
        setTimeout(() => {
          initMainMenu();
        }, 500);
      } else {
        drawLoading(progress);
        setTimeout(tick, 30);
      }
    }
    tick();
  }


  function initMainMenu() {
    inMenu = true; 
    inEditor = false;
    inGame = false;
    inLevelBrowser = false;
    
    menuPanel.innerHTML = ''; 
    menuPanel.style.display = 'flex';
    
    initMenuMusic();
    
    function drawMenuCanvas() {
      clearCanvas();
      
      const time = Date.now() / 1000;
      const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
      for (let i = 0; i < 6; i++) {
        const hue = (time * 20 + i * 60) % 360;
        g.addColorStop(i / 5, `hsl(${hue}, 100%, 60%)`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText('GEOMETRY', GAME.width/2, 100);
      ctx.fillText('DASH', GAME.width/2, 150);
      ctx.shadowBlur = 0;
      
      if (currentUser) {
        const badge = userSystem.getBadge(currentUser.username);
        ctx.fillStyle = currentUser.isOwner ? '#ffd700' : 
                       currentUser.isElder ? '#ff9800' : 
                       currentUser.isModerator ? '#4a8cff' : '#aaa';
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(`${currentUser.username} ${badge}`, GAME.width/2, 200);
        
        // Show creator points if > 0
        if (currentUser.creatorPoints > 0) {
          ctx.fillStyle = '#ffd700';
          ctx.font = '14px Arial, sans-serif';
          ctx.fillText(`🛠️ ${currentUser.creatorPoints} Creator Points`, GAME.width/2, 225);
        }
      }
    }
    
    drawMenuCanvas();


    const btnStyle = {
      width: '220px', 
      padding: '14px 16px', 
      background: 'rgba(255,255,255,0.2)',
      color: '#fff',
      borderRadius: '12px', 
      border: '2px solid rgba(255,255,255,0.3)',
      cursor: 'pointer',
      fontFamily: 'Arial, sans-serif', 
      fontSize: '18px', 
      textAlign: 'center',
      fontWeight: 'bold',
      backdropFilter: 'blur(10px)',
      margin: '4px 0'
    };


    function addButton(text, cb, icon = '') {
      const b = document.createElement('button');
      b.innerHTML = icon ? `<span style="margin-right: 8px">${icon}</span>${text}` : text;
      Object.assign(b.style, btnStyle);
      
      b.addEventListener('click', () => {
        menuPanel.style.display = 'none';
        if (menuKeyHandler) { 
          window.removeEventListener('keydown', menuKeyHandler); 
          menuKeyHandler = null; 
        }
        cb();
      });
      
      b.addEventListener('mouseenter', () => {
        b.style.background = 'rgba(255,255,255,0.3)';
        b.style.transform = 'translateY(-2px)';
      });
      b.addEventListener('mouseleave', () => {
        b.style.background = 'rgba(255,255,255,0.2)';
        b.style.transform = 'none';
      });
      
      menuPanel.appendChild(b);
      return b;
    }


    addButton('Play Main Level', () => startLevel(clone(prebuiltMainLevel)), '▶️');
    addButton('Level Editor', () => openEditor(), '✏️');
    addButton('Online Levels', () => openLevelBrowser(), '🌐');
    addButton('Create New Level', () => {
      editorState.level = { 
        mode: 'cube', 
        length: 5000, 
        obstacles: [], 
        name: 'Untitled Level', 
        difficulty: 1,
        description: ''
      };
      openEditor();
    }, '🆕');
    addButton('Profile', () => openProfilePage(), '👤');
    addButton('Logout', () => {
      currentUser = null;
      safeStorage.removeItem('gd_current_user');
      showLoginScreen();
    }, '🚪');


    // Add Moderation Tools for staff
    if (currentUser && (currentUser.isModerator || currentUser.isElder || currentUser.isOwner)) {
      addButton('Moderation Tools', () => openModerationTools(), '⚙️');
    }


    const buttons = Array.from(menuPanel.children);
    let sel = 0;
    function updateSelection() {
      buttons.forEach((b, i) => {
        b.style.background = i === sel ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)';
        b.style.border = i === sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.3)';
      });
    }
    updateSelection();
    
    menuKeyHandler = function (e) {
      if (!inMenu) return;
      if (e.code === 'ArrowUp') { 
        sel = (sel + buttons.length - 1) % buttons.length; 
        updateSelection(); 
      }
      else if (e.code === 'ArrowDown') { 
        sel = (sel + 1) % buttons.length; 
        updateSelection(); 
      }
      else if (e.code === 'Enter' || e.code === 'Space') buttons[sel].click();
      else if (e.code === 'Escape') cleanupAndClose();
    };
    window.addEventListener('keydown', menuKeyHandler);
    
    // Add Moderation Hub button (circular, bottom-right) for Jackson and Elder Moderators
    if (currentUser && (currentUser.isElder || currentUser.isOwner)) {
      const hubBtn = document.createElement('button');
      hubBtn.innerHTML = '⚙️';
      hubBtn.style.cssText = `
        position: absolute;
        right: 20px;
        bottom: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: ${currentUser.isOwner ? 'rgba(255,215,0,0.9)' : 'rgba(255,153,0,0.9)'};
        border: 3px solid #fff;
        color: #000;
        font-size: 24px;
        cursor: pointer;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      hubBtn.title = 'Moderation Hub';
      hubBtn.addEventListener('mouseenter', () => {
        hubBtn.style.transform = 'scale(1.1)';
        hubBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
      });
      hubBtn.addEventListener('mouseleave', () => {
        hubBtn.style.transform = 'scale(1)';
        hubBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      });
      hubBtn.addEventListener('click', openModerationHub);
      wrapper.appendChild(hubBtn);
    }
  }


  /* ---------- Level Editor with Sidebar ---------- */
  function openEditor() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'none';
    inEditor = true; inMenu = false; inGame = false; inLevelBrowser = false;
    
    // Clear any existing dialogs and sidebars
    const existingDialogs = document.querySelectorAll('.gd-dialog, .editor-sidebar');
    existingDialogs.forEach(d => {
      if (d.parentNode) d.parentNode.removeChild(d);
    });

    // Create sidebar
    editorSidebar = document.createElement('div');
    editorSidebar.className = 'editor-sidebar';
    editorSidebar.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 250px;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 100;
      padding: 15px;
      overflow-y: auto;
      border-right: 3px solid #4a8cff;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    // Level Name (20 character limit)
    const nameSection = document.createElement('div');
    nameSection.innerHTML = `
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Level Name (max 20 chars):</div>
      <input type="text" id="levelNameInput" maxlength="20" style="width: 100%; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #222; color: #fff;">
    `;
    const nameInput = nameSection.querySelector('#levelNameInput');
    nameInput.value = editorState.level.name || 'Untitled Level';
    nameInput.addEventListener('input', () => {
      editorState.level.name = nameInput.value.substring(0, 20);
    });
    editorSidebar.appendChild(nameSection);

    // Difficulty Selector
    const diffSection = document.createElement('div');
    diffSection.innerHTML = `
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Difficulty:</div>
      <select id="diffSelect" style="width: 100%; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #333; color: #fff;">
        ${GD_DIFFICULTIES.map(diff => `<option value="${diff.id}">${diff.name} ${diff.face}</option>`).join('')}
      </select>
    `;
    const diffSelect = diffSection.querySelector('#diffSelect');
    diffSelect.value = editorState.level.difficulty || 1;
    diffSelect.addEventListener('change', () => {
      editorState.level.difficulty = parseInt(diffSelect.value);
    });
    editorSidebar.appendChild(diffSection);

    // Tool Selection
    const toolSection = document.createElement('div');
    toolSection.innerHTML = `
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Tool:</div>
      <select id="toolSelect" style="width: 100%; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #333; color: #fff;">
        <option value="place">Place</option>
        <option value="select">Select</option>
        <option value="erase">Erase</option>
        <option value="pan">Pan</option>
      </select>
    `;
    const toolSelect = toolSection.querySelector('#toolSelect');
    toolSelect.value = editorState.tool;
    toolSelect.addEventListener('change', () => {
      editorState.tool = toolSelect.value;
      editorState.selectedObject = null;
      updateObjectProperties();
    });
    editorSidebar.appendChild(toolSection);

    // Object Type Selection
    const typeSection = document.createElement('div');
    typeSection.innerHTML = `
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Object Type:</div>
      <select id="typeSelect" style="width: 100%; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #333; color: #fff;">
        <option value="spike">Spike</option>
        <option value="block">Block</option>
        <option value="platform">Platform</option>
        <option value="cubePortal">Cube Portal</option>
        <option value="wavePortal">Wave Portal</option>
        <option value="gravityPortal">Gravity Portal</option>
        <option value="speedPortal">Speed Portal</option>
        <option value="textLabel">Text Label</option>
        <option value="yellowOrb">Yellow Orb</option>
      </select>
    `;
    const typeSelect = typeSection.querySelector('#typeSelect');
    typeSelect.value = editorState.placeType;
    typeSelect.addEventListener('change', () => {
      editorState.placeType = typeSelect.value;
    });
    editorSidebar.appendChild(typeSection);

    // Grid Controls
    const gridSection = document.createElement('div');
    gridSection.innerHTML = `
      <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Grid:</div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <input type="checkbox" id="gridToggle" style="transform: scale(1.2);">
        <label for="gridToggle" style="color: #fff;">Snap to Grid</label>
      </div>
      <div style="color: #fff; margin-bottom: 5px;">Grid Size: <span id="gridSizeValue">${editorState.gridSize}px</span></div>
      <input type="range" id="gridSizeSlider" min="10" max="50" step="5" value="${editorState.gridSize}" style="width: 100%;">
    `;
    const gridToggle = gridSection.querySelector('#gridToggle');
    gridToggle.checked = editorState.snapToGrid;
    gridToggle.addEventListener('change', (e) => {
      editorState.snapToGrid = e.target.checked;
      drawEditorCanvas();
    });
    
    const gridSizeSlider = gridSection.querySelector('#gridSizeSlider');
    const gridSizeValue = gridSection.querySelector('#gridSizeValue');
    gridSizeSlider.addEventListener('input', (e) => {
      editorState.gridSize = parseInt(e.target.value);
      gridSizeValue.textContent = `${editorState.gridSize}px`;
      drawEditorCanvas();
    });
    editorSidebar.appendChild(gridSection);

    // Object Properties Panel
    const propsSection = document.createElement('div');
    propsSection.id = 'objectProperties';
    propsSection.style.cssText = `
      background: rgba(255,255,255,0.1);
      padding: 10px;
      border-radius: 8px;
      margin-top: 10px;
      color: #fff;
      display: none;
    `;
    propsSection.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #ffd200;">Object Properties</div>
      <div id="propsContent"></div>
    `;
    editorSidebar.appendChild(propsSection);

    // Action Buttons
    const actionsSection = document.createElement('div');
    actionsSection.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 20px;';
    
    function createActionButton(text, onClick, color = '#4a8cff') {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 10px;
        background: ${color};
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = 'none';
      });
      btn.addEventListener('click', onClick);
      return btn;
    }

    actionsSection.appendChild(createActionButton('💾 Save Local', () => {
      try {
        safeStorage.setItem('gd_clone_custom_level', JSON.stringify(editorState.level));
        alert('✓ Level saved locally!');
      } catch (e) {
        alert('✓ Level saved in memory!');
      }
    }));
    
    actionsSection.appendChild(createActionButton('📤 Publish Online', async () => {
      if (!currentUser || currentUser.username === 'Guest') {
        alert('You must be logged in to publish levels online!');
        return;
      }
      
      const description = prompt('Enter level description (max 200 chars):');
      if (description === null) return;
      
      if (editorState.level.obstacles.length === 0) {
        alert('Cannot publish empty level! Add some obstacles first.');
        return;
      }
      
      const levelToPublish = {
        ...clone(editorState.level),
        description: description.substring(0, 200),
        author: currentUser.username,
        createdAt: new Date().toISOString(),
        rating: 0,
        ratings: [],
        comments: [],
        plays: 0,
        likes: 0,
        featured: false,
        moderationStatus: "pending",
        flaggedBy: null,
        sentToJacksonBy: null,
        ratedByJackson: false,
        creatorPointsAwarded: false
      };
      
      try {
        const levelId = await levelDatabase.saveLevel(levelToPublish);
        if (levelId) {
          alert(`✅ Level published successfully!\nLevel ID: ${levelId}\nIt will appear in the Online Levels browser.`);
        } else {
          alert('❌ Failed to publish level. Please try again.');
        }
      } catch (e) {
        alert('❌ Error publishing level. Check your connection.');
      }
    }, '#ffd200'));
    
    actionsSection.appendChild(createActionButton('📂 Load Local', () => {
      try {
        const s = safeStorage.getItem('gd_clone_custom_level');
        if (!s) { alert('No saved level found locally'); return; }
        editorState.level = JSON.parse(s);
        nameInput.value = editorState.level.name || 'Untitled Level';
        diffSelect.value = editorState.level.difficulty || 1;
        typeSelect.value = editorState.placeType || 'spike';
        alert('✓ Loaded from local storage');
      } catch (e) { 
        alert('No saved level found'); 
      }
    }, '#1fd'));
    
    actionsSection.appendChild(createActionButton('▶ Test Play', () => startLevel(clone(editorState.level)), '#4CAF50'));
    
    actionsSection.appendChild(createActionButton('🗑️ Clear All', () => {
      if (confirm('Clear entire level? This cannot be undone.')) {
        editorState.level.obstacles = [];
        editorState.selectedObject = null;
        propsSection.style.display = 'none';
        alert('Level cleared');
      }
    }, '#f44336'));
    
    actionsSection.appendChild(createActionButton('← Back to Menu', () => {
      cleanupEditor();
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      initMainMenu();
    }, '#666'));
    
    editorSidebar.appendChild(actionsSection);
    wrapper.appendChild(editorSidebar);

    // Object properties update function
    function updateObjectProperties() {
      const propsContent = document.getElementById('propsContent');
      propsSection.style.display = 'none';
      
      if (editorState.selectedObject) {
        propsSection.style.display = 'block';
        propsContent.innerHTML = '';
        
        if (editorState.selectedObject.type === 'gravityPortal') {
          propsContent.innerHTML = `
            <div style="margin-bottom: 5px;">Gravity Type:</div>
            <select id="gravityTypeSelect" style="width: 100%; padding: 5px; background: #333; color: #fff; border: 1px solid #4a8cff;">
              <option value="flip">Flip Gravity</option>
              <option value="normal">Normal Gravity</option>
              <option value="reverse">Reverse Gravity</option>
            </select>
          `;
          const select = propsContent.querySelector('#gravityTypeSelect');
          select.value = editorState.selectedObject.gravityType || 'flip';
          select.addEventListener('change', () => {
            editorState.selectedObject.gravityType = select.value;
            drawEditorCanvas();
          });
        } else if (editorState.selectedObject.type === 'speedPortal') {
          propsContent.innerHTML = `
            <div style="margin-bottom: 5px;">Speed Mode:</div>
            <select id="speedModeSelect" style="width: 100%; padding: 5px; background: #333; color: #fff; border: 1px solid #4a8cff;">
              ${SPEED_MODES.map(mode => `<option value="${mode.name}">${mode.name} (${mode.multiplier}x)</option>`).join('')}
            </select>
          `;
          const select = propsContent.querySelector('#speedModeSelect');
          select.value = editorState.selectedObject.speedMode || 'normal';
          select.addEventListener('change', () => {
            editorState.selectedObject.speedMode = select.value;
            drawEditorCanvas();
          });
        } else if (editorState.selectedObject.type === 'textLabel') {
          propsContent.innerHTML = `
            <div style="margin-bottom: 5px;">Text:</div>
            <input type="text" id="textLabelInput" value="${editorState.selectedObject.text || ''}" 
              style="width: 100%; padding: 5px; background: #333; color: #fff; border: 1px solid #4a8cff; margin-bottom: 10px;">
            <div style="margin-bottom: 5px;">Color:</div>
            <input type="color" id="textColorInput" value="${editorState.selectedObject.color || '#ffffff'}" 
              style="width: 100%; padding: 5px; background: #333; border: 1px solid #4a8cff;">
          `;
          
          const textInput = propsContent.querySelector('#textLabelInput');
          textInput.addEventListener('input', () => {
            editorState.selectedObject.text = textInput.value.substring(0, 30);
            editorState.selectedObject.w = Math.min(200, editorState.selectedObject.text.length * 12);
            drawEditorCanvas();
          });
          
          const colorInput = propsContent.querySelector('#textColorInput');
          colorInput.addEventListener('change', () => {
            editorState.selectedObject.color = colorInput.value;
            drawEditorCanvas();
          });
        } else {
          propsContent.innerHTML = '<div style="color: #aaa;">No editable properties for this object type.</div>';
        }
      }
    }

    // Add editor event handlers
    let editorPointerDownHandler, editorPointerMoveHandler, editorPointerUpHandler;
    let editorKeyDownHandler;
    
    editorPointerDownHandler = function (ev) {
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      
      if (editorState.tool === 'pan') {
        editorState.panning = true;
        editorState.startX = cx;
        editorState.startOffset = editorState.viewOffset;
      } else if (editorState.tool === 'place') {
        let worldX = editorState.viewOffset + cx;
        let worldY = Math.max(40, cy);
        
        // Apply grid snapping
        if (editorState.snapToGrid) {
          worldX = Math.round(worldX / editorState.gridSize) * editorState.gridSize;
          worldY = Math.round(worldY / editorState.gridSize) * editorState.gridSize;
          
          // Auto-snap spikes to ground when close
          if (editorState.placeType === 'spike' && 
              Math.abs(worldY - (GAME.groundY - 28)) < editorState.gridSize * 2) {
            worldY = GAME.groundY - 28;
          }
        }
        
        let ob;
        if (editorState.placeType === 'spike') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 26, 
            h: 28, 
            type: 'spike',
            rotation: 0
          };
        } else if (editorState.placeType === 'block') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 56, 
            h: 18, 
            type: 'block',
            rotation: 0
          };
        } else if (editorState.placeType === 'platform') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 110, 
            h: 18, 
            type: 'platform',
            rotation: 0
          };
        } else if (editorState.placeType === 'cubePortal') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 40, 
            h: 40, 
            type: 'cubePortal',
            rotation: 0
          };
        } else if (editorState.placeType === 'wavePortal') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 40, 
            h: 40, 
            type: 'wavePortal',
            rotation: 0
          };
        } else if (editorState.placeType === 'gravityPortal') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 40, 
            h: 40, 
            type: 'gravityPortal',
            rotation: 0,
            gravityType: 'flip'
          };
        } else if (editorState.placeType === 'speedPortal') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 40, 
            h: 40, 
            type: 'speedPortal',
            rotation: 0,
            speedMode: 'normal'
          };
        } else if (editorState.placeType === 'textLabel') {
          const text = prompt('Enter text for label (max 30 chars):', 'Text');
          if (text === null) return;
          ob = { 
            x: worldX, 
            y: worldY,
            w: Math.min(200, text.length * 12),
            h: 30,
            type: 'textLabel',
            rotation: 0,
            text: text.substring(0, 30),
            color: '#ffffff'
          };
        } else if (editorState.placeType === 'yellowOrb') {
          ob = { 
            x: worldX, 
            y: worldY,
            w: 30, 
            h: 30, 
            type: 'yellowOrb',
            rotation: 0
          };
        }
        
        if (ob) {
          ob.x = Math.max(0, Math.min(editorState.level.length - ob.w, ob.x));
          ob.y = Math.max(0, Math.min(GAME.groundY - ob.h, ob.y));
          editorState.level.obstacles.push(ob);
        }
      } else if (editorState.tool === 'select') {
        const wx = editorState.viewOffset + cx;
        const wy = cy;
        
        for (let i = editorState.level.obstacles.length - 1; i >= 0; i--) {
          const o = editorState.level.obstacles[i];
          if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) {
            editorState.selectedObject = o;
            updateObjectProperties();
            break;
          }
        }
      } else if (editorState.tool === 'erase') {
        const wx = editorState.viewOffset + cx;
        const wy = cy;
        for (let i = editorState.level.obstacles.length - 1; i >= 0; i--) {
          const o = editorState.level.obstacles[i];
          if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) {
            editorState.level.obstacles.splice(i, 1);
            if (editorState.selectedObject === o) {
              editorState.selectedObject = null;
              updateObjectProperties();
            }
            break;
          }
        }
      }
      
      drawEditorCanvas();
    };


    editorPointerMoveHandler = function (ev) {
      if (editorState.panning) {
        const rect = canvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const dx = editorState.startX - cx;
        editorState.viewOffset = Math.max(0, 
          Math.min(editorState.level.length - GAME.width, 
          Math.round(editorState.startOffset + dx)));
        drawEditorCanvas();
      }
    };


    editorPointerUpHandler = function (ev) {
      editorState.panning = false;
    };
    
    editorKeyDownHandler = function handleEditorKeys(e) {
      if (!inEditor) return;
      const scrollAmount = e.shiftKey ? 200 : 50;
      switch(e.key) {
        case 'ArrowLeft':
          editorState.viewOffset = Math.max(0, editorState.viewOffset - scrollAmount);
          drawEditorCanvas();
          break;
        case 'ArrowRight':
          editorState.viewOffset = Math.min(editorState.level.length - GAME.width, 
            editorState.viewOffset + scrollAmount);
          drawEditorCanvas();
          break;
        case 'Home':
          editorState.viewOffset = 0;
          drawEditorCanvas();
          break;
        case 'End':
          editorState.viewOffset = Math.max(0, editorState.level.length - GAME.width);
          drawEditorCanvas();
          break;
        case 'Delete':
          if (editorState.selectedObject) {
            const index = editorState.level.obstacles.indexOf(editorState.selectedObject);
            if (index !== -1) {
              editorState.level.obstacles.splice(index, 1);
              editorState.selectedObject = null;
              updateObjectProperties();
              drawEditorCanvas();
            }
          }
          break;
        case 'Escape':
          if (editorState.selectedObject) {
            editorState.selectedObject = null;
            updateObjectProperties();
            drawEditorCanvas();
          }
          break;
      }
    };


    canvas.addEventListener('pointerdown', editorPointerDownHandler);
    window.addEventListener('pointermove', editorPointerMoveHandler);
    window.addEventListener('pointerup', editorPointerUpHandler);
    window.addEventListener('keydown', editorKeyDownHandler);


    // Draw editor canvas
    function drawEditorCanvas() {
      clearCanvas();
      
      // Draw grid
      if (editorState.snapToGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = -(editorState.viewOffset % editorState.gridSize); x < GAME.width; x += editorState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, GAME.height);
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < GAME.height; y += editorState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(GAME.width, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw background
      const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
      g.addColorStop(0, 'rgba(100, 100,255, 0.2)');
      g.addColorStop(1, 'rgba(150, 100,255, 0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
      
      // Draw ground
      ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
      ctx.fillRect(0, GAME.groundY, GAME.width, GAME.height - GAME.groundY);
      ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
      ctx.fillRect(0, GAME.groundY, GAME.width, 4);


      // Draw obstacles
      editorState.level.obstacles.forEach(ob => {
        const sx = Math.round(ob.x - editorState.viewOffset);
        if (sx < -200 || sx > GAME.width + 200) return;
        drawObstacle(ob, sx);
        
        if (editorState.selectedObject === ob) {
          ctx.strokeStyle = '#ffd200';
          ctx.lineWidth = 3;
          ctx.strokeRect(sx - 3, ob.y - 3, ob.w + 6, ob.h + 6);
        }
      });
      
      // Draw viewport indicator
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(GAME.width - 100, 10, 90, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(`View: ${Math.round(editorState.viewOffset)}`, GAME.width - 95, 25);
      ctx.fillText(`Objs: ${editorState.level.obstacles.length}`, GAME.width - 95, 40);
    }
    
    // Clean up function
    function cleanupEditor() {
      canvas.removeEventListener('pointerdown', editorPointerDownHandler);
      window.removeEventListener('pointermove', editorPointerMoveHandler);
      window.removeEventListener('pointerup', editorPointerUpHandler);
      window.removeEventListener('keydown', editorKeyDownHandler);
      if (editorSidebar && editorSidebar.parentNode) {
        editorSidebar.parentNode.removeChild(editorSidebar);
      }
      inEditor = false;
    }
    
    // Store cleanup function
    editorSidebar._cleanup = cleanupEditor;
    
    drawEditorCanvas();
  }


  /* ---------- Comments Dialog ---------- */
  async function openCommentsDialog(levelId, level) {
    const modal = document.createElement('div');
    modal.className = 'gd-dialog';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.95);
      padding: 20px;
      border-radius: 15px;
      width: 500px;
      max-height: 400px;
      overflow-y: auto;
      border: 3px solid #4a8cff;
      z-index: 1000;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      right: 10px;
      top: 10px;
      background: #ff3366;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 5px 10px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = `💬 Comments: ${level.name}`;
    title.style.cssText = 'color: #fff; margin-top: 0;';
    
    const commentsContainer = document.createElement('div');
    commentsContainer.style.cssText = `
      margin: 20px 0;
      max-height: 200px;
      overflow-y: auto;
    `;
    
    // Load and display comments
    async function loadComments() {
      const currentLevel = await levelDatabase.getLevel(levelId);
      commentsContainer.innerHTML = '';
      
      if (!currentLevel.comments || currentLevel.comments.length === 0) {
        commentsContainer.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No comments yet. Be the first!</div>';
        return;
      }
      
      currentLevel.comments.forEach(comment => {
        const commentDiv = document.createElement('div');
        commentDiv.style.cssText = `
          background: rgba(255,255,255,0.1);
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 10px;
        `;
        commentDiv.innerHTML = `
          <div style="color: #4a8cff; font-weight: bold;">
            ${comment.author} ${comment.authorBadge || ''}
          </div>
          <div style="color: #fff; margin: 5px 0;">${comment.text}</div>
          <div style="color: #aaa; font-size: 12px;">
            ${new Date(comment.timestamp).toLocaleString()}
          </div>
        `;
        commentsContainer.appendChild(commentDiv);
      });
    }
    
    // Add comment form
    const commentForm = document.createElement('div');
    commentForm.innerHTML = `
      <textarea id="newCommentText" placeholder="Write a comment..." style="width: 100%; height: 60px; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #222; color: #fff; margin-bottom: 10px;"></textarea>
      <button id="postCommentBtn" style="padding: 8px 12px; background: #4a8cff; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Post Comment</button>
    `;
    
    closeBtn.addEventListener('click', () => modal.remove());
    
    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(commentsContainer);
    modal.appendChild(commentForm);
    
    wrapper.appendChild(modal);
    
    // Handle comment posting
    commentForm.querySelector('#postCommentBtn').addEventListener('click', async () => {
      const text = commentForm.querySelector('#newCommentText').value.trim();
      if (!text) return;
      
      const newComment = await levelDatabase.addComment(levelId, text);
      if (newComment) {
        commentForm.querySelector('#newCommentText').value = '';
        loadComments();
        
        // Update comment count on level card
        const commentsBtn = document.querySelector(`.comments-btn[data-level-id="${levelId}"]`);
        if (commentsBtn) {
          const currentCount = parseInt(commentsBtn.textContent.match(/\((\d+)\)/)?.[1] || 0);
          commentsBtn.textContent = `💬 (${currentCount + 1})`;
        }
      }
    });
    
    loadComments();
  }


  /* ---------- Level Browser ---------- */
  async function openLevelBrowser() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    menuPanel.style.flexDirection = 'column';
    inLevelBrowser = true; inMenu = false; inEditor = false; inGame = false;
    
    clearCanvas();
    
    const browserContainer = document.createElement('div');
    browserContainer.style.cssText = `
      background: rgba(0,0,0,0.95);
      padding: 20px;
      border-radius: 15px;
      width: 500px;
      max-height: ${GAME.height - 100}px;
      overflow-y: auto;
      border: 3px solid #4a8cff;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
    
    const title = document.createElement('h2');
    title.textContent = '🌐 Online Levels';
    title.style.cssText = 'color: #4a8cff; margin: 0;';
    
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄 Refresh';
    refreshBtn.style.cssText = `
      padding: 8px 12px;
      background: #4a8cff;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    `;
    
    const leaderboardBtn = document.createElement('button');
    leaderboardBtn.textContent = '🏆 Leaderboard';
    leaderboardBtn.style.cssText = `
      padding: 8px 12px;
      background: linear-gradient(135deg, #ffd700, #ff9800);
      color: #000;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      margin-left: 8px;
    `;
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.style.cssText = `
      padding: 8px 12px;
      background: #ff3366;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-left: 8px;
    `;
    
    header.appendChild(title);
    header.appendChild(refreshBtn);
    header.appendChild(leaderboardBtn);
    header.appendChild(backBtn);
    browserContainer.appendChild(header);
    
    const levelsContainer = document.createElement('div');
    levelsContainer.id = 'levelsContainer';
    browserContainer.appendChild(levelsContainer);
    
    async function loadLevels() {
      levelsContainer.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Loading online levels...</div>';
      
      try {
        const levels = await levelDatabase.getLevels();
        
        if (levels.length === 0) {
          levelsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #aaa;">
              <div style="font-size: 48px; margin-bottom: 20px;">📁</div>
              <h3 style="color: #fff;">No Online Levels Yet!</h3>
              <p>Be the first to create and publish a level!</p>
              <button id="createFirstLevel" style="padding: 12px 24px; background: #4a8cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; font-weight: bold;">
                Create First Level
              </button>
            </div>
          `;
          
          const createBtn = levelsContainer.querySelector('#createFirstLevel');
          if (createBtn) {
            createBtn.addEventListener('click', () => {
              editorState.level = { 
                mode: 'cube', 
                length: 5000, 
                obstacles: [], 
                name: 'My First Level', 
                difficulty: 1,
                description: ''
              };
              openEditor();
            });
          }
        } else {
          levelsContainer.innerHTML = '';
          
          levels.forEach(level => {
            const difficulty = GD_DIFFICULTIES.find(d => d.id === level.difficulty) || GD_DIFFICULTIES[0];
            const levelFace = level.featured ? difficulty.epicFace : difficulty.face;
            
            const levelCard = document.createElement('div');
            levelCard.style.cssText = `
              background: ${level.featured 
                ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 153, 0, 0.1))'
                : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))'};
              padding: 15px;
              border-radius: 10px;
              margin-bottom: 15px;
              border-left: 4px solid ${difficulty.color};
              cursor: pointer;
              transition: all 0.2s;
            `;
            
            levelCard.addEventListener('mouseenter', () => {
              levelCard.style.transform = 'translateY(-3px)';
              levelCard.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
            });
            
            levelCard.addEventListener('mouseleave', () => {
              levelCard.style.transform = 'none';
              levelCard.style.boxShadow = 'none';
            });
            
            // Check if user has liked this level
            const hasLiked = currentUser && currentUser.likedLevels && currentUser.likedLevels.includes(level.id);
            const likeText = hasLiked ? 'Liked ✓' : `Like (${level.likes || 0})`;
            const likeColor = hasLiked ? '#666' : '#2196F3';
            const commentsCount = level.comments ? level.comments.length : 0;
            
            // Determine which buttons to show based on user role
            let additionalButtons = '';
            
            // Normal users only see Play and Like
            let buttonRow = `
              <button class="play-btn" style="padding: 8px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                Play Now
              </button>
              <button class="like-btn" style="padding: 8px 12px; background: ${likeColor}; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                ${likeText}
              </button>
            `;
            
            // Moderators (but not elders or owner) get "Send to Elder" button
            if (currentUser && currentUser.isModerator && !currentUser.isElder && !currentUser.isOwner) {
              buttonRow += `
                <button class="send-to-elder-btn" style="padding: 8px 12px; background: #ff9800; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                  Ⓜ️ Send to Elder
                </button>
              `;
            }
            
            // Elder Moderators and Jackson can send to Jackson
            if (currentUser && (currentUser.isElder || currentUser.isOwner)) {
              buttonRow += `
                <button class="send-to-jackson-btn" style="padding: 8px 12px; background: #ffd700; color: #000; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                  👑 Send to Jackson
                </button>
              `;
            }
            
            // Jackson also gets rate button
            if (currentUser && currentUser.isOwner) {
              buttonRow += `
                <button class="rate-level-btn" style="padding: 8px 12px; background: #ff3366; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                  🛠️ Rate Level
                </button>
              `;
            }
            
            // Add comments button for everyone
            buttonRow += `
              <button class="comments-btn" data-level-id="${level.id}" style="padding: 8px 12px; background: #9C27B0; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                💬 (${commentsCount})
              </button>
            `;
            
            levelCard.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <div style="font-weight: bold; font-size: 18px; color: #fff;">
                    ${level.name} ${levelFace}
                    ${level.featured ? '<span style="color: #ffd700; font-size: 12px; margin-left: 5px;">★ EPIC</span>' : ''}
                  </div>
                  <div style="color: #aaa; font-size: 12px; margin-top: 5px;">
                    By: ${level.creator || 'Unknown'} | ${difficulty.name} | ⭐${level.rating || '0'} 
                    | 👁️${level.plays || 0} | 👍${level.likes || 0}
                  </div>
                  ${level.description ? `<div style="color: #ccc; font-size: 13px; margin-top: 8px;">${level.description}</div>` : ''}
                  <div style="color: #888; font-size: 11px; margin-top: 5px;">
                    ID: ${level.id}
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 5px; margin-top: 10px;">
                ${buttonRow}
              </div>
            `;
            
            levelsContainer.appendChild(levelCard);
            
            // Attach event listeners
            const playBtn = levelCard.querySelector('.play-btn');
            const likeBtn = levelCard.querySelector('.like-btn');
            const commentsBtn = levelCard.querySelector('.comments-btn');
            const sendToElderBtn = levelCard.querySelector('.send-to-elder-btn');
            const sendToJacksonBtn = levelCard.querySelector('.send-to-jackson-btn');
            const rateLevelBtn = levelCard.querySelector('.rate-level-btn');
            
            playBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              try {
                const fullLevel = await levelDatabase.getLevel(level.id);
                if (fullLevel) {
                  await levelDatabase.incrementPlays(level.id);
                  startLevel(fullLevel);
                }
              } catch (error) {
                console.error('Error loading level:', error);
                alert('Error loading level. Please try again.');
              }
            });
            
            likeBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (!currentUser || currentUser.username === 'Guest') {
                alert('Please log in to like levels!');
                return;
              }
              
              const newLikes = await levelDatabase.likeLevel(level.id);
              if (newLikes !== null) {
                if (currentUser.likedLevels && !currentUser.likedLevels.includes(level.id)) {
                  currentUser.likedLevels.push(level.id);
                  safeStorage.setItem('gd_current_user', JSON.stringify(currentUser));
                }
                likeBtn.textContent = 'Liked ✓';
                likeBtn.style.background = '#666';
                likeBtn.disabled = true;
              }
            });
            
            commentsBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              openCommentsDialog(level.id, level);
            });
            
            if (sendToElderBtn) {
              sendToElderBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser || currentUser.username === 'Guest') {
                  alert('Please log in to use moderation tools!');
                  return;
                }
                
                if (confirm(`Send "${level.name}" to Elder Moderators for review?`)) {
                  const success = await levelDatabase.flagLevelForElder(level.id);
                  if (success) {
                    sendToElderBtn.textContent = '✓ Sent';
                    sendToElderBtn.disabled = true;
                    sendToElderBtn.style.background = '#666';
                    alert('Level sent to Elder Moderators for review.');
                  } else {
                    alert('Failed to send level. Please try again.');
                  }
                }
              });
            }
            
            if (sendToJacksonBtn) {
              sendToJacksonBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser || currentUser.username === 'Guest') {
                  alert('Please log in to use moderation tools!');
                  return;
                }
                
                if (confirm(`Send "${level.name}" to Jackson for rating?`)) {
                  const success = await levelDatabase.updateLevel(level.id, {
                    moderationStatus: "sentToJackson",
                    sentToJacksonBy: currentUser.username
                  });
                  if (success) {
                    sendToJacksonBtn.textContent = '✓ Sent';
                    sendToJacksonBtn.disabled = true;
                    sendToJacksonBtn.style.background = '#666';
                    alert('Level sent to Jackson for rating.');
                  } else {
                    alert('Failed to send level. Please try again.');
                  }
                }
              });
            }
            
            if (rateLevelBtn) {
              rateLevelBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser || currentUser.username === 'Guest') {
                  alert('Please log in to rate levels!');
                  return;
                }
                
                const rating = prompt('Rate this level from 1-10:', '7');
                if (rating !== null) {
                  const newRating = await levelDatabase.addRating(level.id, rating);
                  if (newRating !== null) {
                    rateLevelBtn.textContent = `Rated: ${newRating}`;
                    rateLevelBtn.disabled = true;
                    rateLevelBtn.style.background = '#666';
                    alert(`Rating submitted! New average: ${newRating}`);
                  }
                }
              });
            }
            
            // Make entire card clickable to play
            levelCard.addEventListener('click', async (e) => {
              if (!e.target.closest('button')) {
                try {
                  const fullLevel = await levelDatabase.getLevel(level.id);
                  if (fullLevel) {
                    await levelDatabase.incrementPlays(level.id);
                    startLevel(fullLevel);
                  }
                } catch (error) {
                  console.error('Error loading level:', error);
                  alert('Error loading level. Please try again.');
                }
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading levels:', error);
        levelsContainer.innerHTML = `
          <div style="color: #ff3366; text-align: center; padding: 20px;">
            <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
            <h3 style="color: #fff;">Connection Error</h3>
            <p>Could not load online levels. Please check your internet connection and try again.</p>
          </div>
        `;
      }
    }
    
    refreshBtn.addEventListener('click', loadLevels);
    leaderboardBtn.addEventListener('click', openCreatorLeaderboard);
    backBtn.addEventListener('click', () => {
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      initMainMenu();
      inLevelBrowser = false;
    });
    
    menuPanel.appendChild(browserContainer);
    loadLevels();
  }


  /* ---------- Creator Leaderboard ---------- */
  async function openCreatorLeaderboard() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    menuPanel.style.flexDirection = 'column';
    
    const leaderboardContainer = document.createElement('div');
    leaderboardContainer.style.cssText = `
      background: rgba(0,0,0,0.95);
      padding: 20px;
      border-radius: 15px;
      width: 400px;
      max-height: ${GAME.height - 100}px;
      overflow-y: auto;
      border: 3px solid #ffd700;
    `;
    
    const title = document.createElement('h2');
    title.innerHTML = '🏆 Creator Leaderboard';
    title.style.cssText = 'color: #ffd700; margin: 0 0 20px 0; text-align: center;';
    
    const leaderboardList = document.createElement('div');
    leaderboardList.id = 'leaderboardList';
    leaderboardList.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 20px;
    `;
    
    async function loadLeaderboard() {
      try {
        const accounts = await firebaseRequest('accounts');
        if (!accounts) {
          leaderboardList.innerHTML = '<div style="color: #aaa; text-align: center;">No creators yet.</div>';
          return;
        }
        
        // Convert to array and sort by CP
        const creators = Object.entries(accounts)
          .filter(([username, data]) => !data.banned && (data.creatorPoints || 0) > 0)
          .map(([username, data]) => ({
            username,
            cp: data.creatorPoints || 0,
            role: data.role || 'normal'
          }))
          .sort((a, b) => b.cp - a.cp);
        
        if (creators.length === 0) {
          leaderboardList.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">No Creator Points awarded yet.</div>';
          return;
        }
        
        leaderboardList.innerHTML = '';
        
        creators.forEach((creator, index) => {
          const rank = index + 1;
          const badge = creator.username === "Jackson" ? "👑" : 
                       creator.role === "elder" ? "Ⓜ️👑" : 
                       creator.role === "moderator" ? "Ⓜ️" : "";
          
          const creatorRow = document.createElement('div');
          creatorRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: ${index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'};
            border-radius: 6px;
            margin-bottom: 5px;
          `;
          
          creatorRow.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 18px; color: ${rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#fff'}; width: 30px; text-align: center;">
                ${rank}
              </div>
              <div style="font-weight: bold; color: #fff;">
                ${creator.username} ${badge}
              </div>
            </div>
            <div style="color: #ffd700; font-size: 18px;">
              🛠️ ${creator.cp}
            </div>
          `;
          
          leaderboardList.appendChild(creatorRow);
        });
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = '<div style="color: #ff3366; text-align: center;">Error loading leaderboard.</div>';
      }
    }
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Levels';
    backBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #666;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
    `;
    backBtn.addEventListener('click', () => {
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      openLevelBrowser();
    });
    
    leaderboardContainer.appendChild(title);
    leaderboardContainer.appendChild(leaderboardList);
    leaderboardContainer.appendChild(backBtn);
    menuPanel.appendChild(leaderboardContainer);
    
    loadLeaderboard();
  }


  /* ---------- Profile Page ---------- */
  function openProfilePage() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    
    clearCanvas();
    
    const profileContainer = document.createElement('div');
    profileContainer.style.cssText = `
      background: rgba(0,0,0,0.9);
      padding: 30px;
      border-radius: 15px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      width: 300px;
      border: 2px solid ${currentUser?.isOwner ? '#ffd700' : 
                       currentUser?.isElder ? '#ff9800' : 
                       currentUser?.isModerator ? '#4a8cff' : '#666'};
    `;
    
    const badge = userSystem.getBadge(currentUser?.username || '');
    const title = document.createElement('h2');
    title.innerHTML = `${currentUser?.username || 'Guest'} ${badge}`;
    title.style.cssText = 'color: #fff; margin: 0; text-align: center; font-size: 24px;';
    
    const roleText = document.createElement('div');
    roleText.textContent = `Role: ${currentUser?.role?.toUpperCase() || 'GUEST'}`;
    roleText.style.cssText = `color: ${currentUser?.isOwner ? '#ffd700' : 
                            currentUser?.isElder ? '#ff9800' : 
                            currentUser?.isModerator ? '#4a8cff' : '#aaa'}; 
                            font-size: 16px; font-weight: bold;`;
    
    if (currentUser && currentUser.creatorPoints > 0) {
      const cpText = document.createElement('div');
      cpText.innerHTML = `🛠️ Creator Points: ${currentUser.creatorPoints}`;
      cpText.style.cssText = 'color: #ffd700; font-size: 18px; font-weight: bold;';
      profileContainer.appendChild(cpText);
    }
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Menu';
    backBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #666;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
    `;
    
    profileContainer.appendChild(title);
    profileContainer.appendChild(roleText);
    profileContainer.appendChild(backBtn);
    
    backBtn.addEventListener('click', () => {
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      initMainMenu();
    });
    
    menuPanel.appendChild(profileContainer);
  }


  /* ---------- Moderation Hub with Player Management ---------- */
  async function openModerationHub() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    menuPanel.style.flexDirection = 'column';
    
    const hubContainer = document.createElement('div');
    hubContainer.style.cssText = `
      background: rgba(0,0,0,0.95);
      padding: 20px;
      border-radius: 15px;
      width: 600px;
      max-height: ${GAME.height - 100}px;
      overflow-y: auto;
      border: 3px solid ${currentUser?.isOwner ? '#ffd700' : '#ff9800'};
    `;
    
    // Create tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;';
    
    const sentTabBtn = document.createElement('button');
    sentTabBtn.textContent = '📨 Sent Tab';
    sentTabBtn.style.cssText = `
      padding: 10px 20px;
      background: #4a8cff;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      flex: 1;
      min-width: 150px;
    `;
    
    const jacksonTabBtn = document.createElement('button');
    jacksonTabBtn.textContent = '👑 Jackson\'s Queue';
    jacksonTabBtn.style.cssText = `
      padding: 10px 20px;
      background: #666;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      flex: 1;
      min-width: 150px;
    `;
    
    const playerManagementBtn = document.createElement('button');
    playerManagementBtn.textContent = '👤 Player Management';
    playerManagementBtn.style.cssText = `
      padding: 10px 20px;
      background: #666;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      flex: 1;
      min-width: 150px;
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.id = 'moderationContent';
    contentDiv.style.cssText = 'min-height: 300px;';
    
    tabs.appendChild(sentTabBtn);
    if (currentUser.isOwner) {
      tabs.appendChild(jacksonTabBtn);
      tabs.appendChild(playerManagementBtn);
    } else if (currentUser.isElder) {
      tabs.appendChild(jacksonTabBtn);
    }
    
    hubContainer.appendChild(tabs);
    hubContainer.appendChild(contentDiv);
    
    // Load sent levels (flagged by moderators)
    async function loadSentLevels() {
      try {
        const levels = await firebaseRequest('levels');
        const flaggedLevels = Object.entries(levels || {})
          .filter(([id, level]) => level.moderationStatus === 'flagged')
          .map(([id, level]) => ({ id, ...level }));
        
        contentDiv.innerHTML = '';
        
        if (flaggedLevels.length === 0) {
          contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">No levels waiting for review.</div>';
          return;
        }
        
        flaggedLevels.forEach(level => {
          const levelCard = document.createElement('div');
          levelCard.style.cssText = `
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 10px;
            border-left: 4px solid #ff3366;
          `;
          
          levelCard.innerHTML = `
            <div style="font-weight: bold; color: #fff;">${level.name}</div>
            <div style="color: #aaa; font-size: 12px;">
              By: ${level.creator || 'Unknown'} | Flagged by: ${level.flaggedBy || 'Unknown'}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="play-level-btn" data-id="${level.id}" style="padding: 8px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                ▶ Play
              </button>
              ${currentUser.isOwner ? `
                <button class="rate-level-btn" data-id="${level.id}" data-creator="${level.creator}" style="padding: 8px 12px; background: #ffd700; color: #000; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                  🛠️ Rate & Award CP
                </button>
              ` : `
                <button class="send-to-jackson-btn" data-id="${level.id}" style="padding: 8px 12px; background: #ff9800; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                  👑 Send to Jackson
                </button>
              `}
            </div>
          `;
          
          contentDiv.appendChild(levelCard);
        });
        
        // Add event listeners
        contentDiv.querySelectorAll('.play-level-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const levelId = e.target.dataset.id;
            const level = await levelDatabase.getLevel(levelId);
            if (level) {
              menuPanel.innerHTML = '';
              menuPanel.style.display = 'none';
              startLevel(level);
            }
          });
        });
        
        if (currentUser.isOwner) {
          contentDiv.querySelectorAll('.rate-level-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const levelId = e.target.dataset.id;
              const creator = e.target.dataset.creator;
              await awardCreatorPoints(levelId, creator);
              e.target.textContent = '✓ Rated';
              e.target.disabled = true;
              e.target.style.background = '#666';
            });
          });
        } else {
          contentDiv.querySelectorAll('.send-to-jackson-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const levelId = e.target.dataset.id;
              await levelDatabase.updateLevel(levelId, {
                moderationStatus: 'sentToJackson',
                sentToJacksonBy: currentUser.username
              });
              e.target.textContent = '✓ Sent';
              e.target.disabled = true;
              e.target.style.background = '#666';
            });
          });
        }
      } catch (error) {
        console.error('Error loading sent levels:', error);
        contentDiv.innerHTML = '<div style="color: #ff3366; text-align: center;">Error loading levels.</div>';
      }
    }
    
    // Load Jackson's queue (only for Jackson)
    async function loadJacksonQueue() {
      try {
        const levels = await firebaseRequest('levels');
        const jacksonQueue = Object.entries(levels || {})
          .filter(([id, level]) => level.moderationStatus === 'sentToJackson')
          .map(([id, level]) => ({ id, ...level }));
        
        contentDiv.innerHTML = '';
        
        if (jacksonQueue.length === 0) {
          contentDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">No levels in your queue.</div>';
          return;
        }
        
        jacksonQueue.forEach(level => {
          const levelCard = document.createElement('div');
          levelCard.style.cssText = `
            background: rgba(255,215,0,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 10px;
            border: 2px solid #ffd700;
          `;
          
          levelCard.innerHTML = `
            <div style="font-weight: bold; color: #fff;">${level.name} ★</div>
            <div style="color: #aaa; font-size: 12px;">
              By: ${level.creator || 'Unknown'} | Sent by: ${level.sentToJacksonBy || 'Elder'}
            </div>
            <div style="color: #ccc; font-size: 13px; margin: 8px 0;">${level.description || 'No description'}</div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="play-level-btn" data-id="${level.id}" style="padding: 8px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                ▶ Play
              </button>
              <button class="rate-level-btn" data-id="${level.id}" data-creator="${level.creator}" style="padding: 8px 12px; background: #ffd700; color: #000; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                🛠️ Rate & Award CP
              </button>
              <button class="reject-level-btn" data-id="${level.id}" style="padding: 8px 12px; background: #f44336; color: #fff; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
                ❌ Reject
              </button>
            </div>
          `;
          
          contentDiv.appendChild(levelCard);
        });
        
        // Add event listeners for Jackson's buttons
        contentDiv.querySelectorAll('.rate-level-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const levelId = e.target.dataset.id;
            const creator = e.target.dataset.creator;
            await awardCreatorPoints(levelId, creator);
            e.target.textContent = '✓ Rated';
            e.target.disabled = true;
            e.target.style.background = '#666';
          });
        });
        
        contentDiv.querySelectorAll('.reject-level-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const levelId = e.target.dataset.id;
            await levelDatabase.updateLevel(levelId, {
              moderationStatus: 'rejected'
            });
            e.target.textContent = '✓ Rejected';
            e.target.disabled = true;
            e.target.style.background = '#666';
          });
        });
      } catch (error) {
        console.error('Error loading Jackson queue:', error);
      }
    }
    
    // NEW: Player Management Tab (Jackson only)
    async function loadPlayerManagement() {
      try {
        contentDiv.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #ffd700; margin-bottom: 10px;">👑 Player Management</h3>
            <p style="color: #aaa; margin-bottom: 15px;">
              Search for any player to view their profile, manage roles, or ban.
            </p>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <input type="text" id="playerSearchInput" placeholder="Enter username" style="flex: 1; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #222; color: #fff;">
              <button id="searchPlayerBtn" style="padding: 8px 16px; background: #4a8cff; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
                Search Player
              </button>
            </div>
          </div>
          <div id="playerManagementResult" style="min-height: 200px;"></div>
        `;
        
        const searchPlayerBtn = contentDiv.querySelector('#searchPlayerBtn');
        const playerSearchInput = contentDiv.querySelector('#playerSearchInput');
        const playerManagementResult = contentDiv.querySelector('#playerManagementResult');
        
        async function searchPlayer(username) {
          playerManagementResult.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">Searching for player...</div>';
          
          try {
            const account = await firebaseRequest(`accounts/${username}`);
            if (!account) {
              playerManagementResult.innerHTML = `
                <div style="background: rgba(255,51,102,0.1); padding: 20px; border-radius: 8px; text-align: center;">
                  <div style="color: #ff3366; font-size: 24px; margin-bottom: 10px;">❌</div>
                  <div style="color: #fff; font-weight: bold;">Player not found</div>
                  <div style="color: #aaa; margin-top: 5px;">Username "${username}" does not exist.</div>
                </div>
              `;
              return;
            }
            
            const modStatus = await firebaseRequest(`mods/moderator%20manager/${username}`);
            const elderStatus = await firebaseRequest(`ElderMods/ElderManager/${username}`);
            
            const playerInfo = {
              username: username,
              role: username === "Jackson" ? "owner" : elderStatus ? "elder" : modStatus ? "moderator" : "normal",
              isModerator: !!modStatus,
              isElder: !!elderStatus,
              isOwner: username === "Jackson",
              creatorPoints: account.creatorPoints || 0,
              banned: account.banned || false,
              joined: account.joined,
              likedLevels: account.likedLevels || []
            };
            
            const badge = playerInfo.isOwner ? '👑' : playerInfo.isElder ? 'Ⓜ️👑' : playerInfo.isModerator ? 'Ⓜ️' : '';
            const statusColor = playerInfo.banned ? '#f44336' : '#4CAF50';
            const statusText = playerInfo.banned ? 'BANNED' : 'ACTIVE';
            
            playerManagementResult.innerHTML = `
              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="color: #fff; font-size: 24px; font-weight: bold;">
                      ${username} ${badge}
                    </div>
                    <div style="color: #aaa; margin-top: 5px;">
                      <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span> • 
                      Role: ${playerInfo.role.toUpperCase()} • 
                      🛠️ ${playerInfo.creatorPoints} CP
                    </div>
                  </div>
                  <div style="color: #888; font-size: 12px;">
                    Joined: ${new Date(playerInfo.joined).toLocaleDateString()}
                  </div>
                </div>
                
                <div style="margin-top: 20px; color: #ccc;">
                  <div>📊 Liked Levels: ${playerInfo.likedLevels.length}</div>
                </div>
                
                <!-- Management Actions (Only for Jackson and not himself) -->
                ${username !== "Jackson" ? `
                  <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <h4 style="color: #ffd700; margin-bottom: 15px;">🎮 Player Management</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                      <!-- Role Management -->
                      <div style="grid-column: span 2;">
                        <h5 style="color: #4a8cff; margin-bottom: 8px;">Role Management</h5>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                          ${!playerInfo.isModerator && !playerInfo.isElder ? `
                            <button class="action-btn promote-mod" style="padding: 10px 15px; background: #4a8cff; color: #fff; border: none; border-radius: 6px; cursor: pointer; flex: 1;">
                              Promote to Moderator (Ⓜ️)
                            </button>
                          ` : ''}
                          ${playerInfo.isModerator && !playerInfo.isElder ? `
                            <button class="action-btn promote-elder" style="padding: 10px 15px; background: #ff9800; color: #fff; border: none; border-radius: 6px; cursor: pointer; flex: 1;">
                              Promote to Elder (Ⓜ️👑)
                            </button>
                          ` : ''}
                          ${(playerInfo.isModerator || playerInfo.isElder) ? `
                            <button class="action-btn demote" style="padding: 10px 15px; background: #666; color: #fff; border: none; border-radius: 6px; cursor: pointer; flex: 1;">
                              Demote to Normal
                            </button>
                          ` : ''}
                        </div>
                      </div>
                      
                      <!-- Ban/Unban -->
                      <div>
                        <h5 style="color: ${playerInfo.banned ? '#4CAF50' : '#f44336'}; margin-bottom: 8px;">
                          ${playerInfo.banned ? 'Unban User' : 'Ban User'}
                        </h5>
                        <button class="action-btn ${playerInfo.banned ? 'unban' : 'ban'}" style="padding: 10px 15px; background: ${playerInfo.banned ? '#4CAF50' : '#f44336'}; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                          ${playerInfo.banned ? '🔓 Unban User' : '🔒 Ban User'}
                        </button>
                      </div>
                      
                      <!-- Reset Stats -->
                      <div>
                        <h5 style="color: #ff9800; margin-bottom: 8px;">Reset Stats</h5>
                        <button class="action-btn reset-cp" style="padding: 10px 15px; background: #ff9800; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                          Reset Creator Points
                        </button>
                      </div>
                    </div>
                  </div>
                ` : `
                  <div style="margin-top: 25px; padding: 15px; background: rgba(255,215,0,0.1); border-radius: 8px; text-align: center; color: #ffd700;">
                    👑 You cannot manage your own account.
                  </div>
                `}
              </div>
            `;
            
            // Add event listeners for action buttons
            const promoteModBtn = playerManagementResult.querySelector('.promote-mod');
            const promoteElderBtn = playerManagementResult.querySelector('.promote-elder');
            const demoteBtn = playerManagementResult.querySelector('.demote');
            const banBtn = playerManagementResult.querySelector('.ban, .unban');
            const resetCpBtn = playerManagementResult.querySelector('.reset-cp');
            
            if (promoteModBtn) {
              promoteModBtn.addEventListener('click', async () => {
                if (confirm(`Promote "${username}" to Moderator (Ⓜ️)?\nThey will be able to flag levels for review.`)) {
                  await firebaseRequest(`mods/moderator%20manager/${username}`, 'PUT', true);
                  await firebaseRequest(`accounts/${username}`, 'PATCH', { role: 'moderator' });
                  alert(`✅ ${username} is now a Moderator!`);
                  searchPlayer(username);
                }
              });
            }
            
            if (promoteElderBtn) {
              promoteElderBtn.addEventListener('click', async () => {
                if (confirm(`Promote "${username}" to Elder Moderator (Ⓜ️👑)?\nThey will gain access to the Moderation Hub.`)) {
                  await firebaseRequest(`ElderMods/ElderManager/${username}`, 'PUT', true);
                  await firebaseRequest(`accounts/${username}`, 'PATCH', { role: 'elder' });
                  alert(`✅ ${username} is now an Elder Moderator!`);
                  searchPlayer(username);
                }
              });
            }
            
            if (demoteBtn) {
              demoteBtn.addEventListener('click', async () => {
                const currentRole = playerInfo.isElder ? 'Elder Moderator' : 'Moderator';
                if (confirm(`Demote "${username}" from ${currentRole} to normal user?`)) {
                  if (playerInfo.isElder) {
                    await firebaseRequest(`ElderMods/ElderManager/${username}`, 'DELETE');
                  }
                  await firebaseRequest(`mods/moderator%20manager/${username}`, 'DELETE');
                  await firebaseRequest(`accounts/${username}`, 'PATCH', { role: 'normal' });
                  alert(`✅ ${username} has been demoted to normal user.`);
                  searchPlayer(username);
                }
              });
            }
            
            if (banBtn) {
              banBtn.addEventListener('click', async () => {
                const action = playerInfo.banned ? 'unban' : 'ban';
                const confirmMsg = playerInfo.banned 
                  ? `Unban "${username}"? They will be able to log in again.`
                  : `Ban "${username}"? They will no longer be able to log in.\n\nThis action can be reversed later.`;
                
                if (confirm(confirmMsg)) {
                  await firebaseRequest(`accounts/${username}`, 'PATCH', {
                    banned: !playerInfo.banned
                  });
                  alert(`✅ ${username} has been ${playerInfo.banned ? 'unbanned' : 'banned'}!`);
                  searchPlayer(username);
                }
              });
            }
            
            if (resetCpBtn) {
              resetCpBtn.addEventListener('click', async () => {
                if (confirm(`Reset ${username}'s Creator Points to 0? This cannot be undone.`)) {
                  await firebaseRequest(`accounts/${username}`, 'PATCH', {
                    creatorPoints: 0
                  });
                  alert(`✅ ${username}'s Creator Points have been reset to 0.`);
                  searchPlayer(username);
                }
              });
            }
            
          } catch (error) {
            console.error('Error searching player:', error);
            playerManagementResult.innerHTML = `
              <div style="background: rgba(255,51,102,0.1); padding: 20px; border-radius: 8px; text-align: center;">
                <div style="color: #ff3366; font-size: 24px; margin-bottom: 10px;">⚠️</div>
                <div style="color: #fff; font-weight: bold;">Error</div>
                <div style="color: #aaa; margin-top: 5px;">Could not load player data. Please try again.</div>
              </div>
            `;
          }
        }
        
        searchPlayerBtn.addEventListener('click', () => {
          const username = playerSearchInput.value.trim();
          if (username) {
            searchPlayer(username);
          }
        });
        
        playerSearchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            const username = playerSearchInput.value.trim();
            if (username) {
              searchPlayer(username);
            }
          }
        });
        
      } catch (error) {
        console.error('Error loading player management:', error);
        contentDiv.innerHTML = '<div style="color: #ff3366; text-align: center;">Error loading player management.</div>';
      }
    }
    
    // Tab switching logic
    sentTabBtn.addEventListener('click', () => {
      sentTabBtn.style.background = '#4a8cff';
      jacksonTabBtn.style.background = '#666';
      playerManagementBtn.style.background = '#666';
      loadSentLevels();
    });
    
    if (currentUser.isOwner) {
      jacksonTabBtn.addEventListener('click', () => {
        sentTabBtn.style.background = '#666';
        jacksonTabBtn.style.background = '#ffd700';
        playerManagementBtn.style.background = '#666';
        loadJacksonQueue();
      });
      
      playerManagementBtn.addEventListener('click', () => {
        sentTabBtn.style.background = '#666';
        jacksonTabBtn.style.background = '#666';
        playerManagementBtn.style.background = '#4a8cff';
        loadPlayerManagement();
      });
    } else if (currentUser.isElder) {
      jacksonTabBtn.addEventListener('click', () => {
        sentTabBtn.style.background = '#666';
        jacksonTabBtn.style.background = '#ffd700';
        loadJacksonQueue();
      });
    }
    
    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Menu';
    backBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #666;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
    `;
    backBtn.addEventListener('click', () => {
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      initMainMenu();
    });
    
    hubContainer.appendChild(backBtn);
    menuPanel.appendChild(hubContainer);
    
    // Load initial content
    loadSentLevels();
  }


  /* ---------- Player Lookup & Management ---------- */
  async function openModerationTools() {
    menuPanel.innerHTML = '';
    menuPanel.style.display = 'flex';
    
    const modContainer = document.createElement('div');
    modContainer.style.cssText = `
      background: rgba(0,0,0,0.95);
      padding: 20px;
      border-radius: 15px;
      width: 500px;
      max-height: ${GAME.height - 100}px;
      overflow-y: auto;
      border: 3px solid ${currentUser?.isOwner ? '#ffd700' : 
                       currentUser?.isElder ? '#ff9800' : '#4a8cff'};
    `;
    
    const title = document.createElement('h2');
    title.innerHTML = `Moderation Tools ${userSystem.getBadge(currentUser?.username || '')}`;
    title.style.cssText = `color: ${currentUser?.isOwner ? '#ffd700' : 
                          currentUser?.isElder ? '#ff9800' : '#4a8cff'}; 
                          margin: 0 0 20px 0; text-align: center;`;
    
    // Player Lookup Section
    const lookupSection = document.createElement('div');
    lookupSection.style.cssText = 'margin-bottom: 20px;';
    lookupSection.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 10px;">🔍 Player Lookup</h3>
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        <input type="text" id="playerLookupInput" placeholder="Enter username" style="flex: 1; padding: 8px; border-radius: 6px; border: 2px solid #4a8cff; background: #222; color: #fff;">
        <button id="lookupBtn" style="padding: 8px 12px; background: #4a8cff; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
          Search
        </button>
      </div>
      <div id="playerResult" style="min-height: 100px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px;"></div>
    `;
    
    modContainer.appendChild(title);
    modContainer.appendChild(lookupSection);
    
    // Player lookup functionality
    const lookupBtn = modContainer.querySelector('#lookupBtn');
    const playerLookupInput = modContainer.querySelector('#playerLookupInput');
    const playerResult = modContainer.querySelector('#playerResult');
    
    async function lookupPlayer(username) {
      playerResult.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Searching...</div>';
      
      try {
        const account = await firebaseRequest(`accounts/${username}`);
        if (!account) {
          playerResult.innerHTML = '<div style="color: #ff3366; text-align: center;">Player not found.</div>';
          return;
        }
        
        const modStatus = await firebaseRequest(`mods/moderator%20manager/${username}`);
        const elderStatus = await firebaseRequest(`ElderMods/ElderManager/${username}`);
        
        const playerInfo = {
          username: username,
          role: username === "Jackson" ? "owner" : elderStatus ? "elder" : modStatus ? "moderator" : "normal",
          isModerator: !!modStatus,
          isElder: !!elderStatus,
          isOwner: username === "Jackson",
          creatorPoints: account.creatorPoints || 0,
          banned: account.banned || false,
          joined: account.joined,
          likedLevels: account.likedLevels || []
        };
        
        const badge = playerInfo.isOwner ? '👑' : playerInfo.isElder ? 'Ⓜ️👑' : playerInfo.isModerator ? 'Ⓜ️' : '';
        
        let actionButtons = '';
        
        // Only Jackson can perform all actions
        if (currentUser.isOwner) {
          actionButtons = `
            <div style="display: flex; gap: 10px; margin-top: 15px;">
              ${!playerInfo.isModerator && !playerInfo.isElder ? `
                <button class="promote-moderator-btn" style="padding: 8px 12px; background: #4a8cff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                  Promote to Moderator
                </button>
              ` : ''}
              ${playerInfo.isModerator && !playerInfo.isElder ? `
                <button class="promote-elder-btn" style="padding: 8px 12px; background: #ff9800; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                  Promote to Elder
                </button>
              ` : ''}
              ${(playerInfo.isModerator || playerInfo.isElder) ? `
                <button class="demote-btn" style="padding: 8px 12px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                  Demote to Normal
                </button>
              ` : ''}
              <button class="${playerInfo.banned ? 'unban-btn' : 'ban-btn'}" style="padding: 8px 12px; background: ${playerInfo.banned ? '#4CAF50' : '#f44336'}; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                ${playerInfo.banned ? 'Unban User' : 'Ban User'}
              </button>
            </div>
          `;
        }
        
        playerResult.innerHTML = `
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
            <div style="color: #fff; font-size: 18px; font-weight: bold;">
              ${username} ${badge}
            </div>
            <div style="color: #aaa; margin-top: 5px;">
              Role: ${playerInfo.role}<br>
              Status: ${playerInfo.banned ? '<span style="color: #f44336;">BANNED</span>' : '<span style="color: #4CAF50;">Active</span>'}<br>
              Creator Points: 🛠️ ${playerInfo.creatorPoints}<br>
              Joined: ${new Date(playerInfo.joined).toLocaleDateString()}<br>
              Liked Levels: ${playerInfo.likedLevels ? playerInfo.likedLevels.length : 0}
            </div>
            ${actionButtons}
          </div>
        `;
        
        // Add event listeners for action buttons
        if (currentUser.isOwner) {
          // Ban/Unban
          const banBtn = playerResult.querySelector('.ban-btn, .unban-btn');
          if (banBtn) {
            banBtn.addEventListener('click', async () => {
              const action = playerInfo.banned ? 'unban' : 'ban';
              const confirmMsg = playerInfo.banned 
                ? `Unban ${username}? They will be able to log in again.`
                : `Ban ${username}? They will no longer be able to log in.`;
              
              if (confirm(confirmMsg)) {
                await firebaseRequest(`accounts/${username}`, 'PATCH', {
                  banned: !playerInfo.banned
                });
                alert(`${username} has been ${playerInfo.banned ? 'unbanned' : 'banned'}.`);
                lookupPlayer(username); // Refresh
              }
            });
          }
          
          // Promote to Moderator
          const promoteModBtn = playerResult.querySelector('.promote-moderator-btn');
          if (promoteModBtn) {
            promoteModBtn.addEventListener('click', async () => {
              if (confirm(`Promote ${username} to Moderator (Ⓜ️)?`)) {
                await firebaseRequest(`mods/moderator%20manager/${username}`, 'PUT', true);
                await firebaseRequest(`accounts/${username}`, 'PATCH', {
                  role: 'moderator'
                });
                alert(`${username} is now a Moderator!`);
                lookupPlayer(username);
              }
            });
          }
          
          // Promote to Elder
          const promoteElderBtn = playerResult.querySelector('.promote-elder-btn');
          if (promoteElderBtn) {
            promoteElderBtn.addEventListener('click', async () => {
              if (confirm(`Promote ${username} to Elder Moderator (Ⓜ️👑)?`)) {
                await firebaseRequest(`ElderMods/ElderManager/${username}`, 'PUT', true);
                await firebaseRequest(`accounts/${username}`, 'PATCH', {
                  role: 'elder'
                });
                alert(`${username} is now an Elder Moderator!`);
                lookupPlayer(username);
              }
            });
          }
          
          // Demote
          const demoteBtn = playerResult.querySelector('.demote-btn');
          if (demoteBtn) {
            demoteBtn.addEventListener('click', async () => {
              const currentRole = playerInfo.isElder ? 'Elder Moderator' : 'Moderator';
              if (confirm(`Demote ${username} from ${currentRole} to normal user?`)) {
                if (playerInfo.isElder) {
                  await firebaseRequest(`ElderMods/ElderManager/${username}`, 'DELETE');
                }
                await firebaseRequest(`mods/moderator%20manager/${username}`, 'DELETE');
                await firebaseRequest(`accounts/${username}`, 'PATCH', {
                  role: 'normal'
                });
                alert(`${username} has been demoted to normal user.`);
                lookupPlayer(username);
              }
            });
          }
        }
      } catch (error) {
        playerResult.innerHTML = '<div style="color: #ff3366; text-align: center;">Error looking up player.</div>';
      }
    }
    
    lookupBtn.addEventListener('click', () => {
      const username = playerLookupInput.value.trim();
      if (username) {
        lookupPlayer(username);
      }
    });
    
    playerLookupInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const username = playerLookupInput.value.trim();
        if (username) {
          lookupPlayer(username);
        }
      }
    });
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Menu';
    backBtn.style.cssText = `
      padding: 12px;
      border-radius: 8px;
      border: none;
      background: #666;
      color: #fff;
      width: 100%;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
    `;
    
    modContainer.appendChild(backBtn);
    
    backBtn.addEventListener('click', () => {
      menuPanel.innerHTML = '';
      menuPanel.style.display = 'flex';
      initMainMenu();
    });
    
    menuPanel.appendChild(modContainer);
  }


  /* ---------- Game Loop & Drawing ---------- */
  function gameLoop(ts) {
    animationHandle = requestAnimationFrame(gameLoop);
    const now = ts || performance.now(); 
    let dt = (now - lastTime) / 1000 || 0; 
    lastTime = now; 
    dt = Math.min(0.04, dt);


    if (inGame && running && levelPlayState) {
      const mode = GAME.mode;
      GAME.speed = GAME.baseSpeed * GAME.speedMultiplier;
      levelPlayState.offsetX += GAME.speed * dt;


      player.prevY = player.y;


      if (mode === 'cube') {
        // Apply gravity based on gravity mode
        if (GAME.gravityMode === 'reverse') {
          player.vy -= GAME.gravity * dt;
        } else {
          player.vy += GAME.gravity * dt;
        }
        player.y += player.vy * dt;
        
        player.onGround = false;
        
        // Ground collision based on gravity mode
        if (GAME.gravityMode === 'reverse') {
          if (player.y <= 0) {
            player.y = 0;
            player.vy = 0;
            player.onGround = true;
            player.cubeRotationSpeed = 0;
            player.rotation = 180;
          }
        } else {
          if (player.y + player.h >= GAME.groundY) {
            player.y = GAME.groundY - player.h;
            player.vy = 0;
            player.onGround = true;
            player.cubeRotationSpeed = 0;
            player.rotation = 0;
          }
        }
        
        // Cube rotation in air
        if (!player.onGround) {
          if (GAME.gravityMode === 'reverse') {
            player.cubeRotationSpeed = (player.vy < 0 ? -400 : 400);
          } else {
            player.cubeRotationSpeed = (player.vy < 0 ? -400 : 400);
          }
          player.rotation += player.cubeRotationSpeed * dt;
        }
      } else if (mode === 'wave') { 
        const actualHitboxW = waveMode.hitboxWidth;
        const actualHitboxH = waveMode.hitboxHeight;
        
        // Wave mode unaffected by gravity portals
        player.vy = input.hold ? -320 : 380;
        player.y += player.vy * dt;
        if (player.y < 12) player.y = 12;
        if (player.y + actualHitboxH > GAME.groundY) player.y = GAME.groundY - actualHitboxH;
        
        player.tilt = player.vy * 0.01;
        player.rotation += player.tilt * dt;
        
        // Trail effect
        player.trail.push({
          x: player.x + actualHitboxW/2,
          y: player.y + actualHitboxH/2,
          alpha: 1.0,
          size: 6,
          rotation: player.rotation
        });
        
        if (player.trail.length > 15) player.trail.shift();
        player.trail.forEach(p => {
          p.alpha -= 0.07;
          p.size -= 0.2;
        });
        player.trail = player.trail.filter(p => p.alpha > 0.1 && p.size > 2);
      }
      
      // Create hitbox based on mode
      let pbox;
      if (GAME.mode === 'wave') {
        pbox = { 
          x: player.x + (waveMode.iconWidth - waveMode.hitboxWidth) / 2,
          y: player.y + (waveMode.iconHeight - waveMode.hitboxHeight) / 2,
          w: waveMode.hitboxWidth, 
          h: waveMode.hitboxHeight 
        };
      } else {
        pbox = { x: player.x, y: player.y, w: player.w, h: player.h };
      }
      
      let hit = false;
      let collectedOrb = false;
      
      for (const ob of levelPlayState.level.obstacles) {
        const screenX = Math.round(ob.x - levelPlayState.offsetX);
        
        if (ob.type === 'spike') {
          // Use smaller spike hitbox
          const spikeHitbox = getSpikeHitbox({
            x: screenX,
            y: ob.y,
            w: ob.w,
            h: ob.h
          });
          
          if (rectsOverlap(pbox, spikeHitbox)) {
            hit = true;
            break;
          }
        } else {
          const obBox = { x: screenX, y: ob.y, w: ob.w, h: ob.h };
          
          if (rectsOverlap(pbox, obBox)) {
            if (ob.type === 'block' || ob.type === 'platform') {
              if (mode === 'cube') {
                const playerBottom = player.prevY + player.h;
                const playerTop = player.prevY;
                const blockTop = ob.y;
                const blockBottom = ob.y + ob.h;
                const tolerance = 10;
                
                if (playerBottom <= blockTop + tolerance && player.vy > 0) {
                  player.y = ob.y - player.h;
                  player.vy = 0;
                  player.onGround = true;
                  player.cubeRotationSpeed = 0;
                  player.rotation = 0;
                } 
                else if (playerTop >= blockBottom - tolerance && player.vy < 0) {
                  player.y = ob.y + ob.h;
                  player.vy = 0;
                }
                else {
                  hit = true;
                  break;
                }
              } else {
                hit = true;
                break;
              }
            } else if (ob.type === 'cubePortal') {
              GAME.mode = 'cube';
              updatePlayerAppearance();
              player.trail = [];
              player.vy = 0;
            } else if (ob.type === 'wavePortal') {
              GAME.mode = 'wave';
              updatePlayerAppearance();
              player.vy = 0;
            } else if (ob.type === 'normalSpeedPortal') {
              GAME.speedMultiplier = 1.0;
            } else if (ob.type === 'gravityPortal') {
              if (GAME.flipCooldown <= 0) {
                GAME.flipCooldown = 0.5;
                
                if (ob.gravityType === 'flip') {
                  GAME.gravity = -GAME.gravity;
                  GAME.jumpV = -GAME.jumpV;
                  player.gravityFlipped = !player.gravityFlipped;
                  
                  if (GAME.gravity > 0) {
                    GAME.gravityMode = 'normal';
                  } else {
                    GAME.gravityMode = 'reverse';
                  }
                  
                  // Create gravity orbs effect
                  createGravityEffect(ob.x, ob.y + ob.h/2);
                } else if (ob.gravityType === 'normal') {
                  GAME.gravity = 1400;
                  GAME.jumpV = -480;
                  player.gravityFlipped = false;
                  GAME.gravityMode = 'normal';
                } else if (ob.gravityType === 'reverse') {
                  GAME.gravity = -1400;
                  GAME.jumpV = 480;
                  player.gravityFlipped = true;
                  GAME.gravityMode = 'reverse';
                }
              }
            } else if (ob.type === 'speedPortal') {
              const speedMode = SPEED_MODES.find(m => m.name === ob.speedMode) || SPEED_MODES[1];
              GAME.speedMultiplier = speedMode.multiplier;
              
              // Create speed effect
              createSpeedEffect(ob.x, ob.y + ob.h/2, speedMode.color);
            } else if (ob.type === 'yellowOrb') {
              // Collect yellow orb
              if (yellowOrb.effect(player)) {
                collectedOrb = true;
                // Remove the orb from the level
                const index = levelPlayState.level.obstacles.indexOf(ob);
                if (index > -1) {
                  levelPlayState.level.obstacles.splice(index, 1);
                }
              }
            } else if (ob.type === 'textLabel') {
              // Just a visual element, no collision
            }
          }
        }
      }
      
      // Update cooldown
      if (GAME.flipCooldown > 0) {
        GAME.flipCooldown -= dt;
      }
      
      // Update gravity orbs
      player.gravityOrbs.forEach((orb, index) => {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.vy += (orb.gravity || GAME.gravity) * dt;
        orb.life -= dt;
      });
      
      // Remove dead orbs
      player.gravityOrbs = player.gravityOrbs.filter(orb => orb.life > 0);
      
      if (hit) { 
        running = false; 
        GAME.best = Math.max(GAME.best, Math.floor(GAME.score)); 
      } else { 
        GAME.score += dt * (GAME.speed / 120); 
      }


      if (levelPlayState.offsetX > (levelPlayState.level.length + 120)) {
        running = false;
        levelPlayState.finished = true;
        GAME.best = Math.max(GAME.best, Math.floor(GAME.score));
      }
    }


    drawFrame();
    hud.innerText = `Score: ${Math.floor(GAME.score)}  Best: ${Math.floor(GAME.best)}  Speed: ${GAME.speedMultiplier.toFixed(1)}x  Mode: ${GAME.mode}  Gravity: ${GAME.gravityMode.toUpperCase()}`;
  }


  function updatePlayerAppearance() {
    if (GAME.mode === 'wave') {
      player.color = '#4a8cff';
    } else {
      player.color = '#ffd200';
    }
  }


  /* ---------- Visual Effects ---------- */
  function createGravityEffect(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const size = 3 + Math.random() * 5;
      
      player.gravityOrbs.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        gravity: GAME.gravity,
        life: 1.0,
        color: '#ff00ff'
      });
    }
  }

  function createSpeedEffect(x, y, color) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 300;
      const size = 2 + Math.random() * 4;
      
      player.gravityOrbs.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        gravity: GAME.gravity,
        life: 1.0,
        color: color
      });
    }
  }


  /* ---------- Utilities ---------- */
  function clearCanvas() { 
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; 
    ctx.fillRect(0, 0, GAME.width, GAME.height); 
  }
  
  function rectsOverlap(a, b) { 
    return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h); 
  }
  
  function roundRect(ctx, x, y, w, h, r) { 
    ctx.beginPath(); 
    ctx.moveTo(x + r, y); 
    ctx.arcTo(x + w, y, x + w, y + h, r); 
    ctx.arcTo(x + w, y + h, x, y + h, r); 
    ctx.arcTo(x, y + h, x, y, r); 
    ctx.arcTo(x, y, x + w, y, r); 
    ctx.closePath(); 
    ctx.fill(); 
  }
  
  function clone(obj) { 
    return JSON.parse(JSON.stringify(obj)); 
  }


  function drawObstacle(ob, sx) {
    const time = Date.now() / 1000;
    ctx.save();
    
    if (ob.type.includes('Portal')) {
      ctx.translate(sx + ob.w/2, ob.y + ob.h/2);
      
      let portalColor, portalText, textColor;
      if (ob.type === 'cubePortal') {
        portalColor = '#ffd200';
        portalText = 'C';
        textColor = '#000';
      } else if (ob.type === 'wavePortal') {
        portalColor = '#4a8cff';
        portalText = 'W';
        textColor = '#fff';
      } else if (ob.type === 'normalSpeedPortal') {
        portalColor = '#00ff00';
        portalText = 'S';
        textColor = '#000';
      } else if (ob.type === 'gravityPortal') {
        portalColor = '#ff00ff';
        portalText = 'G';
        textColor = '#fff';
        
        // Add arrow indicator
        const arrowSize = 8;
        ctx.fillStyle = '#fff';
        if (ob.gravityType === 'flip') {
          // Double arrow
          ctx.beginPath();
          ctx.moveTo(-arrowSize, -arrowSize);
          ctx.lineTo(arrowSize, 0);
          ctx.lineTo(-arrowSize, arrowSize);
          ctx.closePath();
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(arrowSize, -arrowSize);
          ctx.lineTo(-arrowSize, 0);
          ctx.lineTo(arrowSize, arrowSize);
          ctx.closePath();
          ctx.fill();
        } else if (ob.gravityType === 'normal') {
          // Down arrow (normal gravity)
          ctx.beginPath();
          ctx.moveTo(-arrowSize, -arrowSize);
          ctx.lineTo(0, 0);
          ctx.lineTo(arrowSize, -arrowSize);
          ctx.closePath();
          ctx.fill();
        } else if (ob.gravityType === 'reverse') {
          // Up arrow (reverse gravity)
          ctx.beginPath();
          ctx.moveTo(-arrowSize, arrowSize);
          ctx.lineTo(0, 0);
          ctx.lineTo(arrowSize, arrowSize);
          ctx.closePath();
          ctx.fill();
        }
      } else if (ob.type === 'speedPortal') {
        const speedMode = SPEED_MODES.find(m => m.name === ob.speedMode) || SPEED_MODES[1];
        portalColor = speedMode.color;
        portalText = speedMode.name.charAt(0).toUpperCase();
        textColor = '#000';
      }
      
      ctx.fillStyle = portalColor;
      ctx.beginPath();
      ctx.arc(0, 0, ob.w/2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = portalColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, ob.w/2 - 1, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = textColor;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(portalText, 0, 0);
      
    } else if (ob.type === 'textLabel') {
      ctx.fillStyle = ob.color || '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // Draw background for text
      const textWidth = ctx.measureText(ob.text || 'Text').width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx - 2, ob.y - 2, textWidth + 4, 24);
      
      // Draw text
      ctx.fillStyle = ob.color || '#ffffff';
      ctx.fillText(ob.text || 'Text', sx, ob.y);
      
    } else if (ob.type === 'yellowOrb') {
      ctx.save();
      ctx.translate(sx + ob.w/2, ob.y + ob.h/2);
      
      // Pulsating effect
      const pulse = Math.sin(time * 5) * 0.1 + 0.9;
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ob.w/2);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
      gradient.addColorStop(0.7, 'rgba(255, 200, 0, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 180, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, ob.w/2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner core
      ctx.fillStyle = '#ffd200';
      ctx.beginPath();
      ctx.arc(0, 0, ob.w/3, 0, Math.PI * 2);
      ctx.fill();
      
      // Shine effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(-ob.w/6, -ob.w/6, ob.w/8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
      
    } else {
      if (ob.type === 'spike') {
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.moveTo(sx, ob.y + ob.h);
        ctx.lineTo(sx + ob.w, ob.y + ob.h);
        ctx.lineTo(sx + ob.w/2, ob.y);
        ctx.closePath();
        ctx.fill();
      } else if (ob.type === 'block') {
        ctx.fillStyle = '#4a8cff';
        roundRect(ctx, sx, ob.y, ob.w, ob.h, 4);
      } else {
        ctx.fillStyle = '#1fd';
        roundRect(ctx, sx, ob.y, ob.w, ob.h, 4);
      }
    }
    
    ctx.restore();
  }


  function drawFrame() {
    clearCanvas();
    
    const time = Date.now() / 1000;
    const g = ctx.createLinearGradient(0, 0, GAME.width, GAME.height);
    
    if (inEditor) {
      g.addColorStop(0, 'rgba(100, 100,255, 0.2)');
      g.addColorStop(1, 'rgba(150, 100,255, 0.2)');
    } else if (inGame) {
      if (GAME.mode === 'wave') {
        g.addColorStop(0, 'rgba(100, 150,255, 0.3)');
        g.addColorStop(1, 'rgba(50, 100,255, 0.3)');
      } else {
        g.addColorStop(0, 'rgba(255, 200, 50, 0.3)');
        g.addColorStop(1, 'rgba(255, 150, 50, 0.3)');
      }
    } else {
      g.addColorStop(0, 'rgba(255, 200, 50, 0.3)');
      g.addColorStop(1, 'rgba(255, 150, 50, 0.3)');
    }
    
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    
    // Ground
    ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
    ctx.fillRect(0, GAME.groundY, GAME.width, GAME.height - GAME.groundY);
    ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
    ctx.fillRect(0, GAME.groundY, GAME.width, 4);

    // Draw editor obstacles when in editor mode
    if (inEditor && editorState.level && editorState.level.obstacles) {
      // Draw grid if enabled
      if (editorState.snapToGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = -(editorState.viewOffset % editorState.gridSize); x < GAME.width; x += editorState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, GAME.height);
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < GAME.height; y += editorState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(GAME.width, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw obstacles
      editorState.level.obstacles.forEach(ob => {
        const sx = Math.round(ob.x - editorState.viewOffset);
        if (sx < -200 || sx > GAME.width + 200) return;
        drawObstacle(ob, sx);
        
        if (editorState.selectedObject === ob) {
          ctx.strokeStyle = '#ffd200';
          ctx.lineWidth = 3;
          ctx.strokeRect(sx - 3, ob.y - 3, ob.w + 6, ob.h + 6);
        }
      });
    }

    if (inGame && levelPlayState) {
      for (const ob of levelPlayState.level.obstacles) {
        const screenX = Math.round(ob.x - levelPlayState.offsetX);
        if (screenX + ob.w < 0 || screenX > GAME.width) continue;
        
        drawObstacle(ob, screenX);
      }
      
      // Draw wave trail
      if (GAME.mode === 'wave' && player.trail.length > 0) {
        for (let i = 0; i < player.trail.length; i++) {
          const point = player.trail[i];
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(point.rotation);
          
          ctx.fillStyle = `rgba(74, 140, 255, ${point.alpha})`;
          ctx.beginPath();
          ctx.moveTo(0, -point.size);
          ctx.lineTo(point.size, 0);
          ctx.lineTo(0, point.size);
          ctx.lineTo(-point.size, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      
      // Draw gravity orbs
      if (player.gravityOrbs.length > 0) {
        player.gravityOrbs.forEach((orb) => {
          ctx.save();
          ctx.globalAlpha = orb.life;
          ctx.fillStyle = orb.color;
          ctx.beginPath();
          ctx.arc(orb.x - levelPlayState.offsetX, orb.y, orb.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
    }


    // Draw player
    ctx.save();
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(player.x + 4, player.y + player.h + 4, player.w, 6);
    
    // Player drawing based on mode
    if (GAME.mode === 'wave') {
      ctx.save();
      ctx.translate(player.x + waveMode.iconWidth/2, player.y + waveMode.iconHeight/2);
      ctx.rotate(player.rotation);
      
      const waveGradient = ctx.createLinearGradient(-waveMode.iconWidth/2, -waveMode.iconHeight/2, 
                                                   waveMode.iconWidth/2, waveMode.iconHeight/2);
      waveGradient.addColorStop(0, '#4a8cff');
      waveGradient.addColorStop(1, '#3366cc');
      
      ctx.fillStyle = waveGradient;
      ctx.beginPath();
      ctx.moveTo(0, -waveMode.iconHeight/2);
      ctx.lineTo(waveMode.iconWidth/2, 0);
      ctx.lineTo(0, waveMode.iconHeight/2);
      ctx.lineTo(-waveMode.iconWidth/2, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', 0, 0);
      ctx.restore();
    } else {
      // Cube mode with rotation
      ctx.save();
      ctx.translate(player.x + player.w/2, player.y + player.h/2);
      ctx.rotate(player.rotation * Math.PI / 180);
      
      const cubeGradient = ctx.createLinearGradient(
        -player.w/2, -player.h/2, 
        -player.w/2, player.h/2
      );
      cubeGradient.addColorStop(0, '#ffd200');
      cubeGradient.addColorStop(1, '#ff9900');
      ctx.fillStyle = cubeGradient;
      roundRect(ctx, -player.w/2, -player.h/2, player.w, player.h, 8);
      
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);
      ctx.restore();
    }
    
    ctx.restore();


    if (inGame && !running) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, GAME.width, GAME.height);
      
      const isFinished = levelPlayState && levelPlayState.finished;
      ctx.fillStyle = isFinished ? '#4CAF50' : '#f44336';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isFinished ? 'LEVEL COMPLETED!' : 'YOU DIED', 
                   GAME.width / 2, GAME.height / 2 - 30);
      
      ctx.fillStyle = '#fff';
      ctx.font = '18px Arial, sans-serif';
      ctx.fillText(`Score: ${Math.floor(GAME.score)}`, GAME.width / 2, GAME.height / 2 + 10);
      ctx.fillText(`Best: ${Math.floor(GAME.best)}`, GAME.width / 2, GAME.height / 2 + 40);
      
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText('Click / Space to restart • Esc to menu', 
                   GAME.width / 2, GAME.height / 2 + 80);
      ctx.textAlign = 'left';
    }
  }


  /* ---------- Start Level ---------- */
  function startLevel(level) {
    if (!level) {
      alert('Error: Could not load level. Please try another one.');
      return;
    }
    
    // Clean up editor if it's open
    if (inEditor && editorSidebar && editorSidebar._cleanup) {
      editorSidebar._cleanup();
    }
    
    const clonedLevel = clone(level);
    
    // Set defaults for missing properties
    if (!clonedLevel.obstacles || !Array.isArray(clonedLevel.obstacles)) {
      clonedLevel.obstacles = [];
    }
    
    if (!clonedLevel.mode) {
      clonedLevel.mode = 'cube';
    }
    
    if (!clonedLevel.length) {
      clonedLevel.length = 5000;
    }
    
    // Setup game state
    menuPanel.style.display = 'none';
    inMenu = false; inEditor = false; inGame = true; inLevelBrowser = false;
    
    // Stop menu music
    if (menuMusic && !menuMusic.paused) {
      menuMusic.pause();
      menuMusic.currentTime = 0;
    }
    
    // Play appropriate music
    if (clonedLevel === prebuiltMainLevel || clonedLevel.name === prebuiltMainLevel.name) {
      initMainLevelMusic();
    } else {
      if (!levelMusic) {
        levelMusic = new Audio("https://www.myinstants.com/media/sounds/geometry-dash-level.mp3");
        levelMusic.loop = true;
        levelMusic.volume = 0.3;
        levelMusic.preload = "auto";
      } else {
        levelMusic.currentTime = 0;
      }
      levelMusic.play().catch(() => {});
    }
    
    levelPlayState = { 
      level: clonedLevel, 
      offsetX: 0, 
      finished: false,
      currentMode: clonedLevel.mode || 'cube'
    };
    
    // Reset game stats
    GAME.score = 0; 
    GAME.speed = GAME.baseSpeed; 
    GAME.speedMultiplier = 1;
    GAME.mode = clonedLevel.mode || 'cube';
    GAME.gravityMode = 'normal';
    GAME.gravity = 1400;
    GAME.jumpV = -480;
    GAME.flipCooldown = 0;
    
    // Reset player - Start at safe position
    player.x = 100;
    player.y = GAME.groundY - player.h; 
    player.vy = 0; 
    player.onGround = true; 
    player.prevY = GAME.groundY - player.h;
    player.trail = [];
    player.rotation = 0;
    player.tilt = 0;
    player.cubeRotationSpeed = 0;
    player.gravityFlipped = false;
    player.gravityOrbs = [];
    
    updatePlayerAppearance();
    
    running = true;
    
    lastTime = performance.now();
    if (animationHandle) cancelAnimationFrame(animationHandle);
    animationHandle = requestAnimationFrame(gameLoop);
  }


  function resetAfterDeath() {
    if (!levelPlayState) return;
    
    GAME.score = 0; 
    GAME.speed = GAME.baseSpeed; 
    GAME.speedMultiplier = 1;
    GAME.mode = levelPlayState.level.mode || 'cube';
    GAME.gravityMode = 'normal';
    GAME.gravity = 1400;
    GAME.jumpV = -480;
    GAME.flipCooldown = 0;
    
    // Reset to safe starting position
    player.x = 100;
    player.y = GAME.groundY - player.h; 
    player.vy = 0; 
    player.onGround = true;
    player.prevY = GAME.groundY - player.h;
    player.trail = [];
    player.rotation = 0;
    player.tilt = 0;
    player.cubeRotationSpeed = 0;
    player.gravityFlipped = false;
    player.gravityOrbs = [];
    
    updatePlayerAppearance();
    
    running = true; 
    levelPlayState.offsetX = 0; 
    levelPlayState.finished = false;
    
    if (levelPlayState.level === prebuiltMainLevel || levelPlayState.level.name === prebuiltMainLevel.name) {
      initMainLevelMusic();
    } else if (levelMusic) {
      levelMusic.currentTime = 0;
      levelMusic.play().catch(() => {});
    }
  }


  function enterMenuFromGame() {
    running = false; 
    inGame = false; 
    inEditor = false; 
    
    stopAllAudio();
    initMenuMusic();
    
    if (menuPanel._editorCleanup) {
      menuPanel._editorCleanup();
    }
    
    levelPlayState = null;
    menuPanel.innerHTML = ''; 
    menuPanel.style.display = 'flex';
    initMainMenu();
  }


  /* ---------- Input ---------- */
  function onGlobalKeyDown(e) {
    if (e.repeat) return;
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      input.hold = true;
      if (inGame && levelPlayState) {
        if (GAME.mode === 'cube') {
          if (player.onGround && running) {
            player.vy = GAME.jumpV; 
            player.onGround = false;
          } else if (!running) {
            resetAfterDeath();
          }
        } else {
          if (!running) resetAfterDeath();
        }
      }
    } else if (e.code === 'Escape') {
      if (inGame) { 
        enterMenuFromGame(); 
      }
      else if (inEditor) { 
        if (editorSidebar && editorSidebar._cleanup) {
          editorSidebar._cleanup();
        }
        menuPanel.innerHTML = ''; 
        menuPanel.style.display = 'flex'; 
        initMainMenu(); 
        inEditor = false; 
      }
      else if (inLevelBrowser) {
        menuPanel.innerHTML = '';
        menuPanel.style.display = 'flex';
        initMainMenu();
        inLevelBrowser = false;
      }
      else if (inMenu) { cleanupAndClose(); }
    } else if (e.code === 'KeyM' && inGame) {
      if (levelMusic) {
        if (levelMusic.paused) {
          levelMusic.play();
        } else {
          levelMusic.pause();
        }
      }
    }
  }
  
  function onGlobalKeyUp(e) { 
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.hold = false; 
  }
  
  window.addEventListener('keydown', onGlobalKeyDown);
  window.addEventListener('keyup', onGlobalKeyUp);


  function onCanvasPointerDown(e) {
    input.hold = true;
    if (inGame && levelPlayState) {
      if (GAME.mode === 'cube') {
        if (player.onGround && running) { 
          player.vy = GAME.jumpV; 
          player.onGround = false; 
        }
        else if (!running) resetAfterDeath();
      } else {
        if (!running) resetAfterDeath();
      }
    }
  }
  
  function onCanvasPointerUp() { input.hold = false; }
  
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  closeBtn.addEventListener('click', cleanupAndClose);


  /* ---------- Cleanup ---------- */
  function cleanupAndClose() {
    try { 
      if (animationHandle) cancelAnimationFrame(animationHandle); 
    } catch (e) { }
    
    stopAllAudio();
    
    if (menuPanel._editorCleanup) {
      menuPanel._editorCleanup();
      menuPanel._editorCleanup = null;
    }
    
    if (editorSidebar && editorSidebar._cleanup) {
      editorSidebar._cleanup();
    }
    
    window.removeEventListener('keydown', onGlobalKeyDown);
    window.removeEventListener('keyup', onGlobalKeyUp);
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('pointerup', onCanvasPointerUp);
    closeBtn.removeEventListener('click', cleanupAndClose);
    
    if (container.parentElement) container.parentElement.removeChild(container);
    window.__GD_CLONE_RUNNING = false;
  }


  // Start with login screen
  showLoginScreen();
  lastTime = performance.now();
  animationHandle = requestAnimationFrame(gameLoop);


})();
