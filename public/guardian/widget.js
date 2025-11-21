/**
 * Migra AFM Guardian - Embeddable Chat Widget
 * Production-ready widget for customer websites
 * 
 * Usage:
 * <script>
 *   window.MigraGuardianConfig = {
 *     token: 'guardian_xxx',
 *     gatewayUrl: 'https://migrapanel.com/guardian',
 *     title: 'AI Support',
 *     primaryColor: '#3b82f6'
 *   };
 * </script>
 * <script src="https://migrapanel.com/guardian/widget.js" async></script>
 */

(function() {
  'use strict';

  // Configuration defaults
  const config = window.MigraGuardianConfig || {};
  const GATEWAY_URL = config.gatewayUrl || 'https://migrapanel.com/guardian';
  const TOKEN = config.token;
  const TITLE = config.title || 'AI Support';
  const SUBTITLE = config.subtitle || 'Ask me anything!';
  const PRIMARY_COLOR = config.primaryColor || '#3b82f6';
  const ASSISTANT_NAME = config.assistantName || 'Abigail';
  const AVATAR_URL = config.avatarUrl || '';
  const ENABLE_VOICE = config.enableVoice || false;

  if (!TOKEN) {
    console.error('[Guardian Widget] Missing token in MigraGuardianConfig');
    return;
  }

  // Generate session ID
  const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let messageHistory = [];
  let isMinimized = true;
  let isTyping = false;

  // Create widget HTML
  function createWidget() {
    const widgetHTML = `
      <div id="migra-guardian-widget" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <!-- Chat Button (Minimized) -->
        <div id="guardian-chat-button" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${PRIMARY_COLOR};
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>

        <!-- Chat Window (Expanded) -->
        <div id="guardian-chat-window" style="
          display: none;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 100px);
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          flex-direction: column;
          overflow: hidden;
        ">
          <!-- Header -->
          <div style="
            background: ${PRIMARY_COLOR};
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${AVATAR_URL ? `<img src="${AVATAR_URL}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid white;">` : `
              <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
              `}
              <div>
                <div style="font-weight: 600; font-size: 16px;">${TITLE}</div>
                <div style="font-size: 12px; opacity: 0.9;">${SUBTITLE}</div>
              </div>
            </div>
            <button id="guardian-close-btn" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 24px;
              padding: 0;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">×</button>
          </div>

          <!-- Messages Container -->
          <div id="guardian-messages" style="
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: #f9fafb;
          ">
            <div id="guardian-messages-list"></div>
          </div>

          <!-- Typing Indicator -->
          <div id="guardian-typing" style="
            display: none;
            padding: 8px 16px;
            background: #f9fafb;
            font-size: 14px;
            color: #6b7280;
          ">
            <span>${ASSISTANT_NAME} is typing</span>
            <span class="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>

          <!-- Input Area -->
          <div style="
            padding: 16px;
            background: white;
            border-top: 1px solid #e5e7eb;
          ">
            <div style="display: flex; gap: 8px;">
              <input id="guardian-input" type="text" placeholder="Type your message..." style="
                flex: 1;
                padding: 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
              " />
              <button id="guardian-send-btn" style="
                background: ${PRIMARY_COLOR};
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: opacity 0.2s;
              " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Send</button>
            </div>
            <div style="margin-top: 8px; text-align: center; font-size: 11px; color: #9ca3af;">
              Powered by <strong>Migra AFM Guardian</strong>
            </div>
          </div>
        </div>
      </div>

      <style>
        #guardian-messages::-webkit-scrollbar {
          width: 6px;
        }
        #guardian-messages::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        @keyframes typing-dots {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        .typing-dots span {
          animation: typing-dots 1.4s infinite;
        }
        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
      </style>
    `;

    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container);

    // Event listeners
    document.getElementById('guardian-chat-button').addEventListener('click', openChat);
    document.getElementById('guardian-close-btn').addEventListener('click', closeChat);
    document.getElementById('guardian-send-btn').addEventListener('click', sendMessage);
    document.getElementById('guardian-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Welcome message
    addMessage('assistant', `Hi! I'm ${ASSISTANT_NAME}, your AI support assistant. How can I help you today?`);
  }

  function openChat() {
    document.getElementById('guardian-chat-button').style.display = 'none';
    document.getElementById('guardian-chat-window').style.display = 'flex';
    isMinimized = false;
    document.getElementById('guardian-input').focus();
  }

  function closeChat() {
    document.getElementById('guardian-chat-button').style.display = 'flex';
    document.getElementById('guardian-chat-window').style.display = 'none';
    isMinimized = true;
  }

  function addMessage(role, content, toolInfo = null) {
    const messagesList = document.getElementById('guardian-messages-list');
    const isUser = role === 'user';

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      display: flex;
      justify-content: ${isUser ? 'flex-end' : 'flex-start'};
      margin-bottom: 12px;
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 16px;
      background: ${isUser ? PRIMARY_COLOR : 'white'};
      color: ${isUser ? 'white' : '#1f2937'};
      font-size: 14px;
      line-height: 1.5;
      box-shadow: ${isUser ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'};
      word-wrap: break-word;
    `;

    // Format content (simple markdown-like formatting)
    let formattedContent = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    bubble.innerHTML = formattedContent;

    // Add tool info if present
    if (toolInfo) {
      const toolBadge = document.createElement('div');
      toolBadge.style.cssText = `
        margin-top: 8px;
        padding: 4px 8px;
        background: rgba(0,0,0,0.05);
        border-radius: 4px;
        font-size: 11px;
        color: #6b7280;
      `;
      toolBadge.textContent = `🔧 Used: ${toolInfo}`;
      bubble.appendChild(toolBadge);
    }

    messageDiv.appendChild(bubble);
    messagesList.appendChild(messageDiv);

    // Auto-scroll to bottom
    document.getElementById('guardian-messages').scrollTop = 
      document.getElementById('guardian-messages').scrollHeight;
  }

  function showTyping(show) {
    document.getElementById('guardian-typing').style.display = show ? 'block' : 'none';
    isTyping = show;
  }

  async function sendMessage() {
    const input = document.getElementById('guardian-input');
    const message = input.value.trim();

    if (!message || isTyping) return;

    // Add user message to UI
    addMessage('user', message);
    input.value = '';

    // Add to history
    messageHistory.push({ role: 'user', content: message });

    // Show typing indicator
    showTyping(true);

    try {
      // Call Guardian API
      const response = await fetch(`${GATEWAY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          message,
          history: messageHistory.slice(-10), // Last 10 messages for context
          sessionId: SESSION_ID,
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        })
      });

      showTyping(false);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.ok && data.reply) {
        addMessage('assistant', data.reply, data.decidedTool?.name);
        messageHistory.push({ role: 'assistant', content: data.reply });
      } else {
        throw new Error(data.error || 'Unknown error');
      }

    } catch (error) {
      showTyping(false);
      console.error('[Guardian Widget] Error:', error);
      addMessage('assistant', '❌ Sorry, I encountered an error. Please try again or contact support.');
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }

  // Expose API for programmatic control
  window.MigraGuardian = {
    open: openChat,
    close: closeChat,
    sendMessage: (msg) => {
      if (!isMinimized) {
        document.getElementById('guardian-input').value = msg;
        sendMessage();
      }
    }
  };

  console.log('[Guardian Widget] Initialized successfully');
})();
