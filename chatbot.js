// ==== Theme Color Handling ====
document.querySelectorAll('.dropdown-item').forEach(item => {
	item.addEventListener('click', (e) => {
		e.preventDefault();
		const color = e.target.dataset.color;
		document.querySelector('.navbar').style.backgroundColor = color;
		document.body.style.backgroundColor = color;
	});
});

// ==== Dark Mode Toggle ====
const toggleBtn = document.getElementById('toggleBtn');
let isDark = false;
toggleBtn.addEventListener('click', () => {
	isDark = !isDark;
	document.body.style.backgroundColor = isDark ? 'black' : 'white';
	toggleBtn.textContent = isDark ? '🌕' : '🌙';
});

// ==== Chatbox Background Switcher ====
const sd_1 = document.querySelector('.sd-1');
const sd_2 = document.querySelector('.sd-2');
const sd_3 = document.querySelector('.sd-3');
const chatBox = document.querySelector('.chat-messages');

[sd_1, sd_2, sd_3].forEach(sd => {
	if (sd && chatBox) {
		sd.addEventListener('click', () => {
			chatBox.style.backgroundColor = sd.style.backgroundColor;
		});
	}
});

// ==== Chat Functionality ====
const chatForm = document.getElementById('chat-form');
const messageInput = document.querySelector('.message-input');
const chatMessages = document.getElementById('chat-messages');
const GEMINI_API_KEY = "API_KEY"; // One can get API KEY from https://aistudio.google.com/app/apikey 

// ==== Conversation context tracking ====
let conversationContext = {
	lastQuestion: null,
	lastResponse: null,
	currentTopic: null
};

// ==== CSS for typing indicator ====
const style = document.createElement('style');
style.textContent = `
	.typing-indicator {
	    display: inline-flex;
	    align-items: center;
	    height: 20px;
	}
	.typing-dot {
	    width: 6px;
	    height: 6px;
	    margin: 0 2px;
	    background-color: #9ca3af;
	    border-radius: 50%;
	    display: inline-block;
	    animation: typingAnimation 1.4s infinite ease-in-out;
	}
	.typing-dot:nth-child(1) {
	    animation-delay: 0s;
	}
	.typing-dot:nth-child(2) {
	    animation-delay: 0.1s;
	}
	.typing-dot:nth-child(3) {
	    animation-delay: 0.2s;
	}
	@keyframes typingAnimation {
	    0%, 60%, 100% { transform: translateY(0); }
	    30% { transform: translateY(-5px); }
	}
    `;
document.head.appendChild(style);

if (chatForm && messageInput && chatMessages) {
	chatForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const userMessage = messageInput.value.trim();
		if (!userMessage) return;

		// ==== Add user message ====
		addMessage(userMessage, 'user');
		messageInput.value = '';

		// ==== Create and show typing indicator ====
		const typingIndicator = createTypingIndicator();
		chatMessages.appendChild(typingIndicator);
		chatMessages.scrollTop = chatMessages.scrollHeight;

		try {
			// ==== Check if this is a follow-up question ====
			const isFollowUp = isFollowUpQuestion(userMessage);

			let prompt = userMessage;
			if (isFollowUp && conversationContext.lastResponse) {
				prompt = `This is a follow-up to: "${conversationContext.lastQuestion}". 
			     The previous response was: "${conversationContext.lastResponse}".
			     Now the user is asking: "${userMessage}". 
			     Please respond accordingly.`;
			}

			const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contents: [{
						parts: [{ text: prompt }]
					}]
				})
			});

			if (!response.ok) throw new Error(`API error: ${response.status}`);
			const data = await response.json();
			let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not understand that.';

			// ==== Update context ====
			if (!isFollowUp) {
				conversationContext.currentTopic = extractMainTopic(userMessage);
			}
			conversationContext.lastQuestion = userMessage;
			conversationContext.lastResponse = botReply;

			// ==== Remove typing indicator ====
			chatMessages.removeChild(typingIndicator);

			// ==== Add bot response ====
			botReply = formatResponse(botReply);
			addMessage(botReply, 'bot');
		} catch (err) {
			console.error(err);
			// ==== Remove typing indicator if still exists ====
			if (typingIndicator.parentNode === chatMessages) {
				chatMessages.removeChild(typingIndicator);
			}
			addMessage("Something went wrong. Please try again later.", 'bot');
		}
	});
} else {
	console.warn("Chat elements not found");
}

// ==== Create typing indicator element ====
function createTypingIndicator() {
	const typingDiv = document.createElement('div');
	typingDiv.className = 'message bot-message';
	typingDiv.innerHTML = `
	    <div class="message-content">
		<div class="ai-badge">AI</div>
		<div>
		    <div class="fw-bold text-purple-400 mb-1">AI Assistant</div>
		    <div class="typing-indicator">
			<div class="typing-dot"></div>
			<div class="typing-dot"></div>
			<div class="typing-dot"></div>
		    </div>
		</div>
	    </div>
	`;
	return typingDiv;
}

// ==== Check if the question is a follow-up ====
function isFollowUpQuestion(message) {
	const followUpWords = ['this', 'that', 'it', 'the above', 'previous'];
	const actionWords = ['summarize', 'explain more', 'elaborate', 'in points', 'bullet points'];
	const lowerMessage = message.toLowerCase();

	return followUpWords.some(word => lowerMessage.includes(word)) ||
		actionWords.some(word => lowerMessage.includes(word));
}

// ==== Extract main topic from message ====
function extractMainTopic(message) {
	const stopWords = ['what', 'how', 'why', 'when', 'where', 'who', 'can', 'you', 'please', 'explain', 'tell', 'me', 'about'];
	const words = message.toLowerCase().split(' ')
		.filter(word => !stopWords.includes(word));
	return words.slice(0, 5).join(' ');
}

// ==== Format the API response with proper paragraphs ====
function formatResponse(text) {
	// ==== Clean up markdown and special characters ====
	text = text
		.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.*?)\*/g, '<em>$1</em>')
		.replace(/#/g, '')
		.replace(/`{3}(.*?)`{3}/gs, '<pre><code>$1</code></pre>')
		.replace(/`(.*?)`/g, '<code>$1</code>')
		.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

	// ==== Format lists ====
	text = text.replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>');
	text = text.replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>');
	text = text.replace(/(<li>.*<\/li>)+/gs, (match) => {
		return match.includes('1.') ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
	});

	// ==== Handle headings ====
	text = text
		.replace(/^##\s+(.*$)/gm, '<h2>$1</h2>')
		.replace(/^###\s+(.*$)/gm, '<h3>$1</h3>');

	// ==== Paragraph formatting ====
	text = text
		.split('\n\n')
		.map(para => {
			if (para.startsWith('<pre>')) return para;
			para = para.replace(/\n/g, '<br>');
			return `<p>${para}</p>`;
		})
		.join('');

	// ==== Clean up and style ====
	return text
		.replace(/<p><\/p>/g, '')
		.replace(/<h2>/g, '<h2 style="font-size:1.25rem;font-weight:600;margin:1rem 0 0.5rem;color:#d1d5db;">')
		.replace(/<h3>/g, '<h3 style="font-size:1.1rem;font-weight:500;margin:0.8rem 0 0.4rem;color:#d1d5db;">')
		.replace(/<p>/g, '<p style="margin:0.5rem 0;line-height:1.5;">')
		.replace(/<code>/g, '<code style="background:rgba(55,65,81,0.5);padding:0.2rem 0.4rem;border-radius:0.25rem;font-family:monospace;">')
		.replace(/<pre>/g, '<pre style="background:rgba(55,65,81,0.5);padding:1rem;border-radius:0.5rem;overflow-x:auto;margin:0.75rem 0;">');
}

// ==== Add message to chat window ====
function addMessage(text, sender) {
	const messageDiv = document.createElement('div');
	messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

	if (sender === 'user') {
		messageDiv.innerHTML = `
	    <div class="message-content">
		<div class="ms-auto text-end">
		    <div class="fw-bold text-blue-100 mb-1">You</div>
		    <div class="text-white">${text}</div>
		</div>
		<div class="user-badge">U</div>
	    </div>`;
	} else {
		messageDiv.innerHTML = `
	    <div class="message-content">
		<div class="ai-badge">AI</div>
		<div>
		    <div class="fw-bold text-purple-400 mb-1">AI Assistant</div>
		    <div class="text-gray-300">${text}</div>
		</div>
	    </div>`;
	}

	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}