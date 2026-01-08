// DOM Elements
const form = document.getElementById('query-form');
const input = document.getElementById('user-input');
const messagesContainer = document.getElementById('messages');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const sendButton = document.getElementById('send-button');
const themeToggle = document.getElementById('theme-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistory = document.getElementById('chat-history');

// State
let conversationHistory = [];
let currentChatId = null;

// Initialize
initializeApp();

function initializeApp() {
    loadTheme();
    loadChatHistory();
    setupEventListeners();
    autoResizeTextarea();
}

function setupEventListeners() {
    // Form submission
    form.addEventListener('submit', handleSubmit);

    // Input handling
    input.addEventListener('input', () => {
        autoResizeTextarea();
        sendButton.disabled = input.value.trim() === '';
    });

    // Enter key handling
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.value.trim()) {
                form.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // New chat
    newChatBtn.addEventListener('click', startNewChat);

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const suggestion = card.getAttribute('data-suggestion');
            input.value = suggestion;
            sendButton.disabled = false;
            input.focus();
        });
    });
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const userText = input.value.trim();
    if (!userText) return;

    // Hide welcome screen on first message
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    // Add user message
    addMessage('user', userText);
    conversationHistory.push({ role: 'user', content: userText });

    // Clear input
    input.value = '';
    sendButton.disabled = true;
    autoResizeTextarea();

    // Add bot typing indicator
    const typingMessage = addTypingIndicator();

    try {
        const response = await fetch('http://localhost:5000/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: userText }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Remove typing indicator
        typingMessage.remove();

        // Add bot response
        const botText = data.answer || data.error || 'Sorry, I encountered an error.';
        addMessage('bot', botText);
        conversationHistory.push({ role: 'bot', content: botText });

        // Save to history
        saveChatToHistory(userText);

    } catch (error) {
        console.error('Error:', error);
        typingMessage.remove();
        addMessage('bot', '❗ Sorry, I encountered an error connecting to the server. Please try again.');
    }
}

function addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = text;

    content.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

function addTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;

    content.appendChild(typingDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

function scrollToBottom() {
    messagesWrapper.scrollTo({
        top: messagesWrapper.scrollHeight,
        behavior: 'smooth'
    });
}

function autoResizeTextarea() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
}

function startNewChat() {
    conversationHistory = [];
    messagesContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    currentChatId = null;
    input.value = '';
    sendButton.disabled = true;
    input.focus();
}

function saveChatToHistory(firstMessage) {
    if (currentChatId) return; // Don't create duplicate entries

    currentChatId = Date.now();
    const chatData = {
        id: currentChatId,
        title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
    };

    let history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    history.unshift(chatData);
    
    // Keep only last 20 chats
    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    localStorage.setItem('chatHistory', JSON.stringify(history));
    renderChatHistory();
}

function loadChatHistory() {
    renderChatHistory();
}

function renderChatHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    chatHistory.innerHTML = '';

    history.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = chat.title;
        item.title = chat.title;
        chatHistory.appendChild(item);
    });
}

// Focus input on load
input.focus();