// External Users Tab Module
const ExternalUsers = {
    users: [],
    currentEditId: null,
    initialized: false,
    currentFilter: 'all', // 'active', 'inactive', 'all'

    async load() {
        await this.loadUsers();
        // Configurar event listeners após carregar os dados
        if (!this.initialized) {
            this.setupEventListeners();
            this.initialized = true;
        } else {
            // Reconfigurar listeners se já foi inicializado (para garantir que funcionem após re-renderização)
            this.setupEventListeners();
        }
    },

    setupEventListeners() {
        // Botão de adicionar - configurar diretamente no botão (apenas uma vez)
        const addBtn = document.getElementById('external-users-add-btn');
        if (addBtn && !addBtn.dataset.listenerAdded) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openCreateModal();
            };
            addBtn.addEventListener('click', handler);
            addBtn.dataset.listenerAdded = 'true';
            addBtn.dataset.handler = 'addBtnHandler';
        }
        
        // Botões da tabela - usar event delegation no tbody (apenas uma vez)
        const tbody = document.getElementById('external-users-table-body');
        if (tbody && !tbody.dataset.listenerAdded) {
            const handler = (e) => {
                const btn = e.target.closest('[data-action]');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const userId = parseInt(btn.dataset.userId);
                    
                    if (action === 'edit-user' && userId) {
                        this.openEditModal(userId);
                    } else if (action === 'delete-user' && userId) {
                        this.openDeleteModal(userId);
                    } else if (action === 'activate-user' && userId) {
                        this.openActivateModal(userId);
                    }
                }
            };
            tbody.addEventListener('click', handler);
            tbody.dataset.listenerAdded = 'true';
        }
        
        // Também usar event delegation no container como fallback (apenas uma vez)
        const externalUsersContent = document.getElementById('external-users-content');
        if (externalUsersContent && !externalUsersContent.dataset.listenerAdded) {
            const handler = (e) => {
                // Botão adicionar (fallback)
                if (e.target.closest('#external-users-add-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openCreateModal();
                    return;
                }
                
                // Botões da tabela (fallback)
                const btn = e.target.closest('[data-action]');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const userId = parseInt(btn.dataset.userId);
                    
                    if (action === 'edit-user' && userId) {
                        this.openEditModal(userId);
                    } else if (action === 'delete-user' && userId) {
                        this.openDeleteModal(userId);
                    } else if (action === 'activate-user' && userId) {
                        this.openActivateModal(userId);
                    }
                }
            };
            externalUsersContent.addEventListener('click', handler);
            externalUsersContent.dataset.listenerAdded = 'true';
        }

        // Toggle de senha - configurar para os modais
        this.setupPasswordToggle();
        
        // Máscara de CPF - usar event delegation no modal
        const createModal = document.getElementById('external-users-create-modal');
        if (createModal) {
            createModal.addEventListener('input', (e) => {
                if (e.target.id === 'create-cpf') {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                        value = value.replace(/(\d{3})(\d)/, '$1.$2');
                        value = value.replace(/(\d{3})(\d)/, '$1.$2');
                        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                        e.target.value = value;
                    }
                }
            });
        }

        // Não permitir fechar modais clicando fora

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = ['external-users-create-modal', 'external-users-edit-modal', 'external-users-delete-modal', 'external-users-activate-modal'];
                modals.forEach(modalId => {
                    const modal = document.getElementById(modalId);
                    if (modal && !modal.classList.contains('hidden')) {
                        this.closeModal(modalId);
                    }
                });
            }
        });
    },

    async loadUsers(status = null) {
        try {
            const statusParam = status || this.currentFilter;
            const url = statusParam && statusParam !== 'all' 
                ? `/api/external-users?status=${statusParam}` 
                : '/api/external-users';
            
            const response = await API.get(url);
            this.users = response;
            this.renderUsers();
        } catch (error) {
            console.error('Erro ao carregar usuários externos:', error);
            const errorMsg = error.data?.error || error.message || 'Erro ao carregar usuários externos';
            this.showToast(errorMsg, 'error');
        }
    },

    renderUsers() {
        const tbody = document.getElementById('external-users-table-body');
        if (!tbody) return;

        if (this.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                        Nenhum usuário externo cadastrado
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.users.map(user => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px; color: #1f2937;">${this.escapeHtml(user.cpf)}</td>
                <td style="padding: 12px; color: #1f2937;">${this.escapeHtml(user.email)}</td>
                <td style="padding: 12px; color: #1f2937;">${this.escapeHtml(user.nomeCompleto || '-')}</td>
                <td style="padding: 12px;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; ${user.isActive ? 'background: #d1fae5; color: #065f46;' : 'background: #fee2e2; color: #991b1b;'}">
                        ${user.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td style="padding: 12px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button data-action="edit-user" data-user-id="${user.id}" title="Editar" style="padding: 8px 12px; border: none; background: #f3f4f6; color: #6b7280; cursor: pointer; border-radius: 6px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151';" onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280';">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        ${user.isActive ? `
                        <button data-action="delete-user" data-user-id="${user.id}" title="Desativar" style="padding: 8px 12px; border: none; background: #fee2e2; color: #991b1b; cursor: pointer; border-radius: 6px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#fecaca'; this.style.color='#7f1d1d';" onmouseout="this.style.background='#fee2e2'; this.style.color='#991b1b';">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        ` : `
                        <button data-action="activate-user" data-user-id="${user.id}" title="Reativar" style="padding: 8px 12px; border: none; background: #d1fae5; color: #065f46; cursor: pointer; border-radius: 6px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#a7f3d0'; this.style.color='#064e3b';" onmouseout="this.style.background='#d1fae5'; this.style.color='#065f46';">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </button>
                        `}
                    </div>
                </td>
            </tr>
        `).join('');
    },

    openCreateModal() {
        const modal = document.getElementById('external-users-create-modal');
        if (!modal) {
            console.error('Modal external-users-create-modal não encontrado');
            return;
        }

        // Limpar formulário
        const cpfInput = document.getElementById('create-cpf');
        const nomeInput = document.getElementById('create-nome');
        const emailInput = document.getElementById('create-email');
        const senhaInput = document.getElementById('create-senha');
        const isActiveInput = document.getElementById('create-is-active');
        
        if (cpfInput) cpfInput.value = '';
        if (nomeInput) nomeInput.value = '';
        if (emailInput) emailInput.value = '';
        if (senhaInput) senhaInput.value = '';
        if (isActiveInput) isActiveInput.checked = true;

        // Limpar erros
        this.clearErrors('create');

        modal.classList.remove('hidden');
    },

    openEditModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.currentEditId = userId;
        const modal = document.getElementById('external-users-edit-modal');
        if (!modal) return;

        // Preencher formulário
        document.getElementById('edit-nome').value = user.nomeCompleto || '';
        document.getElementById('edit-email').value = user.email || '';
        document.getElementById('edit-senha').value = '';

        // Limpar erros
        this.clearErrors('edit');

        modal.classList.remove('hidden');
    },

    openDeleteModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.currentEditId = userId;
        const modal = document.getElementById('external-users-delete-modal');
        if (!modal) return;

        const deleteMessage = document.getElementById('delete-message');
        if (deleteMessage) {
            deleteMessage.textContent = `Tem certeza que deseja desativar o usuário externo com CPF ${user.cpf}?`;
        }

        modal.classList.remove('hidden');
    },

    openActivateModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.currentEditId = userId;
        const modal = document.getElementById('external-users-activate-modal');
        if (!modal) return;

        const activateMessage = document.getElementById('activate-message');
        if (activateMessage) {
            activateMessage.textContent = `Deseja reativar o usuário externo com CPF ${user.cpf}?`;
        }

        modal.classList.remove('hidden');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    clearErrors(formType) {
        const prefix = formType === 'create' ? 'create' : 'edit';
        const fields = ['cpf', 'nome', 'email', 'senha'];
        fields.forEach(field => {
            const errorEl = document.getElementById(`${prefix}-${field}-error`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        });
    },

    showError(field, message, formType) {
        const prefix = formType === 'create' ? 'create' : 'edit';
        const errorEl = document.getElementById(`${prefix}-${field}-error`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    },

    async handleCreate() {
        const cpf = document.getElementById('create-cpf').value.trim();
        const nome = document.getElementById('create-nome').value.trim();
        const email = document.getElementById('create-email').value.trim();
        const senha = document.getElementById('create-senha').value;
        const isActive = document.getElementById('create-is-active').checked;

        // Limpar erros
        this.clearErrors('create');

        // Validações
        let hasError = false;

        if (!cpf) {
            this.showError('cpf', 'CPF é obrigatório', 'create');
            hasError = true;
        }

        if (!nome) {
            this.showError('nome', 'Nome completo é obrigatório', 'create');
            hasError = true;
        } else if (nome.length < 3) {
            this.showError('nome', 'Nome deve ter no mínimo 3 caracteres', 'create');
            hasError = true;
        }

        if (!email) {
            this.showError('email', 'Email é obrigatório', 'create');
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showError('email', 'Email inválido', 'create');
            hasError = true;
        }

        if (!senha) {
            this.showError('senha', 'Senha é obrigatória', 'create');
            hasError = true;
        } else if (senha.length < 6) {
            this.showError('senha', 'A senha deve ter no mínimo 6 caracteres', 'create');
            hasError = true;
        }

        if (hasError) return;

        const btn = document.getElementById('create-submit-btn');
        this.setButtonLoading(btn, true, 'Cadastrando...');

        try {
            const response = await API.post('/api/external-users', {
                cpf,
                nomeCompleto: nome,
                email,
                senha,
                isActive,
                RoleId: 2
            });

            this.showToast(response.message || 'Usuário externo cadastrado com sucesso', 'success');
            this.closeModal('external-users-create-modal');
            await this.loadUsers(this.currentFilter);
        } catch (error) {
            const errorMsg = error.data?.error || error.message || 'Erro ao cadastrar usuário externo';
            this.showToast(errorMsg, 'error');
            
            // Mostrar erros específicos
            if (errorMsg.includes('CPF')) {
                this.showError('cpf', errorMsg, 'create');
            } else if (errorMsg.includes('nome') || errorMsg.includes('Nome')) {
                this.showError('nome', errorMsg, 'create');
            } else if (errorMsg.includes('Email')) {
                this.showError('email', errorMsg, 'create');
            } else if (errorMsg.includes('senha')) {
                this.showError('senha', errorMsg, 'create');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    },

    async handleEdit() {
        const nome = document.getElementById('edit-nome').value.trim();
        const email = document.getElementById('edit-email').value.trim();
        const senha = document.getElementById('edit-senha').value;

        // Limpar erros
        this.clearErrors('edit');

        // Validações
        let hasError = false;

        if (!nome) {
            this.showError('nome', 'Nome completo é obrigatório', 'edit');
            hasError = true;
        } else if (nome.length < 3) {
            this.showError('nome', 'Nome deve ter no mínimo 3 caracteres', 'edit');
            hasError = true;
        }

        if (!email) {
            this.showError('email', 'Email é obrigatório', 'edit');
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showError('email', 'Email inválido', 'edit');
            hasError = true;
        }

        if (senha && senha.length < 6) {
            this.showError('senha', 'A senha deve ter no mínimo 6 caracteres', 'edit');
            hasError = true;
        }

        if (hasError) return;

        const btn = document.getElementById('edit-submit-btn');
        this.setButtonLoading(btn, true, 'Salvando...');

        try {
            const data = { 
                nomeCompleto: nome,
                email 
            };
            if (senha) {
                data.senha = senha;
            }

            const response = await API.put(`/api/external-users/${this.currentEditId}`, data);

            this.showToast(response.message || 'Usuário externo atualizado com sucesso', 'success');
            this.closeModal('external-users-edit-modal');
            await this.loadUsers(this.currentFilter);
        } catch (error) {
            const errorMsg = error.data?.error || error.message || 'Erro ao atualizar usuário externo';
            this.showToast(errorMsg, 'error');
            
            if (errorMsg.includes('nome') || errorMsg.includes('Nome')) {
                this.showError('nome', errorMsg, 'edit');
            } else if (errorMsg.includes('Email')) {
                this.showError('email', errorMsg, 'edit');
            } else if (errorMsg.includes('senha')) {
                this.showError('senha', errorMsg, 'edit');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    },

    async handleDelete() {
        const btn = document.getElementById('delete-confirm-btn');
        this.setButtonLoading(btn, true, 'Desativando...');

        try {
            const response = await API.delete(`/api/external-users/${this.currentEditId}`);

            this.showToast(response.message || 'Usuário externo desativado com sucesso', 'success');
            this.closeModal('external-users-delete-modal');
            await this.loadUsers(this.currentFilter);
        } catch (error) {
            const errorMsg = error.data?.error || error.message || 'Erro ao desativar usuário externo';
            this.showToast(errorMsg, 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    },

    async handleActivate() {
        const btn = document.getElementById('activate-confirm-btn');
        this.setButtonLoading(btn, true, 'Reativando...');

        try {
            const response = await API.post(`/api/external-users/${this.currentEditId}/activate`);

            this.showToast(response.message || 'Usuário externo reativado com sucesso', 'success');
            this.closeModal('external-users-activate-modal');
            await this.loadUsers(this.currentFilter);
        } catch (error) {
            const errorMsg = error.data?.error || error.message || 'Erro ao reativar usuário externo';
            this.showToast(errorMsg, 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    },

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Atualizar botões de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const btnFilter = btn.dataset.filter;
            if (btnFilter === filter) {
                if (filter === 'active') {
                    btn.style.background = '#d1fae5';
                    btn.style.color = '#065f46';
                } else if (filter === 'inactive') {
                    btn.style.background = '#fee2e2';
                    btn.style.color = '#991b1b';
                } else {
                    btn.style.background = '#dbeafe';
                    btn.style.color = '#1e40af';
                }
                btn.classList.add('active');
            } else {
                btn.style.background = '#f3f4f6';
                btn.style.color = '#6b7280';
                btn.classList.remove('active');
            }
        });
        
        // Recarregar usuários com o filtro selecionado
        this.loadUsers(filter);
    },

    setButtonLoading(btn, isLoading, loadingText) {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = loadingText || 'Processando...';
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || btn.textContent;
        }
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
            <div class="config-toast-message">${this.escapeHtml(message)}</div>
        `;
        
        toast.querySelector('.config-toast-close').addEventListener('click', () => toast.remove());
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    setupPasswordToggle() {
        // Usar event delegation para funcionar mesmo quando os modais são carregados dinamicamente
        // Verificar se o listener já foi adicionado
        if (document.body.dataset.passwordToggleListener === 'true') {
            return;
        }
        
        document.addEventListener('click', (e) => {
            const toggleButton = e.target.closest('.password-toggle');
            if (toggleButton) {
                e.preventDefault();
                e.stopPropagation();
                
                const inputId = toggleButton.getAttribute('data-target');
                const input = document.getElementById(inputId);
                const iconId = inputId + 'Icon';
                const icon = document.getElementById(iconId);
                
                if (input && icon) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
                    } else {
                        input.type = 'password';
                        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
                    }
                }
            }
        });
        
        document.body.dataset.passwordToggleListener = 'true';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Tornar disponível globalmente para onclick handlers
window.ExternalUsers = ExternalUsers;

