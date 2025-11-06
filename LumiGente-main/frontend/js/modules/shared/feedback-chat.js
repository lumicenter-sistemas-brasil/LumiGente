// Feedback Chat Module - Sistema Completo com Reações e Reply
class FeedbackChat {
    constructor() {
        this.currentFeedbackId = null;
        this.currentFeedback = null;
        this.messages = [];
        this.replyingTo = null;
        this.emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊','💋','💌','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️','🗨️','🗯️','💭','💤','👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'];
    }

    async openChat(feedbackId) {
        this.currentFeedbackId = feedbackId;
        await this.loadFeedback();
        await this.loadMessages();
        this.renderChat();
        await Feedbacks.loadList();
    }

    async loadFeedback() {
        try {
            this.currentFeedback = await API.get(`/api/feedbacks/${this.currentFeedbackId}/info`);
        } catch (error) {
            console.error('Erro ao carregar feedback:', error);
            Notifications.error('Erro ao carregar feedback');
        }
    }

    async loadMessages() {
        try {
            this.messages = await API.get(`/api/feedbacks/${this.currentFeedbackId}/messages`);
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
            this.messages = [];
        }
    }

    renderChat() {
        const existingChat = document.querySelector('.feedback-chat-container');
        if (existingChat) existingChat.remove();

        const chatHTML = `
            <div class="feedback-chat-container">
                <div class="feedback-chat-modal">
                    <div class="chat-header">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <h3 style="margin: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Conversa sobre Feedback
                            </h3>
                            <button type="button" onclick="window.feedbackChat.closeChat()" style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 10px; border-radius: 50%; transition: all 0.3s ease; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151'" onmouseout="this.style.background='none'; this.style.color='#6b7280'">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>
                    ${this.renderFeedbackMessage()}
                    <div class="chat-messages" id="chat-messages">
                        ${this.renderMessages()}
                    </div>
                    <div class="chat-input-container">
                        <div class="reply-preview" id="reply-preview">
                            <div class="reply-preview-text">Respondendo a:</div>
                            <div class="reply-preview-message" id="reply-preview-message"></div>
                            <button class="reply-cancel-btn" onclick="window.feedbackChat.cancelReply()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div class="chat-input-wrapper">
                            <textarea class="chat-input" id="chat-input" placeholder="Digite sua mensagem..." rows="1"></textarea>
                            <div class="chat-input-actions">
                                <button class="emoji-btn" onclick="window.feedbackChat.toggleEmojiPicker()">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                                </button>
                                <button class="send-btn" onclick="window.feedbackChat.sendMessage()">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="emoji-picker" id="emoji-picker">
                            <div class="emoji-picker-header">Selecione um emoji</div>
                            <div class="emoji-grid" id="emoji-grid"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
        this.setupEventListeners();
        this.renderEmojiPicker();
        this.scrollToBottom();
    }

    renderFeedbackMessage() {
        if (!this.currentFeedback) return '';
        
        return `
            <div style="padding: 16px; background: #f0f9ff; border-bottom: 2px solid #0d556d; margin: 0; max-height: none;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="background: ${this.currentFeedback.type === 'Positivo' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${this.currentFeedback.type}</span>
                    <span style="background: #0d556d; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${this.currentFeedback.category}</span>
                </div>
                <div id="feedback-message-text" style="color: #374151; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${this.currentFeedback.message}</div>
                <button id="feedback-toggle-btn" onclick="window.feedbackChat.toggleFeedbackMessage()" style="display: none; background: none; border: none; color: #0d556d; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0; margin-top: 4px;">
                    Ler Mais
                </button>
                <div style="margin-top: 8px; color: #6b7280; font-size: 12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${this.currentFeedback.from_name} → ${this.currentFeedback.to_name}
                    <span style="margin-left: 12px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${new Date(this.currentFeedback.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `;
    }

    renderMessages() {
        if (!this.messages || this.messages.length === 0) {
            return `
                <div class="chat-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p>Nenhuma mensagem ainda. Seja o primeiro a responder!</p>
                </div>
            `;
        }

        const currentUser = State.getUser();
        return this.messages.map(msg => {
            const isOwn = currentUser && msg.user_id === currentUser.userId;
            const replyIndicator = msg.reply_to_message ? `
                <div class="reply-indicator">
                    <strong>${msg.reply_to_user}:</strong> ${msg.reply_to_message.substring(0, 50)}${msg.reply_to_message.length > 50 ? '...' : ''}
                </div>
            ` : '';
            
            return `
                <div class="chat-message ${isOwn ? 'own' : 'other'}" data-message-id="${msg.Id}">
                    <div class="message-header">
                        <span class="message-sender">${msg.user_name}</span>
                    </div>
                    ${replyIndicator}
                    <div class="message-bubble">${msg.message}</div>
                    <div class="message-info">
                        <span class="message-time">${this.formatTime(msg.created_at)}</span>
                    </div>
                    <div class="message-actions">
                        <button class="message-action-btn reply-btn" onclick="window.feedbackChat.replyTo(${msg.Id}, '${msg.user_name}', '${msg.message.replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg> Responder
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupEventListeners() {
        const input = document.getElementById('chat-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Verificar se mensagem precisa do botão "Ler Mais"
        setTimeout(() => {
            const messageText = document.getElementById('feedback-message-text');
            const toggleBtn = document.getElementById('feedback-toggle-btn');
            if (messageText && toggleBtn) {
                if (messageText.scrollHeight > messageText.clientHeight) {
                    toggleBtn.style.display = 'block';
                }
            }
        }, 100);
        
        // Fechar com ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeChat();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Fechar emoji picker ao clicar fora
        document.addEventListener('click', (e) => {
            const picker = document.getElementById('emoji-picker');
            const emojiBtn = document.querySelector('.emoji-btn');
            if (picker && !picker.contains(e.target) && !emojiBtn.contains(e.target)) {
                picker.classList.remove('show');
            }
        });
    }

    renderEmojiPicker() {
        const grid = document.getElementById('emoji-grid');
        if (grid) {
            grid.innerHTML = this.emojis.map(emoji => 
                `<div class="emoji-item" onclick="window.feedbackChat.insertEmoji('${emoji}')">${emoji}</div>`
            ).join('');
        }
    }

    toggleEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (picker) {
            picker.classList.toggle('show');
        }
    }

    insertEmoji(emoji) {
        const input = document.getElementById('chat-input');
        if (input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = input.value;
            input.value = text.substring(0, start) + emoji + text.substring(end);
            input.selectionStart = input.selectionEnd = start + emoji.length;
            input.focus();
        }
        this.toggleEmojiPicker();
    }

    replyTo(messageId, userName, message) {
        this.replyingTo = messageId;
        const preview = document.getElementById('reply-preview');
        const previewMessage = document.getElementById('reply-preview-message');
        
        if (preview && previewMessage) {
            previewMessage.innerHTML = `<strong>${userName}:</strong> ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`;
            preview.classList.add('show');
        }
        
        document.getElementById('chat-input')?.focus();
    }

    cancelReply() {
        this.replyingTo = null;
        document.getElementById('reply-preview')?.classList.remove('show');
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        try {
            await API.post(`/api/feedbacks/${this.currentFeedbackId}/messages`, { 
                message,
                reply_to: this.replyingTo 
            });
            input.value = '';
            this.cancelReply();
            await this.loadMessages();
            this.updateMessages();
            await Feedbacks.loadList();
            Notifications.success('Mensagem enviada!');
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            Notifications.error('Erro ao enviar mensagem');
        }
    }

    updateMessages() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.innerHTML = this.renderMessages();
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = document.getElementById('chat-messages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }

    formatTime(date) {
        const d = new Date(date);
        d.setHours(d.getHours() + 3);
        return d.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    toggleFeedbackMessage() {
        const messageText = document.getElementById('feedback-message-text');
        const toggleBtn = document.getElementById('feedback-toggle-btn');
        
        if (messageText && toggleBtn) {
            const isExpanded = messageText.style.webkitLineClamp === 'unset';
            
            if (isExpanded) {
                messageText.style.webkitLineClamp = '3';
                messageText.style.display = '-webkit-box';
                toggleBtn.textContent = 'Ler Mais';
            } else {
                messageText.style.webkitLineClamp = 'unset';
                messageText.style.display = 'block';
                toggleBtn.textContent = 'Ler Menos';
            }
        }
    }

    closeChat() {
        const container = document.querySelector('.feedback-chat-container');
        if (container) container.remove();
        this.currentFeedbackId = null;
        this.currentFeedback = null;
        this.messages = [];
        this.replyingTo = null;
    }
}

window.FeedbackChat = FeedbackChat;
window.feedbackChat = new FeedbackChat();
