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
    
    // Debug: Log all stored conversations
    console.log('=== DEBUGGING STORAGE ===');
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    console.log('Chat history:', history);
    history.forEach(chat => {
        const conv = localStorage.getItem(`conversation_${chat.id}`);
        console.log(`Conversation ${chat.id}:`, conv ? JSON.parse(conv) : 'NOT FOUND');
    });
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
    
    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllHistory);
    }

    // Chat history - using event delegation
    chatHistory.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem && historyItem.dataset.chatId) {
            console.log('Clicked history item:', historyItem.dataset.chatId);
            const chatId = parseInt(historyItem.dataset.chatId);
            loadConversation(chatId);
            // Update active state
            document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
            historyItem.classList.add('active');
        }
        
        // Handle delete button click
        const deleteBtn = e.target.closest('.delete-chat-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const historyItem = deleteBtn.closest('.history-item');
            if (historyItem && historyItem.dataset.chatId) {
                const chatId = parseInt(historyItem.dataset.chatId);
                deleteChat(chatId);
            }
        }
    });

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

    // Create new chat if this is the first message
    if (!currentChatId) {
        currentChatId = Date.now();
        console.log('Created new chat with ID:', currentChatId);
        saveChatToHistory(userText);
    }

    // Hide welcome screen on first message
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    // Add user message
    addMessage('user', userText);
    conversationHistory.push({ role: 'user', content: userText });
    
    // Save conversation after user message
    saveCurrentConversation();

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

        // Save conversation after bot response
        saveCurrentConversation();

    } catch (error) {
        console.error('Error:', error);
        typingMessage.remove();
        const errorMsg = '❗ Sorry, I encountered an error connecting to the server. Please try again.';
        addMessage('bot', errorMsg);
        conversationHistory.push({ role: 'bot', content: errorMsg });
        saveCurrentConversation();
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
    // Remove active state from all history items
    document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
}

function saveChatToHistory(firstMessage) {
    const chatData = {
        id: currentChatId,
        title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
    };

    let history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    
    // Check if this chat already exists
    const existingIndex = history.findIndex(chat => chat.id === currentChatId);
    if (existingIndex === -1) {
        // Add new chat at the beginning
        history.unshift(chatData);
    } else {
        // Update existing chat
        history[existingIndex] = chatData;
    }
    
    // Keep only last 20 chats
    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    localStorage.setItem('chatHistory', JSON.stringify(history));
    console.log('Saved chat to history:', chatData);
    renderChatHistory();
}

function saveCurrentConversation() {
    if (!currentChatId) {
        console.error('Cannot save conversation: no currentChatId');
        return;
    }
    
    const conversationData = {
        id: currentChatId,
        messages: conversationHistory
    };
    
    localStorage.setItem(`conversation_${currentChatId}`, JSON.stringify(conversationData));
    console.log(`Saved conversation ${currentChatId} with ${conversationHistory.length} messages`);
}

function loadConversation(chatId) {
    console.log('Attempting to load conversation:', chatId);
    const conversationData = localStorage.getItem(`conversation_${chatId}`);
    
    if (!conversationData) {
        console.error('Conversation not found for ID:', chatId);
        alert('Could not load this conversation. It may have been deleted.');
        return;
    }
    
    try {
        const data = JSON.parse(conversationData);
        conversationHistory = data.messages || [];
        currentChatId = data.id;
        
        console.log('Loaded conversation data:', data);
        
        // Clear and hide welcome screen
        messagesContainer.innerHTML = '';
        welcomeScreen.style.display = 'none';
        
        // Render all messages
        if (conversationHistory.length === 0) {
            console.warn('No messages in conversation');
            welcomeScreen.style.display = 'flex';
        } else {
            conversationHistory.forEach(msg => {
                addMessage(msg.role, msg.content);
            });
            console.log(`Rendered ${conversationHistory.length} messages`);
        }
        
        input.focus();
    } catch (error) {
        console.error('Error loading conversation:', error);
        alert('Error loading conversation: ' + error.message);
    }
}

function loadChatHistory() {
    renderChatHistory();
}

function renderChatHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    chatHistory.innerHTML = '';

    if (history.length === 0) {
        chatHistory.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary); font-size: 13px;">No chat history yet</div>';
        return;
    }

    history.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.chatId = chat.id;
        
        if (chat.id === currentChatId) {
            item.classList.add('active');
        }
        
        const textSpan = document.createElement('span');
        textSpan.className = 'history-item-text';
        textSpan.textContent = chat.title;
        textSpan.title = chat.title;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        deleteBtn.title = 'Delete chat';
        
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        chatHistory.appendChild(item);
    });
    
    console.log(`Rendered ${history.length} chat history items`);
}

function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) {
        return;
    }
    
    console.log('Deleting chat:', chatId);
    
    // Remove from history
    let history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    history = history.filter(chat => chat.id !== chatId);
    localStorage.setItem('chatHistory', JSON.stringify(history));
    
    // Remove conversation data
    localStorage.removeItem(`conversation_${chatId}`);
    
    // If this was the current chat, start a new one
    if (currentChatId === chatId) {
        startNewChat();
    }
    
    // Re-render history
    renderChatHistory();
    console.log('Chat deleted successfully');
}

function clearAllHistory() {
    if (!confirm('Are you sure you want to delete ALL chat history? This cannot be undone.')) {
        return;
    }
    
    console.log('Clearing all chat history');
    
    // Get all chat IDs
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    
    // Remove all conversation data
    history.forEach(chat => {
        localStorage.removeItem(`conversation_${chat.id}`);
    });
    
    // Clear chat history
    localStorage.removeItem('chatHistory');
    
    // Start new chat
    startNewChat();
    
    // Re-render history
    renderChatHistory();
    
    console.log('All chat history cleared');
}

// Focus input on load
input.focus();