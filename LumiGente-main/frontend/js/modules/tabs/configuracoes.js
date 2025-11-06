const Configuracoes = {
    tokenReceived: false,
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
    
    async load() {
        await this.loadUserEmail();
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
    
    showConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'config-confirm-overlay';
            overlay.innerHTML = `
                <div class="config-confirm-modal">
                    <svg class="config-confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3 class="config-confirm-title">Confirmação</h3>
                    <p class="config-confirm-message">${message}</p>
                    <div class="config-confirm-actions">
                        <button class="btn btn-secondary" data-action="cancel">Cancelar</button>
                        <button class="btn btn-amber" data-action="confirm">Confirmar</button>
                    </div>
                </div>
            `;
            
            const close = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                resolve(result);
            };
            
            overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
            overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
            
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);
        });
    },

    async loadUserEmail() {
        try {
            const response = await fetch('/api/usuario', { credentials: 'include' });
            const user = await response.json();
            
            const emailDisplay = document.getElementById('user-email-display');
            const emailActionBtn = document.getElementById('email-action-btn');
            
            if (user.email && user.email.trim() !== '') {
                if (emailDisplay) emailDisplay.textContent = user.email;
                if (emailActionBtn) {
                    emailActionBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
                        Alterar Email
                    `;
                }
            } else {
                if (emailDisplay) emailDisplay.textContent = 'Não cadastrado';
            }
        } catch (error) {
            console.error('Erro ao carregar email:', error);
        }
    },
    
    async startEmailProcess() {
        const currentEmail = document.getElementById('user-email-display').textContent;
        const isChangingEmail = currentEmail !== 'Não cadastrado' && currentEmail !== 'Carregando...';
        
        if (isChangingEmail) {
            const confirmed = await this.showConfirm('Deseja realmente alterar seu email? Você precisará verificar o novo email.');
            if (!confirmed) return;
        }
        
        document.getElementById('email-initial').style.display = 'none';
        document.getElementById('email-input-step').style.display = 'block';
    },

    async requestEmailVerification() {
        const email = document.getElementById('email-input').value.trim();
        const sendBtn = document.querySelector('#email-input-step .btn-amber');

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
            this.showEmailTokenInput();
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.setButtonLoading(sendBtn, false, null, 'Enviar token');
        }
    },

    showEmailTokenInput() {
        document.getElementById('email-input-step').style.display = 'none';
        document.getElementById('email-token-input').style.display = 'block';
    },

    async verifyEmailToken() {
        const token = document.getElementById('email-token-input-field').value.trim();
        const verifyBtn = document.querySelector('#email-token-input .btn-amber');

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
                this.showToast(data.error || 'Token inválido', 'error');
                return;
            }

            this.showToast(data.message, 'success');
            this.resetEmailForm();
            await this.loadUserEmail();
            
            // Recarregar dados do usuário no State
            if (window.State && window.State.loadUserData) {
                await window.State.loadUserData();
            }
        } catch (error) {
            this.showToast('Erro ao verificar token', 'error');
        } finally {
            this.setButtonLoading(verifyBtn, false, null, 'Verificar');
        }
    },

    resetEmailForm() {
        document.getElementById('email-initial').style.display = 'block';
        document.getElementById('email-input-step').style.display = 'none';
        document.getElementById('email-token-input').style.display = 'none';
        document.getElementById('email-input').value = '';
        document.getElementById('email-token-input-field').value = '';
    },

    async cancelEmailVerification() {
        const confirmed = await this.showConfirm('Deseja cancelar a verificação de email?');
        if (confirmed) {
            this.resetEmailForm();
        }
    },

    // ===================================================
    // SISTEMA NOVO DE TROCA DE SENHA COM REVERSÃO
    // ===================================================
    async requestPasswordReset() {
        // Mostrar formulário para pedir senha atual
        document.getElementById('password-reset-initial').style.display = 'none';
        document.getElementById('password-reset-current-password').style.display = 'block';
    },

    async initiatePasswordChange() {
        const currentPassword = document.getElementById('current-password-input').value;
        const newPassword = document.getElementById('new-password-input-initial').value;
        const confirmPassword = document.getElementById('confirm-password-input-initial').value;

        // Validações
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showToast('A nova senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('As novas senhas não coincidem', 'error');
            return;
        }

        if (currentPassword === newPassword) {
            this.showToast('A nova senha deve ser diferente da atual', 'error');
            return;
        }

        try {
            console.log('🔄 Iniciando troca de senha...');
            const response = await fetch('/api/usuario/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao solicitar alteração de senha');
            }

            console.log('✅ Emails enviados com sucesso!');
            this.showToast('Token enviado para seu email! Verifique sua caixa de entrada.', 'success');
            this.showTokenInput();
        } catch (error) {
            console.error('❌ Erro ao iniciar troca de senha:', error);
            this.showToast(error.message, 'error');
        }
    },

    showTokenInput() {
        document.getElementById('password-reset-current-password').style.display = 'none';
        document.getElementById('password-reset-token-input').style.display = 'block';
    },

    async verifyToken() {
        const token = document.getElementById('reset-token-input').value.trim();

        if (!token || token.length !== 6) {
            this.showToast('Por favor, insira o token de 6 dígitos', 'error');
            return;
        }

        try {
            console.log('🔍 Verificando token...');
            const response = await fetch('/api/usuario/verify-password-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Token inválido ou expirado');
            }

            console.log('✅ Senha alterada com sucesso!');
            this.showToast('Senha alterada! Você será desconectado em 3 segundos...', 'success');
            
            // Aguardar 3 segundos e fazer logout
            setTimeout(() => {
                window.location.href = '/pages/login.html';
            }, 3000);
        } catch (error) {
            console.error('❌ Erro ao verificar token:', error);
            this.showToast(error.message, 'error');
        }
    },

    cancelReset() {
        this.resetForm();
        this.showToast('Operação cancelada', 'info');
    },

    resetForm() {
        // Resetar para estado inicial
        document.getElementById('password-reset-initial').style.display = 'block';
        document.getElementById('password-reset-current-password').style.display = 'none';
        document.getElementById('password-reset-token-input').style.display = 'none';
        
        // Limpar campos
        if (document.getElementById('current-password-input')) {
            document.getElementById('current-password-input').value = '';
        }
        if (document.getElementById('new-password-input-initial')) {
            document.getElementById('new-password-input-initial').value = '';
        }
        if (document.getElementById('confirm-password-input-initial')) {
            document.getElementById('confirm-password-input-initial').value = '';
        }
        if (document.getElementById('reset-token-input')) {
            document.getElementById('reset-token-input').value = '';
        }
        
        this.tokenReceived = false;
    },

    async cancelReset() {
        const confirmed = await this.showConfirm('Deseja cancelar a alteração de senha?');
        if (confirmed) {
            this.resetForm();
        }
    }
};

window.Configuracoes = Configuracoes;
