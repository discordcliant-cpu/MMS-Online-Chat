
﻿
// === PASTE THIS ENTIRE CODE INTO BROWSER CONSOLE made by jackson ===
(function() {
  const DATABASE_URL = "https://online-chat-mmc-default-rtdb.firebaseio.com";
  
  // Create chat frame
  const frame = document.createElement('div');
  frame.id = 'chatFrame';
  frame.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 450px; height: 600px;
    background: #1a1a2e; border: 3px solid #4cc9f0; border-radius: 10px;
    box-shadow: 0 5px 25px rgba(0,0,0,0.5); z-index: 999999;
    display: flex; flex-direction: column; font-family: Arial, sans-serif;
    overflow: hidden; resize: both;
  `;
  
  const header = document.createElement('div');
  header.innerHTML = '<b>🔥 Live Chat</b> <span id="minBtn" style="float:right;cursor:pointer;margin-left:10px;">🗕</span>';
  header.style.cssText = `
    background: linear-gradient(90deg, #4cc9f0 0%, #4361ee 100%);
    color: white; padding: 10px; cursor: move; user-select: none;
  `;
  
  const content = document.createElement('div');
  content.id = 'chatContent';
  content.style.cssText = 'flex:1;overflow-y:auto;background:#0d1b2a;padding:10px;';
  
  frame.appendChild(header);
  frame.appendChild(content);
  document.body.appendChild(frame);
  
  // Make draggable
  let isDragging = false;
  let dragOffset = {x: 0, y: 0};
  
  header.onmousedown = function(e) {
    if (e.target.id === 'minBtn') return;
    isDragging = true;
    dragOffset.x = e.clientX - frame.offsetLeft;
    dragOffset.y = e.clientY - frame.offsetTop;
    
    document.onmousemove = function(e) {
      if (!isDragging) return;
      frame.style.left = (e.clientX - dragOffset.x) + 'px';
      frame.style.top = (e.clientY - dragOffset.y) + 'px';
      frame.style.right = 'auto';
    };
    
    document.onmouseup = function() {
      isDragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
  
  // Minimize button
  document.getElementById('minBtn').onclick = function() {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      frame.style.height = '600px';
    } else {
      content.style.display = 'none';
      frame.style.height = 'auto';
    }
  };
  
  const messageTracker = {};
  
  // Spam Detection System
  async function checkSpamStatus(username) {
    try {
      // Check if user is blocked
      const blockRes = await fetch(`${DATABASE_URL}/spamBlocked/${username}.json`);
      const blockUntil = await blockRes.json();
      
      if (blockUntil && blockUntil > Date.now()) {
        const remainingTime = Math.ceil((blockUntil - Date.now()) / 1000);
        return {
          blocked: true,
          message: `⛔ Spam detected! Blocked for ${remainingTime} seconds`,
          timeRemaining: remainingTime
        };
      }
      
      return { blocked: false };
    } catch (error) {
      return { blocked: false };
    }
  }

  async function updateSpamCount(username) {
    try {
      // Get current spam count
      const countRes = await fetch(`${DATABASE_URL}/spamCount/${username}.json`);
      let count = await countRes.json() || 0;
      
      // Increment count
      count++;
      
      // Update count in database
      await fetch(`${DATABASE_URL}/spamCount/${username}.json`, {
        method: 'PUT',
        body: JSON.stringify(count)
      });
      
      // Check if spam threshold exceeded (20 messages)
      if (count > 20) {
        // Detect spam pattern: if count keeps growing, it's spam
        const blockDuration = Math.min(count * 2000, 120000); // 2s per message over 20, max 2 minutes
        const blockUntil = Date.now() + blockDuration;
        
        // Block user
        await fetch(`${DATABASE_URL}/spamBlocked/${username}.json`, {
          method: 'PUT',
          body: JSON.stringify(blockUntil)
        });
        
        return {
          isSpam: true,
          blockDuration: Math.ceil(blockDuration / 1000)
        };
      }
      
      // Decay spam count over time (reset after 30 seconds of no messages)
      setTimeout(async () => {
        const currentCountRes = await fetch(`${DATABASE_URL}/spamCount/${username}.json`);
        const currentCount = await currentCountRes.json() || 0;
        
        if (currentCount > 0) {
          await fetch(`${DATABASE_URL}/spamCount/${username}.json`, {
            method: 'PUT',
            body: JSON.stringify(Math.max(0, currentCount - 5))
          });
        }
      }, 30000);
      
      return { isSpam: false, count };
      
    } catch (error) {
      return { isSpam: false };
    }
  }
  
  // Show login screen
  function showLogin() {
    content.innerHTML = `
      <div style="color:white;text-align:center;padding:20px;">
        <h3 style="margin-top:0;">💬 Live Chat Login</h3>
        <div style="background:rgba(255,255,255,0.1);padding:20px;border-radius:8px;">
          <input type="text" id="usernameInput" placeholder="Enter username" 
                 style="width:100%;padding:10px;margin-bottom:10px;background:#333;color:white;border:1px solid #4cc9f0;border-radius:5px;">
          
          <div id="passwordSection" style="display:none;">
            <input type="password" id="passwordInput" placeholder="Enter your password" 
                   style="width:100%;padding:10px;margin-bottom:10px;background:#333;color:white;border:1px solid #ffd166;border-radius:5px;">
          </div>
          
          <div id="loginError" style="color:#ff6b6b;min-height:20px;margin-bottom:10px;"></div>
          
          <button id="loginBtn" style="width:100%;padding:12px;background:#4cc9f0;color:white;border:none;border-radius:5px;font-weight:bold;cursor:pointer;">
            Enter Chat
          </button>
        </div>
        
        <div style="margin-top:20px;font-size:12px;color:#90e0ef;">
          <div>🔐 Mods need password to login</div>
          <div>⏱️ Messages auto-delete after 5 minutes</div>
          <div>🚫 60 messages/minute limit</div>
          <div>🛡️ Spam detection: 20+ messages = auto-block</div>
          <div>🗑️ Mods can delete messages</div>
        </div>
      </div>
    `;
    
    const usernameInput = document.getElementById('usernameInput');
    const passwordSection = document.getElementById('passwordSection');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');
    
    // Check if user needs password (is a mod)
    usernameInput.addEventListener('input', async function() {
      const username = this.value.trim();
      if (!username) {
        passwordSection.style.display = 'none';
        return;
      }
      
      try {
        // Check if user is a mod
        const modRes = await fetch(`${DATABASE_URL}/mods/${username}.json`);
        const isMod = await modRes.json();
        
        // Check if user has password
        const passRes = await fetch(`${DATABASE_URL}/accounts/${username}/Password.json`);
        const hasPassword = await passRes.json();
        
        // Show password field if user is a mod OR has password
        if (isMod === true || hasPassword) {
          passwordSection.style.display = 'block';
          passwordInput.placeholder = "Enter your password";
        } else {
          passwordSection.style.display = 'none';
        }
      } catch (error) {
        passwordSection.style.display = 'none';
      }
    });
    
    // Login button
    document.getElementById('loginBtn').onclick = async function() {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      
      if (!username) {
        loginError.textContent = 'Enter username';
        return;
      }
      
      try {
        // Check if user is a mod
        const modRes = await fetch(`${DATABASE_URL}/mods/${username}.json`);
        const isMod = await modRes.json();
        
        // Check if user has password
        const passRes = await fetch(`${DATABASE_URL}/accounts/${username}/Password.json`);
        const savedPassword = await passRes.json();
        
        // If user is a mod or has password, require password
        if (isMod === true || savedPassword) {
          if (!password) {
            loginError.textContent = 'Password required for this account';
            return;
          }
          
          if (password !== savedPassword) {
            loginError.textContent = 'Wrong password';
            return;
          }
        }
        
        // Login successful
        loginError.textContent = '';
        loadChat(username, username.toLowerCase() === 'jackson');
        
      } catch (error) {
        loginError.textContent = 'Error logging in';
      }
    };
  }
  
  // Global variables
  let currentUserIsMod = false;
  let currentUserIsJackson = false;
  let currentUsername = '';
  
  // Load chat interface
  function loadChat(username, isJackson) {
    currentUsername = username;
    currentUserIsJackson = isJackson;
    
    // Check if user is moderator
    fetch(DATABASE_URL + '/mods.json')
      .then(r => r.json())
      .then(mods => {
        currentUserIsMod = mods && mods[username] === true;
        
        // Load chat UI
        content.innerHTML = `
          <div style="color:white;height:100%;display:flex;flex-direction:column;">
            <div style="background:rgba(0,0,0,0.3);padding:10px;border-bottom:1px solid #4cc9f0;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  👤 <b>${username}</b>
                  ${currentUserIsMod ? ' <span style="color:#ffd166;">(Ⓜ️)</span>' : ''}
                  ${isJackson ? ' <span style="color:#4cc9f0;"> </span>' : ''}
                </div>
                <div>
                  ${currentUserIsMod ? 
                    '<button id="deleteAllBtn" style="padding:5px 10px;background:#e63946;color:white;border:none;border-radius:3px;cursor:pointer;margin-right:10px;">Delete All</button>' 
                    : ''}
                  <button id="logoutBtn" style="padding:5px 10px;background:#e63946;color:white;border:none;border-radius:3px;cursor:pointer;">Logout</button>
                </div>
              </div>
            </div>
            
            <div id="messagesArea" style="flex:1;overflow-y:auto;padding:10px;background:rgba(0,0,0,0.2);"></div>
            
            <div style="border-top:1px solid #333;padding:10px;background:rgba(0,0,0,0.3);">
              <textarea id="messageInput" placeholder="Type message (140 chars max)..." 
                        style="width:100%;height:60px;padding:10px;background:#333;color:white;border:1px solid #4cc9f0;border-radius:5px;resize:none;" 
                        maxlength="140"></textarea>
              
              <div style="display:flex;justify-content:space-between;margin-top:5px;">
                <div style="color:#90e0ef;font-size:12px;">
                  <span id="charCount">140</span> chars left
                  <span id="rateLimit" style="margin-left:10px;">0/60 min</span>
                  <span id="spamCount" style="margin-left:10px;"></span>
                </div>
                <button id="sendBtn" style="padding:8px 20px;background:#4cc9f0;color:white;border:none;border-radius:5px;font-weight:bold;cursor:pointer;">Send</button>
              </div>
              
              <div id="sendStatus" style="margin-top:5px;font-size:12px;min-height:18px;"></div>
            </div>
          </div>
        `;
        
        // Event Listeners
        document.getElementById('logoutBtn').onclick = showLogin;
        
        // Delete All Messages button (for mods only)
        if (currentUserIsMod) {
          document.getElementById('deleteAllBtn').onclick = async function() {
            if (!confirm('Are you sure you want to delete ALL messages? This action cannot be undone.')) {
              return;
            }
            
            const deleteAllStatus = document.getElementById('sendStatus');
            deleteAllStatus.textContent = 'Deleting all messages...';
            deleteAllStatus.style.color = '#ffd166';
            
            try {
              // Fetch all messages first
              const messagesRes = await fetch(`${DATABASE_URL}/ChatMessages.json`);
              const messages = await messagesRes.json();
              
              if (!messages) {
                deleteAllStatus.textContent = 'No messages to delete';
                deleteAllStatus.style.color = '#90e0ef';
                return;
              }
              
              // Delete each message individually
              const messageIds = Object.keys(messages);
              let deletedCount = 0;
              
              for (const messageId of messageIds) {
                await fetch(`${DATABASE_URL}/ChatMessages/${messageId}.json`, {
                  method: 'DELETE'
                });
                deletedCount++;
              }
              
              deleteAllStatus.textContent = `✅ Deleted ${deletedCount} messages`;
              deleteAllStatus.style.color = '#06d6a0';
              
              // Reload messages
              setTimeout(loadMessages, 500);
              
              // Clear status after 3 seconds
              setTimeout(() => {
                deleteAllStatus.textContent = '';
              }, 3000);
              
            } catch (error) {
              deleteAllStatus.textContent = 'Error deleting messages';
              deleteAllStatus.style.color = '#ff6b6b';
            }
          };
        }
        
        const messageInput = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
        const rateLimit = document.getElementById('rateLimit');
        const spamCountEl = document.getElementById('spamCount');
        const sendBtn = document.getElementById('sendBtn');
        const sendStatus = document.getElementById('sendStatus');
        
        // Character counter
        messageInput.addEventListener('input', function() {
          const remaining = 140 - this.value.length;
          charCount.textContent = remaining;
          charCount.style.color = remaining < 20 ? '#ff6b6b' : '#90e0ef';
        });
        
        // Rate limiting
        function updateRateLimit() {
          const now = Date.now();
          const userMessages = messageTracker[username] || [];
          const recentMessages = userMessages.filter(time => now - time < 60000);
          rateLimit.textContent = `${recentMessages.length}/60 min`;
          rateLimit.style.color = recentMessages.length >= 50 ? '#ffd166' : 
                                 recentMessages.length >= 60 ? '#ff6b6b' : '#90e0ef';
        }
        
        // Update spam count display
        async function updateSpamDisplay() {
          try {
            const countRes = await fetch(`${DATABASE_URL}/spamCount/${username}.json`);
            const count = await countRes.json() || 0;
            
            if (count > 0) {
              spamCountEl.textContent = `🛡️ ${count}/20`;
              spamCountEl.style.color = count > 15 ? '#ffd166' : '#90e0ef';
            } else {
              spamCountEl.textContent = '';
            }
          } catch (error) {
            spamCountEl.textContent = '';
          }
        }
        
        // Load messages
        function loadMessages() {
          fetch(DATABASE_URL + '/ChatMessages.json')
            .then(r => r.json())
            .then(messages => {
              const messagesArea = document.getElementById('messagesArea');
              messagesArea.innerHTML = '';
              
              if (!messages) {
                messagesArea.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No messages yet</div>';
                return;
              }
              
              const now = Date.now();
              const messageArray = [];
              
              // Filter and sort messages
              for (const id in messages) {
                const msg = messages[id];
                if (now - msg.timestamp < 300000) { // 5 minutes
                  messageArray.push({id, ...msg});
                }
              }
              
              messageArray.sort((a, b) => a.timestamp - b.timestamp);
              
              // Display messages
              messageArray.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.style.cssText = 'margin-bottom:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid ' + (msg.ismod ? '#ffd166' : '#4cc9f0') + ';';
                
                const canDelete = currentUserIsMod || msg.username === username;
                
                msgDiv.innerHTML = `
                  <div style="display:flex;justify-content:space-between;">
                    <div style="font-weight:bold;color:${msg.ismod ? '#ffd166' : 'white'}">
                      ${msg.ismod ? 'Ⓜ️ ' : ''}${msg.username}
                      ${msg.username === username ? ' <span style="color:#4cc9f0;font-size:10px;">(you)</span>' : ''}
                    </div>
                    <div style="font-size:11px;color:#90e0ef;">
                      ${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div style="margin-top:5px;word-break:break-word;">${msg.text}</div>
                  ${canDelete ? `
                    <div style="text-align:right;margin-top:5px;">
                      <button onclick="deleteMessage('${msg.id}')" style="background:#e63946;color:white;border:none;padding:3px 8px;border-radius:3px;font-size:11px;cursor:pointer;">Delete</button>
                    </div>
                  ` : ''}
                `;
                messagesArea.appendChild(msgDiv);
              });
              
              messagesArea.scrollTop = messagesArea.scrollHeight;
            });
        }
        
        // Global delete function
        window.deleteMessage = function(messageId) {
          fetch(DATABASE_URL + `/ChatMessages/${messageId}.json`, {
            method: 'DELETE'
          }).then(() => {
            loadMessages();
            sendStatus.textContent = 'Message deleted ✓';
            sendStatus.style.color = '#06d6a0';
            setTimeout(() => { sendStatus.textContent = ''; }, 2000);
          }).catch(error => {
            sendStatus.textContent = 'Error deleting message';
            sendStatus.style.color = '#ff6b6b';
          });
        };
        
        // Send message with spam detection
        sendBtn.onclick = async function() {
          const text = messageInput.value.trim();
          if (!text) {
            sendStatus.textContent = 'Message is empty';
            sendStatus.style.color = '#ff6b6b';
            return;
          }
          
          // Check spam status FIRST
          const spamCheck = await checkSpamStatus(username);
          if (spamCheck.blocked) {
            sendStatus.textContent = spamCheck.message;
            sendStatus.style.color = '#ff6b6b';
            return;
          }
          
          // Rate limiting
          const now = Date.now();
          if (!messageTracker[username]) messageTracker[username] = [];
          const recentMessages = messageTracker[username].filter(time => now - time < 60000);
          
          if (recentMessages.length >= 60) {
            sendStatus.textContent = 'Rate limit: 60 messages/minute';
            sendStatus.style.color = '#ff6b6b';
            updateRateLimit();
            return;
          }
          
          // Prepare message
          const messageData = {
            text: text,
            username: username,
            ismod: currentUserIsMod,
            timestamp: now
          };
          
          // Send to Firebase
          fetch(DATABASE_URL + '/ChatMessages.json', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(messageData)
          })
          .then(async response => {
            if (response.ok) {
              // Update spam detection
              const spamResult = await updateSpamCount(username);
              
              if (spamResult.isSpam) {
                sendStatus.textContent = `⚠️ SPAM DETECTED! Blocked for ${spamResult.blockDuration}s`;
                sendStatus.style.color = '#ff6b6b';
                setTimeout(() => {
                  sendStatus.textContent = '';
                  checkSpamStatus(username); // Recheck when unblocked
                  updateSpamDisplay();
                }, spamResult.blockDuration * 1000);
                return;
              }
              
              messageTracker[username].push(now);
              messageInput.value = '';
              charCount.textContent = '140';
              charCount.style.color = '#90e0ef';
              
              // Show spam count warning
              if (spamResult.count > 15) {
                sendStatus.textContent = `⚠️ Warning: ${spamResult.count}/20 messages (slow down!)`;
                sendStatus.style.color = '#ffd166';
              } else {
                sendStatus.textContent = 'Message sent ✓';
                sendStatus.style.color = '#06d6a0';
              }
              
              updateRateLimit();
              updateSpamDisplay();
              
              setTimeout(loadMessages, 500);
              setTimeout(() => { sendStatus.textContent = ''; }, 2000);
            } else {
              sendStatus.textContent = 'Error sending message';
              sendStatus.style.color = '#ff6b6b';
            }
          })
          .catch(error => {
            sendStatus.textContent = 'Network error';
            sendStatus.style.color = '#ff6b6b';
          });
        };
        
        // Send on Enter key
        messageInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });
        
        // Initial load
        loadMessages();
        updateRateLimit();
        updateSpamDisplay();
        
        // Auto-refresh messages every 5 seconds
        setInterval(loadMessages, 5000);
        setInterval(updateSpamDisplay, 5000);
        
      })
      .catch(error => {
        content.innerHTML = `<div style="color:#ff6b6b;padding:20px;">Error: ${error.message}</div>`;
      });
  }
  
  // Start with login screen
  showLogin();
})();
// === END OF CODE OWNER ===
