// Auth - Login Handler Module
const LoginHandler = {
    isLoginForm: true,

    init() {
        sessionStorage.removeItem('logoutByButton');
        sessionStorage.removeItem('sessionInvalidated');
        this.setupEventListeners();
    },

    setupEventListeners() {
        document.getElementById('loginCpf')?.addEventListener('input', (e) => {
            e.target.value = this.formatarCPF(e.target.value);
            this.hideMessages();
        });

        document.getElementById('registerCpf')?.addEventListener('input', (e) => {
            e.target.value = this.formatarCPF(e.target.value);
            this.hideMessages();
        });

        document.getElementById('forgotCpf')?.addEventListener('input', (e) => {
            e.target.value = this.formatarCPF(e.target.value);
            this.hideMessages();
        });

        ['loginPassword', 'registerPassword', 'confirmPassword', 'forgotNewPassword', 'forgotConfirmPassword'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.hideMessages());
        });

        document.getElementById('toggleForm')?.addEventListener('click', () => this.toggleForm());
        document.getElementById('toggleForgotPassword')?.addEventListener('click', () => this.toggleForgotPassword());
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
        
        // Event listeners para forgot password
        document.getElementById('sendForgotTokenBtn')?.addEventListener('click', () => this.sendForgotPasswordToken());
        document.getElementById('verifyForgotTokenBtn')?.addEventListener('click', () => this.verifyForgotPasswordToken());
        document.getElementById('cancelForgotPasswordBtn')?.addEventListener('click', () => this.cancelForgotPassword());
    },

    formatarCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
        cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return cpf;
    },

    validarCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

        let soma = 0;
        for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
        let resto = soma % 11;
        let dv1 = resto < 2 ? 0 : 11 - resto;

        soma = 0;
        for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
        resto = soma % 11;
        let dv2 = resto < 2 ? 0 : 11 - resto;

        return parseInt(cpf.charAt(9)) === dv1 && parseInt(cpf.charAt(10)) === dv2;
    },

    toggleForgotPassword() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const userInfo = document.getElementById('userInfo');
        const toggleButton = document.getElementById('toggleForm');
        const toggleText = document.getElementById('toggleText');

        this.hideMessages();

        if (forgotPasswordForm.style.display === 'none' || !forgotPasswordForm.style.display) {
            // Mostrar forgot password
            loginForm.style.display = 'none';
            registerForm.style.display = 'none';
            forgotPasswordForm.style.display = 'block';
            userInfo.style.display = 'none';
            
            toggleText.textContent = 'Voltar ao login?';
            toggleButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Fazer Login';
            
            // Setar FALSE para que ao clicar vá para LOGIN (else do toggleForm)
            this.isLoginForm = false;
            
            this.resetForgotPasswordForm();
        } else {
            // Voltar para login
            forgotPasswordForm.style.display = 'none';
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            
            toggleText.textContent = 'Primeiro acesso?';
            toggleButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Criar conta';
            
            // Garantir que está no estado de login
            this.isLoginForm = true;
        }
    },

    toggleForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const toggleButton = document.getElementById('toggleForm');
        const toggleText = document.getElementById('toggleText');

        if (this.isLoginForm) {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            forgotPasswordForm.style.display = 'none';
            toggleButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Fazer Login';
            toggleText.textContent = 'Já possui conta?';
            this.isLoginForm = false;
        } else {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            forgotPasswordForm.style.display = 'none';
            toggleButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Criar conta';
            toggleText.textContent = 'Primeiro acesso?';
            this.isLoginForm = true;
        }

        this.hideMessages();
        document.getElementById('userInfo').style.display = 'none';
    },

    showToast(message, type = 'success') {
        // Remover toast anterior se existir
        const existingToast = document.querySelector('.login-toast');
        if (existingToast) existingToast.remove();
        
        // Criar novo toast
        const toast = document.createElement('div');
        toast.className = `login-toast ${type}`;
        
        // Definir ícone baseado no tipo
        let icon = '';
        let title = '';
        if (type === 'success') {
            icon = '<polyline points="20 6 9 17 4 12"/>';
            title = 'Sucesso';
        } else if (type === 'error') {
            icon = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
            title = 'Erro';
        } else if (type === 'info') {
            icon = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/>';
            title = 'Informação';
        }
        
        toast.innerHTML = `
            <div class="login-toast-header">
                <svg class="login-toast-icon ${type}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${icon}
                </svg>
                <span class="login-toast-title">${title}</span>
                <button class="login-toast-close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="login-toast-message">${message}</div>
        `;
        
        // Event listener para fechar
        toast.querySelector('.login-toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Adicionar ao body
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    showMessage(type, message) {
        // Manter para compatibilidade, mas usar toast
        this.showToast(message, type);
    },

    hideMessages() {
        // Remover toasts ao invés de esconder divs
        const toasts = document.querySelectorAll('.login-toast');
        toasts.forEach(toast => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    },

    showLoading(text = 'Processando...') {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loading').style.display = 'block';
    },

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    },

    async handleLogin(e) {
        e.preventDefault();
        const cpf = document.getElementById('loginCpf').value;
        const password = document.getElementById('loginPassword').value;

        if (!this.validarCPF(cpf)) {
            this.showMessage('error', 'CPF inválido');
            return;
        }

        this.showLoading('Entrando no sistema...');
        this.hideMessages();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cpf, password })
            });

            const data = await response.json();

            // Verificar PRIMEIRO se precisa de registro (ANTES de verificar response.ok)
            if (data.needsRegistration) {
                this.showToast('Você não possui cadastro ainda. Clique em "Criar conta" para se cadastrar.', 'error');
                // NÃO redireciona - usuário permanece na tela de login
                return;
            }

            // Agora sim, verificar se login foi bem-sucedido
            if (response.ok && data.success !== false) {
                this.showToast('Login realizado com sucesso!', 'success');
                sessionStorage.removeItem('logoutByButton');
                sessionStorage.removeItem('sessionInvalidated');
                sessionStorage.setItem('justLoggedIn', 'true');
                setTimeout(() => {
                    history.replaceState({ authenticated: true, page: 'app' }, null, '/pages/index.html');
                    window.location.replace('/pages/index.html');
                }, 1000);
            } else {
                if (data.userNotFound) {
                    this.showToast('CPF não encontrado.', 'error');
                } else {
                    this.showToast(data.error || 'Erro no login', 'error');
                }
            }
        } catch (error) {
            this.showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        if (this.isRegistering) return;

        this.isRegistering = true;
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        const cpf = document.getElementById('registerCpf').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!this.validarCPF(cpf)) {
            this.showToast('CPF inválido', 'error');
            this.isRegistering = false;
            submitButton.disabled = false;
            return;
        }

        if (password.length < 6) {
            this.showToast('A senha deve ter pelo menos 6 caracteres', 'error');
            this.isRegistering = false;
            submitButton.disabled = false;
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('As senhas não coincidem', 'error');
            this.isRegistering = false;
            submitButton.disabled = false;
            return;
        }

        this.showLoading('Verificando CPF...');
        this.hideMessages();

        try {
            const checkResponse = await fetch('/api/check-cpf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cpf })
            });

            const checkData = await checkResponse.json();

            // Se exists = true, CPF já foi cadastrado (FirstLogin = 0)
            if (checkData.exists) {
                this.showToast(checkData.message || 'CPF já cadastrado no sistema', 'error');
                this.hideLoading();
                this.isRegistering = false;
                submitButton.disabled = false;
                return;
            }
            
            // Se exists = false e não tem erro, CPF é válido para registro (FirstLogin = 1)
            if (!checkResponse.ok) {
                this.showToast(checkData.message || 'Erro ao verificar CPF', 'error');
                this.hideLoading();
                this.isRegistering = false;
                submitButton.disabled = false;
                return;
            }

            this.showLoading('Criando conta...');

            const registerResponse = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cpf, password })
            });

            const registerData = await registerResponse.json();

            if (registerResponse.ok) {
                this.showToast('Cadastro realizado com sucesso! Redirecionando para login...', 'success');
                sessionStorage.removeItem('logoutByButton');
                sessionStorage.removeItem('sessionInvalidated');
                setTimeout(() => {
                    document.getElementById('registerForm').reset();
                    document.getElementById('userInfo').style.display = 'none';
                    document.getElementById('toggleForm').click();
                    document.getElementById('loginCpf').value = cpf;
                    document.getElementById('loginPassword').focus();
                    this.hideMessages();
                }, 2000);
            } else {
                this.showToast(registerData.error || 'Erro ao criar conta', 'error');
            }
        } catch (error) {
            this.showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.hideLoading();
            this.isRegistering = false;
            submitButton.disabled = false;
        }
    },

    // ===================================================
    // SISTEMA DE RECUPERAÇÃO DE SENHA (Esqueci minha senha)
    // ===================================================
    
    async sendForgotPasswordToken() {
        const cpf = document.getElementById('forgotCpf').value;
        
        if (!this.validarCPF(cpf)) {
            this.showToast('CPF inválido', 'error');
            return;
        }

        this.showLoading('Enviando token...');
        this.hideMessages();

        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.needsSupport) {
                    this.showToast(data.message, 'info');
                } else {
                    this.showToast(data.message, 'success');
                    // Guardar CPF para próxima etapa
                    sessionStorage.setItem('forgotPasswordCpf', cpf);
                    // Ir para próxima etapa
                    document.getElementById('forgot-step-1').style.display = 'none';
                    document.getElementById('forgot-step-2').style.display = 'block';
                }
            } else {
                this.showToast(data.error || 'Erro ao enviar token', 'error');
            }
        } catch (error) {
            this.showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async verifyForgotPasswordToken() {
        const cpf = sessionStorage.getItem('forgotPasswordCpf');
        const token = document.getElementById('forgotToken').value.trim();
        const newPassword = document.getElementById('forgotNewPassword').value;
        const confirmPassword = document.getElementById('forgotConfirmPassword').value;

        // Validações
        if (!token || token.length !== 6) {
            this.showToast('Por favor, insira o token de 6 dígitos', 'error');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            this.showToast('A senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('As senhas não coincidem', 'error');
            return;
        }

        this.showLoading('Redefinindo senha...');
        this.hideMessages();

        try {
            const response = await fetch('/api/verify-forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast(data.message + ' Você será redirecionado para o login...', 'success');
                sessionStorage.removeItem('forgotPasswordCpf');
                
                // Resetar formulário e voltar para login
                setTimeout(() => {
                    this.resetForgotPasswordForm();
                    document.getElementById('forgotPasswordForm').style.display = 'none';
                    document.getElementById('loginForm').style.display = 'block';
                    document.getElementById('toggleText').textContent = 'Primeiro acesso?';
                    document.getElementById('toggleForm').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Criar conta';
                    
                    // Preencher CPF no login
                    document.getElementById('loginCpf').value = cpf;
                    document.getElementById('loginPassword').focus();
                    this.hideMessages();
                }, 2000);
            } else {
                this.showToast(data.error || 'Erro ao redefinir senha', 'error');
            }
        } catch (error) {
            this.showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.hideLoading();
        }
    },

    cancelForgotPassword() {
        // Resetar formulário e voltar para login
        this.resetForgotPasswordForm();
        document.getElementById('forgotPasswordForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        
        // Ajustar botões de toggle
        document.getElementById('toggleText').textContent = 'Primeiro acesso?';
        document.getElementById('toggleForm').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Criar conta';
        this.isLoginForm = true;
        
        this.hideMessages();
    },

    resetForgotPasswordForm() {
        document.getElementById('forgot-step-1').style.display = 'block';
        document.getElementById('forgot-step-2').style.display = 'none';
        document.getElementById('forgotCpf').value = '';
        document.getElementById('forgotToken').value = '';
        document.getElementById('forgotNewPassword').value = '';
        document.getElementById('forgotConfirmPassword').value = '';
        sessionStorage.removeItem('forgotPasswordCpf');
    }
};

document.addEventListener('DOMContentLoaded', () => LoginHandler.init());
