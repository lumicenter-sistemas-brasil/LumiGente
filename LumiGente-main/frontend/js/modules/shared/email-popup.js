// Email Popup Manager
const EmailPopup = {
    async init() {
        this.attachEventListeners();
        const shouldShow = await this.shouldShowPopup();
        if (shouldShow) {
            this.show();
        }
    },

    attachEventListeners() {
        // Event listeners são gerenciados via onclick inline no HTML
    },
    
    showToast(message, type = 'success') {
        const existingToast = document.querySelector('.config-toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `config-toast ${type}`;
        toast.innerHTML = `
            <div class="config-toast-header">
                <svg class="config-toast-icon ${type}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${type === 'success' ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
                </svg>
                <span class="config-toast-title">${type === 'success' ? 'Sucesso' : 'Erro'}</span>
                <button class="config-toast-close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="config-toast-message">${message}</div>
        `;
        
        toast.querySelector('.config-toast-close').addEventListener('click', () => toast.remove());
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    async shouldShowPopup() {
        try {
            const response = await fetch('/api/usuario', { credentials: 'include' });
            if (!response.ok) return false;

            const user = await response.json();
            
            // Não mostrar se email existe e não é vazio/null
            if (user.email && user.email !== null && user.email.trim() !== '') {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao verificar necessidade de popup de email:', error);
            return false;
        }
    },

    show() {
        const overlay = document.getElementById('email-popup-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('show');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }, 500);
        }
    },

    hide() {
        const overlay = document.getElementById('email-popup-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    },

    setButtonLoading(btn, isLoading, loadingText, originalText) {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = originalText || btn.textContent;
            btn.classList.add('is-loading');
            btn.disabled = true;
            if (loadingText) btn.textContent = loadingText;
        } else {
            btn.classList.remove('is-loading');
            btn.disabled = false;
            btn.textContent = originalText || btn.dataset.originalText || btn.textContent;
        }
    },

    async save() {
        const emailInput = document.getElementById('email-popup-input');
        const email = emailInput.value.trim();
        const sendBtn = document.querySelector('#email-popup-actions-1 .email-popup-btn-primary');

        if (!email) {
            this.showToast('Por favor, insira um email válido', 'error');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showToast('Por favor, insira um email válido', 'error');
            return;
        }

        try {
            this.setButtonLoading(sendBtn, true, 'Enviando...', 'Enviar token');
            const response = await fetch('/api/usuario/request-email-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao solicitar verificação');
            }

            this.showToast(data.message, 'success');
            this.showTokenInput();
        } catch (error) {
            console.error('Erro ao solicitar verificação:', error);
            this.showToast(error.message || 'Erro ao solicitar verificação. Tente novamente.', 'error');
        } finally {
            this.setButtonLoading(sendBtn, false, null, 'Enviar token');
        }
    },

    showTokenInput() {
        const emailStep = document.getElementById('email-popup-step-1');
        const tokenStep = document.getElementById('email-popup-step-2');
        const actions1 = document.getElementById('email-popup-actions-1');
        const actions2 = document.getElementById('email-popup-actions-2');
        
        if (emailStep) emailStep.style.display = 'none';
        if (tokenStep) tokenStep.style.display = 'block';
        if (actions1) actions1.style.display = 'none';
        if (actions2) actions2.style.display = 'flex';
    },

    async verifyToken() {
        const tokenInput = document.getElementById('email-popup-token-input');
        const token = tokenInput.value.trim();
        const verifyBtn = document.querySelector('#email-popup-actions-2 .email-popup-btn-primary');

        if (!token) {
            this.showToast('Por favor, insira o token', 'error');
            return;
        }

        try {
            this.setButtonLoading(verifyBtn, true, 'Verificando...', 'Verificar');
            const response = await fetch('/api/usuario/verify-email-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Token inválido');
            }

            this.showToast(data.message, 'success');
            this.hide();
            this.resetPopup();
            
            // Recarregar dados do usuário
            if (window.State && window.State.loadUserData) {
                await window.State.loadUserData();
            }
        } catch (error) {
            console.error('Erro ao verificar token:', error);
            this.showToast(error.message || 'Erro ao verificar token. Tente novamente.', 'error');
        } finally {
            this.setButtonLoading(verifyBtn, false, null, 'Verificar');
        }
    },

    resetPopup() {
        const emailStep = document.getElementById('email-popup-step-1');
        const tokenStep = document.getElementById('email-popup-step-2');
        const actions1 = document.getElementById('email-popup-actions-1');
        const actions2 = document.getElementById('email-popup-actions-2');
        const emailInput = document.getElementById('email-popup-input');
        const tokenInput = document.getElementById('email-popup-token-input');
        
        if (emailStep) emailStep.style.display = 'block';
        if (tokenStep) tokenStep.style.display = 'none';
        if (actions1) actions1.style.display = 'flex';
        if (actions2) actions2.style.display = 'none';
        if (emailInput) emailInput.value = '';
        if (tokenInput) tokenInput.value = '';
    },

    dismiss() {
        this.hide();
        this.resetPopup();
    },

    cancelToken() {
        this.resetPopup();
    }
};

window.EmailPopup = EmailPopup;


