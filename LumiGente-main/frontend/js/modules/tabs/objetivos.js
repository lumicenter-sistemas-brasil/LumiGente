// Objetivos Tab Module
const Objetivos = {
    state: {
        currentObjetivo: null,
        selectedResponsaveis: [],
        modalMode: 'create',
        currentObjetivoId: null,
        isSubmitting: false,
        rejectModal: null,
        pendingDeleteId: null
    },
    setSubmitButtonLoading(isLoading, text) {
        const submitBtn = document.getElementById('objetivo-submit-btn');
        if (!submitBtn) return;

        if (isLoading) {
            if (!submitBtn.dataset.originalHtml) {
                submitBtn.dataset.originalHtml = submitBtn.innerHTML;
            }
            submitBtn.classList.add('is-loading');
            submitBtn.disabled = true;
            if (text) {
                submitBtn.innerHTML = text;
            }
        } else {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
            if (submitBtn.dataset.originalHtml) {
                submitBtn.innerHTML = submitBtn.dataset.originalHtml;
                delete submitBtn.dataset.originalHtml;
            }
        }
    },

    async load() {
        await this.loadList();
    },

    async loadList() {
        // Debounce quando chamado a partir dos inputs de busca e filtro de status
        const evt = typeof window !== 'undefined' ? window.event : null;
        if (
            evt &&
            ((evt.type === 'input' && evt.target && (evt.target.id === 'objetivos-search' || evt.target.id === 'objetivos-responsavel-search')) ||
                (evt.type === 'change' && evt.target && evt.target.id === 'objetivos-status-filter'))
        ) {
            clearTimeout(this._searchDebounce);
            return await new Promise(resolve => {
                this._searchDebounce = setTimeout(async () => {
                    await this.loadList();
                    resolve();
                }, 300);
            });
        }
        try {
            const container = document.getElementById('objetivos-list');
            if (!container) return;

            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando objetivos...</div>';

            const searchTerms = {};
            const objetivosSearch = document.getElementById('objetivos-search');
            if (objetivosSearch?.value.trim()) searchTerms.search = objetivosSearch.value.trim();

            const responsavelSearch = document.getElementById('objetivos-responsavel-search');
            if (responsavelSearch?.value.trim()) searchTerms.responsavel = responsavelSearch.value.trim();

            const statusFilter = document.getElementById('objetivos-status-filter');
            if (statusFilter?.value.trim()) searchTerms.status = statusFilter.value.trim();

            const objetivos = await API.get('/api/objetivos', searchTerms);
            // Filtros adicionais no cliente, insensíveis a acentos
            let lista = objetivos;
            if (objetivosSearch?.value.trim()) {
                const termTitulo = this.normalizeText(objetivosSearch.value.trim());
                lista = lista.filter(o => this.normalizeText(o.titulo || '').includes(termTitulo));
            }
            if (responsavelSearch?.value.trim()) {
                const termResp = this.normalizeText(responsavelSearch.value.trim());
                lista = lista.filter(o => {
                    const nomes = [];
                    if (o.responsavel_nome) nomes.push(o.responsavel_nome);
                    if (Array.isArray(o.shared_responsaveis)) {
                        o.shared_responsaveis.forEach(r => {
                            const nome = r.NomeCompleto || r.nome_responsavel || r.nome || r.user_name;
                            if (nome) nomes.push(nome);
                        });
                    }
                    return nomes.some(n => this.normalizeText(n).includes(termResp));
                });
            }
            if (statusFilter?.value.trim()) {
                const termStatus = this.normalizeText(statusFilter.value.trim());
                lista = lista.filter(o => this.normalizeText(o.status || '') === termStatus);
            }
            this.updateList(lista);
        } catch (error) {
            console.error('Erro ao carregar objetivos:', error);
        }
    },

    switchTab(tab) {
        const tabs = document.querySelectorAll('.objetivos-tab');
        tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.objetivos-tab[data-objetivos-tab="${tab}"]`);
        if (activeTab) activeTab.classList.add('active');

        const meusPanel = document.getElementById('objetivos-meus-panel');
        const pdisPanel = document.getElementById('objetivos-pdis-panel');

        if (tab === 'meus') {
            if (meusPanel) {
                meusPanel.classList.remove('hidden');
                meusPanel.style.display = 'block';
            }
            if (pdisPanel) {
                pdisPanel.classList.add('hidden');
                pdisPanel.style.display = 'none';
            }
            this.loadList();
        } else if (tab === 'pdis') {
            if (meusPanel) {
                meusPanel.classList.add('hidden');
                meusPanel.style.display = 'none';
            }
            if (pdisPanel) {
                pdisPanel.classList.remove('hidden');
                pdisPanel.style.display = 'block';
            }
            this.loadPDIs();
        }
    },

    async loadPDIs() {
        // Debounce quando chamado a partir dos inputs de busca e filtro de status
        const evt = typeof window !== 'undefined' ? window.event : null;
        if (
            evt &&
            ((evt.type === 'input' && evt.target && evt.target.id === 'pdis-search') ||
                (evt.type === 'change' && evt.target && evt.target.id === 'pdis-status-filter'))
        ) {
            clearTimeout(this._pdisSearchDebounce);
            return await new Promise(resolve => {
                this._pdisSearchDebounce = setTimeout(async () => {
                    await this.loadPDIs();
                    resolve();
                }, 300);
            });
        }

        const container = document.getElementById('objetivos-pdis-list');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando PDIs...</div>';

        try {
            const pdis = await API.get('/api/objetivos/pdis/meus');
            
            // Aplicar filtros no cliente, insensíveis a acentos
            const pdisSearch = document.getElementById('pdis-search');
            const statusFilter = document.getElementById('pdis-status-filter');
            
            let lista = pdis;
            
            if (pdisSearch?.value.trim()) {
                const searchTerm = this.normalizeText(pdisSearch.value.trim().toLowerCase());
                lista = lista.filter(pdi => {
                    const titulo = this.normalizeText((pdi.Titulo || '').toLowerCase());
                    const feedback = this.normalizeText((pdi.FeedbackGestor || pdi.Feedback || '').toLowerCase());
                    const colaborador = this.normalizeText((pdi.ColaboradorNome || '').toLowerCase());
                    return titulo.includes(searchTerm) || feedback.includes(searchTerm) || colaborador.includes(searchTerm);
                });
            }

            if (statusFilter?.value.trim()) {
                lista = lista.filter(pdi => pdi.Status === statusFilter.value.trim());
            }

            this.updatePDIsList(lista);
        } catch (error) {
            console.error('Erro ao carregar PDIs:', error);
            container.innerHTML = `
                <div class="historico-empty" style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
                    <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ef4444; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px;">Erro ao carregar PDIs</h4>
                    <p style="color: #6b7280;">Não foi possível carregar os Planos de Desenvolvimento Individual.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    },

    updatePDIsList(pdis) {
        const container = document.getElementById('objetivos-pdis-list');
        if (!container) return;

        if (!pdis || pdis.length === 0) {
            container.innerHTML = `
                <div class="historico-empty" style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
                    <i data-lucide="graduation-cap" style="width: 48px; height: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nenhum PDI encontrado</h4>
                    <p style="color: #6b7280;">Você ainda não possui Planos de Desenvolvimento Individual.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = pdis.map(pdi => {
            const currentUser = State.getUser();
            const currentUserId = currentUser && (currentUser.userId || currentUser.Id);
            const progresso = pdi.Progresso || 0;
            const dataInicio = pdi.DataInicio ? this.formatPDIDate(pdi.DataInicio) : '';
            const prazoConclusao = pdi.PrazoConclusao || pdi.PrazoRevisao;
            const dataFim = prazoConclusao ? this.formatPDIDate(prazoConclusao) : '';
            const isOverdue = prazoConclusao && new Date(prazoConclusao + 'T00:00:00') < new Date() && pdi.Status === 'Ativo';

            const statusConfig = {
                'Ativo': { color: '#10b981', icon: 'play-circle' },
                'Aguardando Validação': { color: '#f59e0b', icon: 'clock' },
                'Concluído': { color: '#059669', icon: 'check-circle' },
                'Expirado': { color: '#ef4444', icon: 'x-circle' }
            };
            const { color, icon } = statusConfig[pdi.Status] || { color: '#6b7280', icon: 'circle' };

            // Verificar se o usuário é gestor direto do PDI
            const isGestorDireto = currentUserId && pdi.GestorId && Number(currentUserId) === Number(pdi.GestorId);
            const canApprovePDI = isGestorDireto && pdi.Status === 'Aguardando Validação';
            const isColaboradorPDI = currentUserId && pdi.UserId && Number(currentUserId) === Number(pdi.UserId);

            return `
                <div class="objetivo-item" data-pdi-id="${pdi.Id}" style="border-left-color: ${color};">
                    <div class="objetivo-header">
                        <div class="objetivo-info">
                            <h4>${pdi.Titulo || 'PDI'}</h4>
                            <p style="color: #6b7280; margin: 8px 0;">${pdi.FeedbackGestor || pdi.Feedback || 'Sem feedback'}</p>
                            <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">
                                <span>Colaborador: ${pdi.ColaboradorNome || 'N/A'}</span>
                                ${dataInicio ? `<span style="margin-left: 16px;">Início: ${dataInicio}</span>` : ''}
                                ${dataFim ? `<span style="margin-left: 16px;">Prazo: ${dataFim}</span>` : ''}
                                ${isOverdue ? '<span style="margin-left: 16px; color: #ef4444; display: inline-flex; align-items: center; gap: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Atrasado</span>' : ''}
                            </div>
                        </div>
                        <div class="objetivo-badges">
                            <span class="badge" style="background-color: ${color}; color: white;">
                                <i data-lucide="${icon}" style="width: 14px; height: 14px; margin-right: 4px;"></i> ${pdi.Status}
                            </span>
                        </div>
                    </div>
                    <div class="objetivo-progresso">
                        <div class="progresso-bar">
                            <div class="progresso-fill" style="width: ${progresso}%"></div>
                        </div>
                        <div class="progresso-text">
                            <span>Progresso:</span>
                            <span>${progresso}%</span>
                        </div>
                    </div>
                    <div class="objetivo-actions">
                        ${pdi.Status === 'Ativo' && isColaboradorPDI ? `
                            <button class="btn btn-secondary btn-sm" onclick="PDIs.checkin(${pdi.Id})">
                                <i data-lucide="check-circle" style="width: 16px; height: 16px; margin-right: 6px;"></i> Check-in
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="PDIs.viewDetails(${pdi.Id})">
                            <i data-lucide="eye" style="width: 16px; height: 16px; margin-right: 6px;"></i> Ver Detalhes
                        </button>
                        ${canApprovePDI ? `
                            <button class="btn btn-success btn-sm" onclick="PDIs.openApprovalModal(${pdi.Id})">
                                <i data-lucide="check" style="width: 16px; height: 16px; margin-right: 6px;"></i> Aprovar
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="PDIs.openRejectionModal(${pdi.Id})">
                                <i data-lucide="x-circle" style="width: 16px; height: 16px; margin-right: 6px;"></i> Rejeitar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    },

    formatPDIDate(dateString) {
        if (!dateString) return '';
        try {
            // Se já é um objeto Date, converter para string primeiro
            let dateValue = dateString;
            if (dateString instanceof Date) {
                dateValue = dateString.toISOString();
            } else if (typeof dateString !== 'string') {
                dateValue = String(dateString);
            }
            
            // Extrair a parte da data (antes do T se houver)
            const dateStr = dateValue.split('T')[0];
            if (!dateStr) return '';
            
            // Dividir em ano, mês, dia para evitar problemas de fuso horário
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const [ano, mes, dia] = parts;
                // Criar Date usando componentes locais (não UTC)
                const date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                if (isNaN(date.getTime())) return '';
                return date.toLocaleDateString('pt-BR');
            }
            
            // Fallback: tentar criar Date diretamente
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleDateString('pt-BR');
        } catch (error) {
            return '';
        }
    },

    normalizeText(texto) {
        if (!texto) return '';
        try {
            return texto
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        } catch {
            return String(texto).toLowerCase();
        }
    },

    updateList(objetivos) {
        const container = document.getElementById('objetivos-list');
        if (!container) return;

        if (objetivos.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum objetivo encontrado.</div>';
            return;
        }

        container.innerHTML = objetivos.map((objetivo, index) => {
            const currentUser = State.getUser();
            const currentUserId = currentUser && currentUser.userId;
            const progresso = objetivo.progresso || 0;
            const dataInicio = objetivo.data_inicio ? this.formatDate(objetivo.data_inicio) : '';
            const dataFim = objetivo.data_fim ? this.formatDate(objetivo.data_fim) : '';
            const isOverdue = objetivo.data_fim && new Date(objetivo.data_fim + 'T00:00:00') < new Date() && objetivo.status === 'Ativo';

            let responsaveisLista = [];
            if (objetivo.responsavel_nome) responsaveisLista.push(objetivo.responsavel_nome.trim());
            if (objetivo.shared_responsaveis?.length > 0) {
                objetivo.shared_responsaveis.forEach(resp => {
                    if (resp.nome_responsavel && !responsaveisLista.includes(resp.nome_responsavel.trim())) {
                        responsaveisLista.push(resp.nome_responsavel.trim());
                    }
                });
            }
            const responsaveisTexto = responsaveisLista.length > 0 ? responsaveisLista.join(', ') : 'Nenhum responsável';

            const descricao = objetivo.descricao || 'Sem descrição';
            const descricaoHtml = this.formatDescricao(descricao, `objetivo-${index}`);

            const statusConfig = {
                'Ativo': { color: '#10b981', icon: 'fas fa-play-circle' },
                'Agendado': { color: '#3b82f6', icon: 'fas fa-calendar-alt' },
                'Concluído': { color: '#059669', icon: 'fas fa-check-circle' },
                'Aguardando Aprovação': { color: '#f59e0b', icon: 'fas fa-clock' },
                'Expirado': { color: '#ef4444', icon: 'fas fa-times-circle' }
            };
            const { color, icon } = statusConfig[objetivo.status] || { color: '#6b7280', icon: 'fas fa-circle' };

            // Determina se o usuário atual é responsável pelo objetivo
            const primaryRespId = objetivo.responsavel_id || objetivo.responsavelId || objetivo.owner_id;
            const createdBy = objetivo.criado_por || objetivo.criadoPor || objetivo.created_by || objetivo.createdBy;
            const sharedList = Array.isArray(objetivo.shared_responsaveis) ? objetivo.shared_responsaveis : [];
            const isInShared = sharedList.some(r => {
                const rid = r.Id || r.user_id || r.responsavel_id;
                return rid === currentUserId;
            });
            const isUserResponsavel = currentUserId && (primaryRespId === currentUserId || isInShared);
            const isCriador = currentUserId && createdBy && Number(createdBy) === Number(currentUserId);
            const canApproveCompletion = isCriador && objetivo.status === 'Aguardando Aprovação';

            return `
                <div class="objetivo-item" data-objetivo-id="${objetivo.Id}" style="border-left-color: ${color};">
                    <div class="objetivo-header">
                        <div class="objetivo-info">
                            <h4>${objetivo.titulo}</h4>
                            ${descricaoHtml}
                            <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">
                                <span>Responsáveis: ${responsaveisTexto}</span>
                                <span style="margin-left: 16px;">Início: ${dataInicio}</span>
                                <span style="margin-left: 16px;">Prazo: ${dataFim}</span>
                                ${isOverdue ? '<span style="margin-left: 16px; color: #ef4444; display: inline-flex; align-items: center; gap: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Atrasado</span>' : ''}
                            </div>
                        </div>
                        <div class="objetivo-badges">
                            <span class="badge" style="background-color: ${color}; color: white;">
                                <i class="${icon}"></i> ${objetivo.status}
                            </span>
                        </div>
                    </div>
                    <div class="objetivo-progresso">
                        <div class="progresso-bar">
                            <div class="progresso-fill" style="width: ${progresso}%"></div>
                        </div>
                        <div class="progresso-text">
                            <span>Progresso:</span>
                            <span>${progresso}%</span>
                        </div>
                    </div>
                    <div class="objetivo-actions">
                        ${objetivo.status === 'Ativo' && isUserResponsavel ? `
                            <button class="btn btn-secondary btn-sm" onclick="Objetivos.checkin(${objetivo.Id})">
                                <i data-lucide="check-circle" style="width: 14px; height: 14px; margin-right: 4px;"></i> Check-in
                            </button>
                        ` : ''}
                        ${objetivo.status === 'Ativo' && progresso >= 100 ? `
                            <button class="btn btn-success btn-sm" onclick="Objetivos.complete(${objetivo.Id})">
                                <i data-lucide="flag" style="width: 14px; height: 14px; margin-right: 4px;"></i> Concluir
                            </button>
                        ` : ''}
                        ${canApproveCompletion ? `
                            <button class="btn btn-success btn-sm" onclick="Objetivos.approve(${objetivo.Id})">
                                <i data-lucide="check" style="width: 14px; height: 14px; margin-right: 4px;"></i> Aprovar Conclusão
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="Objetivos.openRejectionModal(${objetivo.Id})">
                                <i data-lucide="x-circle" style="width: 14px; height: 14px; margin-right: 4px;"></i> Rejeitar
                            </button>
                        ` : ''}
                        ${(objetivo.status === 'Ativo' || objetivo.status === 'Agendado') && isCriador ? `
                            <button class="btn btn-amber btn-sm" onclick="Objetivos.edit(${objetivo.Id})">
                                <i data-lucide="pencil" style="width: 14px; height: 14px; margin-right: 4px;"></i> Editar
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="Objetivos.viewDetails(${objetivo.Id})">
                            <i data-lucide="eye" style="width: 14px; height: 14px; margin-right: 4px;"></i> Ver Detalhes
                        </button>
                        ${objetivo.status !== 'Concluído' ? `
                            <button class="btn btn-danger btn-sm" onclick="Objetivos.delete(${objetivo.Id})">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px; margin-right: 4px;"></i> Excluir
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Inicializar ícones Lucide após renderizar
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const [ano, mes, dia] = dateString.split('T')[0].split('-');
            return `${dia}/${mes}/${ano}`;
        } catch {
            return 'Data inválida';
        }
    },

    formatDescricao(descricao, id) {
        if (!descricao || descricao === 'Sem descrição') {
            return '<p class="objetivo-descricao">Sem descrição</p>';
        }

        const formattedText = descricao.replace(/\n/g, '<br>');
        const maxLength = 150;

        if (descricao.length <= maxLength) {
            return `<p class="objetivo-descricao">${formattedText}</p>`;
        }

        const shortText = descricao.substring(0, maxLength).replace(/\n/g, '<br>');

        return `
            <div>
                <p id="desc-short-${id}" class="objetivo-descricao">${shortText}...</p>
                <p id="desc-full-${id}" class="objetivo-descricao" style="display: none;">${formattedText}</p>
                <button onclick="Objetivos.toggleDescricao('${id}')" class="objetivo-toggle">
                    <span id="toggle-${id}">Ler mais</span>
                </button>
            </div>
        `;
    },

    toggleDescricao(id) {
        const shortEl = document.getElementById(`desc-short-${id}`);
        const fullEl = document.getElementById(`desc-full-${id}`);
        const toggleEl = document.getElementById(`toggle-${id}`);

        if (shortEl && fullEl && toggleEl) {
            if (shortEl.style.display === 'none') {
                shortEl.style.display = 'block';
                fullEl.style.display = 'none';
                toggleEl.textContent = 'Ler mais';
            } else {
                shortEl.style.display = 'none';
                fullEl.style.display = 'block';
                toggleEl.textContent = 'Ler menos';
            }
        }
    },

    openModal() {
        this.state.modalMode = 'create';
        this.state.selectedResponsaveis = [];
        this.state.isSubmitting = false;
        this.setSubmitButtonLoading(false);
        const user = State.getUser();
        const isGestor = user && user.hierarchyLevel >= 3;

        if (!isGestor && user) {
            this.state.selectedResponsaveis = [{
                id: user.userId,
                name: `${user.nomeCompleto} - ${user.departamento || 'N/A'}`
            }];
        }

        const responsavelField = document.getElementById('responsavel-field');
        if (responsavelField) {
            responsavelField.style.display = isGestor ? 'block' : 'none';
        }
        Modal.open('objetivo-modal');
        this.populateForm();
        updateSelectedResponsaveisUI();
    },

    closeModal() {
        Modal.close('objetivo-modal');
        this.state.selectedResponsaveis = [];
        this.state.isSubmitting = false;
        this.setSubmitButtonLoading(false);
        updateSelectedResponsaveisUI();
        document.getElementById('objetivo-titulo').value = '';
        document.getElementById('objetivo-descricao').value = '';
        document.getElementById('objetivo-data-inicio').value = '';
        document.getElementById('objetivo-data-fim').value = '';
        document.getElementById('objetivo-titulo').disabled = false;
        document.getElementById('objetivo-descricao').disabled = false;
        document.getElementById('objetivo-data-inicio').disabled = false;
        document.getElementById('objetivo-data-fim').disabled = false;
        document.getElementById('responsavel-field').style.display = 'block';
        document.getElementById('objetivo-data-inicio').parentElement.parentElement.style.display = 'flex';
        document.getElementById('checkin-fields').classList.add('hidden');
        document.getElementById('detalhes-fields').style.display = 'none';
        const titleElement = document.getElementById('objetivo-modal-title');
        if (titleElement) {
            titleElement.innerHTML = `
                <i data-lucide="target" style="width: 20px; height: 20px; margin-right: 8px; color: #0d556d;"></i> Novo Objetivo
            `;
            if (window.lucide) lucide.createIcons();
        }
        const submitBtn = document.getElementById('objetivo-submit-btn');
        if (submitBtn) {
            submitBtn.innerHTML = `
                <i data-lucide="target" style="width: 18px; height: 18px; margin-right: 4px; color: #0d556d;"></i> Criar Objetivo
            `;
            if (window.lucide) lucide.createIcons();
        }
        document.getElementById('objetivo-submit-btn').style.display = 'block';
        this.closeRejectionModal();
    },

    async submit() {
        const mode = this.state.modalMode;

        if (this.state.isSubmitting) {
            return;
        }

        if (mode === 'checkin') {
            this.state.isSubmitting = true;
            this.setSubmitButtonLoading(true, 'Registrando check-in...');
            try {
                await this.submitCheckin();
            } finally {
                this.setSubmitButtonLoading(false);
                this.state.isSubmitting = false;
            }
            return;
        }

        if (mode === 'edit') {
            this.state.isSubmitting = true;
            this.setSubmitButtonLoading(true, 'Salvando alterações...');
            try {
                await this.submitEdit();
            } finally {
                this.setSubmitButtonLoading(false);
                this.state.isSubmitting = false;
            }
            return;
        }

        const titulo = document.getElementById('objetivo-titulo')?.value?.trim();
        const descricao = document.getElementById('objetivo-descricao')?.value?.trim();
        const data_inicio = document.getElementById('objetivo-data-inicio')?.value;
        const data_fim = document.getElementById('objetivo-data-fim')?.value;
        const user = State.getUser();
        const isGestor = user && user.hierarchyLevel >= 3;
        const selectedRespIds = this.state.selectedResponsaveis.map(r => r.id);

        if (!titulo || !descricao || !data_inicio || !data_fim || (isGestor && selectedRespIds.length === 0)) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Preencha todos os campos obrigatórios', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Preencha todos os campos obrigatórios');
            } else {
                alert('Preencha todos os campos obrigatórios');
            }
            return;
        }

        if (new Date(data_fim) <= new Date(data_inicio)) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('A data de fim deve ser posterior à data de início', 'error');
            } else {
                Notifications.error('A data de fim deve ser posterior à data de início');
            }
            return;
        }

        this.state.isSubmitting = true;
        this.setSubmitButtonLoading(true, 'Criando objetivo...');

        try {
            const responsaveisIds = isGestor ? selectedRespIds : [user.userId];
            await API.post('/api/objetivos', { titulo, descricao, responsaveis_ids: responsaveisIds, data_inicio, data_fim });
            this.closeModal();
            await this.loadList();
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Objetivo criado com sucesso!', 'success');
            } else if (window.Notifications && typeof Notifications.success === 'function') {
                Notifications.success('Objetivo criado com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao criar objetivo:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao criar objetivo', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Erro ao criar objetivo');
            } else {
                alert('Erro ao criar objetivo');
            }
        } finally {
            this.setSubmitButtonLoading(false);
            this.state.isSubmitting = false;
        }
    },

    async submitCheckin() {
        const progresso = parseInt(document.getElementById('checkin-progresso').value, 10);
        const observacoesInput = document.getElementById('checkin-observacoes');
        let observacoes = observacoesInput ? observacoesInput.value || '' : '';
        observacoes = observacoes.trim();
        if (observacoes.length > 250) {
            observacoes = observacoes.slice(0, 250);
            if (observacoesInput) {
                observacoesInput.value = observacoes;
            }
        }

        if (!observacoes) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Preencha a descrição do check-in', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Preencha a descrição do check-in');
            } else {
                alert('Preencha a descrição do check-in');
            }
            return;
        }

        if (progresso < 0 || progresso > 100) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Progresso deve ser entre 0 e 100', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Progresso deve ser entre 0 e 100');
            } else {
                alert('Progresso deve ser entre 0 e 100');
            }
            return;
        }

        try {
            const result = await API.post(`/api/objetivos/${this.state.currentObjetivoId}/checkin`, { progresso, observacoes });
            this.closeModal();
            await this.loadList();
            if (result.pointsEarned) {
                Notifications.points(result.pointsEarned, 'fazer check-in');
                await Dashboard.loadGamification();
            }
            const successMessage = result && result.needsApproval
                ? 'Check-in registrado e aguardando aprovação do gestor.'
                : 'Check-in registrado com sucesso!';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(successMessage, 'success');
            } else if (window.Notifications && typeof Notifications.success === 'function') {
                Notifications.success(successMessage);
            } else {
                alert(successMessage);
            }
        } catch (error) {
            console.error('Erro ao registrar check-in:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao registrar check-in', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Erro ao registrar check-in');
            } else {
                alert('Erro ao registrar check-in');
            }
        }
    },

    async submitEdit() {
        const titulo = document.getElementById('objetivo-titulo')?.value?.trim();
        const descricao = document.getElementById('objetivo-descricao')?.value?.trim();
        const data_inicio = document.getElementById('objetivo-data-inicio')?.value;
        const data_fim = document.getElementById('objetivo-data-fim')?.value;

        if (!titulo || !descricao || !data_inicio || !data_fim) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Preencha todos os campos obrigatórios', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Preencha todos os campos obrigatórios');
            } else {
                alert('Preencha todos os campos obrigatórios');
            }
            return;
        }

        if (new Date(data_fim) <= new Date(data_inicio)) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('A data de fim deve ser posterior à data de início', 'error');
            } else {
                Notifications.error('A data de fim deve ser posterior à data de início');
            }
            return;
        }

        const user = State.getUser();
        const isGestor = user && user.hierarchyLevel >= 3;

        let responsaveisIds = [];
        if (isGestor) {
            responsaveisIds = Array.from(new Set(this.state.selectedResponsaveis.map(resp => resp.id).filter(id => Number.isInteger(id) && id > 0)));
            if (responsaveisIds.length === 0) {
                if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                    EmailPopup.showToast('Selecione ao menos um responsável.', 'error');
                } else if (window.Notifications && typeof Notifications.error === 'function') {
                    Notifications.error('Selecione ao menos um responsável.');
                } else {
                    alert('Selecione ao menos um responsável.');
                }
                return;
            }
        } else if (user && user.userId) {
            responsaveisIds = [user.userId];
        }

        try {
            await API.put(`/api/objetivos/${this.state.currentObjetivoId}`, { titulo, descricao, data_inicio, data_fim, responsaveis_ids: responsaveisIds });
            this.closeModal();
            await this.loadList();
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Objetivo atualizado com sucesso!', 'success');
            } else if (window.Notifications && typeof Notifications.success === 'function') {
                Notifications.success('Objetivo atualizado com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao atualizar objetivo:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao atualizar objetivo', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Erro ao atualizar objetivo');
            } else {
                alert('Erro ao atualizar objetivo');
            }
        }
    },

    async edit(objetivoId) {
        this.state.modalMode = 'edit';
        this.state.currentObjetivoId = objetivoId;
        this.state.selectedResponsaveis = [];
        this.state.isSubmitting = false;
        this.setSubmitButtonLoading(false);

        try {
            const objetivo = await API.get(`/api/objetivos/${objetivoId}`);
            const user = State.getUser();
            const isGestor = user && user.hierarchyLevel >= 3;
            const responsavelField = document.getElementById('responsavel-field');
            if (responsavelField) {
                responsavelField.style.display = isGestor ? 'block' : 'none';
            }

            if (isGestor) {
                const addResponsavelToState = (id, nome, departamento) => {
                    if (!id || !nome) return;
                    const numericId = Number(id);
                    if (this.state.selectedResponsaveis.some(resp => resp.id === numericId)) return;
                    this.state.selectedResponsaveis.push({
                        id: numericId,
                        name: `${nome} - ${departamento || 'N/A'}`
                    });
                };

                const primaryRespId = objetivo.responsavel_id || objetivo.responsavelId || objetivo.owner_id;
                const primaryRespNome = objetivo.responsavel_nome || objetivo.responsavelNome || objetivo.responsavel || '';
                const primaryRespDept = objetivo.responsavel_descricao_departamento || objetivo.responsavelDescricaoDepartamento || objetivo.responsavel_departamento || objetivo.responsavelDepartamento || objetivo.responsavelDepart || objetivo.responsavel_depto || objetivo.responsavelDepto || objetivo.responsavelDescricao || objetivo.responsavelDepartamentoDescricao || objetivo.responsavel_departamento_descricao || '';
                addResponsavelToState(primaryRespId, primaryRespNome, primaryRespDept);

                if (Array.isArray(objetivo.shared_responsaveis)) {
                    objetivo.shared_responsaveis.forEach(resp => {
                        const respId = resp.Id || resp.user_id || resp.responsavel_id;
                        const respNome = resp.NomeCompleto || resp.nome_responsavel || resp.nome || resp.UserName || '';
                        const respDept = resp.DescricaoDepartamento || resp.descricaoDepartamento || resp.Departamento || resp.departamento || '';
                        addResponsavelToState(respId, respNome, respDept);
                    });
                }
            }

            const titleElement = document.getElementById('objetivo-modal-title');
            if (titleElement) {
                titleElement.innerHTML = `
                    <i data-lucide="pencil" style="width: 20px; height: 20px; margin-right: 8px; color: #0d556d;"></i> Editar Objetivo
                `;
                if (window.lucide) lucide.createIcons();
            }
            const submitBtn = document.getElementById('objetivo-submit-btn');
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <i data-lucide="save" style="width: 18px; height: 18px; margin-right: 4px;"></i> Salvar Alterações
                `;
                submitBtn.style.display = 'block';
                if (window.lucide) lucide.createIcons();
            }
            document.getElementById('objetivo-titulo').value = objetivo.titulo || '';
            document.getElementById('objetivo-titulo').disabled = false;
            document.getElementById('objetivo-descricao').value = objetivo.descricao || '';
            document.getElementById('objetivo-descricao').disabled = false;
            document.getElementById('objetivo-data-inicio').value = objetivo.data_inicio ? objetivo.data_inicio.split('T')[0] : '';
            document.getElementById('objetivo-data-inicio').disabled = false;
            document.getElementById('objetivo-data-fim').value = objetivo.data_fim ? objetivo.data_fim.split('T')[0] : '';
            document.getElementById('objetivo-data-fim').disabled = false;
            // Garantir que campos corretos estejam visíveis para edição
            const dateRow = document.getElementById('objetivo-data-inicio').parentElement?.parentElement;
            if (dateRow) dateRow.style.display = 'flex';
            const checkinFields = document.getElementById('checkin-fields');
            if (checkinFields) checkinFields.classList.add('hidden');
            const detalhesFields = document.getElementById('detalhes-fields');
            if (detalhesFields) detalhesFields.style.display = 'none';

            await this.populateForm();
            updateSelectedResponsaveisUI();
            Modal.open('objetivo-modal');
        } catch (error) {
            console.error('Erro ao carregar objetivo:', error);
            alert('Erro ao carregar objetivo');
        }
    },

    async checkin(objetivoId) {
        this.state.modalMode = 'checkin';
        this.state.currentObjetivoId = objetivoId;
        this.state.isSubmitting = false;
        this.setSubmitButtonLoading(false);

        try {
            const objetivo = await API.get(`/api/objetivos/${objetivoId}`);
            // Verificação de permissão: somente responsáveis podem fazer check-in
            const currentUser = State.getUser();
            const currentUserId = currentUser && currentUser.userId;
            const primaryRespId = objetivo.responsavel_id || objetivo.responsavelId || objetivo.owner_id;
            const sharedList = Array.isArray(objetivo.shared_responsaveis) ? objetivo.shared_responsaveis : [];
            const isInShared = sharedList.some(r => {
                const rid = r.Id || r.user_id || r.responsavel_id;
                return rid === currentUserId;
            });
            const isUserResponsavel = currentUserId && (primaryRespId === currentUserId || isInShared);
            if (!isUserResponsavel) {
                if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                    EmailPopup.showToast('Apenas responsáveis podem fazer check-in neste objetivo', 'error');
                } else if (window.Notifications && typeof Notifications.error === 'function') {
                    Notifications.error('Apenas responsáveis podem fazer check-in neste objetivo');
                } else {
                    alert('Apenas responsáveis podem fazer check-in neste objetivo');
                }
                return;
            }
            const titleElement = document.getElementById('objetivo-modal-title');
            if (titleElement) {
                titleElement.innerHTML = `
                    <i data-lucide="check-circle" style="width: 20px; height: 20px; margin-right: 8px; color: #0d556d;"></i> Check-in do Objetivo
                `;
                if (window.lucide) lucide.createIcons();
            }
            const submitBtn = document.getElementById('objetivo-submit-btn');
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <i data-lucide="check-circle" style="width: 18px; height: 18px; margin-right: 4px;"></i> Registrar Check-in
                `;
                submitBtn.style.display = 'block';
                if (window.lucide) lucide.createIcons();
            }

            document.getElementById('objetivo-titulo').value = objetivo.titulo || '';
            document.getElementById('objetivo-titulo').disabled = true;
            document.getElementById('objetivo-descricao').value = objetivo.descricao || '';
            document.getElementById('objetivo-descricao').disabled = true;

            document.getElementById('responsavel-field').style.display = 'none';
            document.getElementById('objetivo-data-inicio').parentElement.parentElement.style.display = 'none';
            document.getElementById('checkin-fields').classList.remove('hidden');
            document.getElementById('detalhes-fields').style.display = 'none';

            document.getElementById('checkin-progresso').value = objetivo.progresso || 0;
            document.getElementById('checkin-observacoes').value = '';

            Modal.open('objetivo-modal');
        } catch (error) {
            console.error('Erro ao carregar objetivo:', error);
            alert('Erro ao carregar objetivo');
        }
    },

    async viewDetails(objetivoId) {
        this.state.modalMode = 'details';
        this.state.currentObjetivoId = objetivoId;

        try {
            const [objetivo, checkins] = await Promise.all([
                API.get(`/api/objetivos/${objetivoId}`),
                API.get(`/api/objetivos/${objetivoId}/checkins`)
            ]);

            let responsaveisLista = [];
            if (objetivo.responsavel_nome) responsaveisLista.push(objetivo.responsavel_nome.trim());
            if (objetivo.shared_responsaveis?.length > 0) {
                objetivo.shared_responsaveis.forEach(resp => {
                    if (resp.NomeCompleto && !responsaveisLista.includes(resp.NomeCompleto.trim())) {
                        responsaveisLista.push(resp.NomeCompleto.trim());
                    }
                });
            }
            const responsaveisTexto = responsaveisLista.length > 0 ? responsaveisLista.join(', ') : 'Nenhum responsável';

            const titleElement = document.getElementById('objetivo-modal-title');
            if (titleElement) {
                titleElement.innerHTML = `
                    <i data-lucide="eye" style="width: 20px; height: 20px; margin-right: 8px; color: #0d556d;"></i> Detalhes do Objetivo
                `;
                if (window.lucide) lucide.createIcons();
            }
            const submitBtn = document.getElementById('objetivo-submit-btn');
            if (submitBtn) {
                submitBtn.style.display = 'none';
            }

            document.getElementById('objetivo-titulo').value = objetivo.titulo || '';
            document.getElementById('objetivo-titulo').disabled = true;
            document.getElementById('objetivo-descricao').value = objetivo.descricao || '';
            document.getElementById('objetivo-descricao').disabled = true;
            document.getElementById('objetivo-data-inicio').value = objetivo.data_inicio ? objetivo.data_inicio.split('T')[0] : '';
            document.getElementById('objetivo-data-inicio').disabled = true;
            document.getElementById('objetivo-data-fim').value = objetivo.data_fim ? objetivo.data_fim.split('T')[0] : '';
            document.getElementById('objetivo-data-fim').disabled = true;

            document.getElementById('responsavel-field').style.display = 'none';
            document.getElementById('objetivo-data-inicio').parentElement.parentElement.style.display = 'none';
            document.getElementById('checkin-fields').classList.add('hidden');

            const detalhesFieldsDiv = document.getElementById('detalhes-fields');
            detalhesFieldsDiv.style.display = 'block';
            detalhesFieldsDiv.classList.remove('hidden');

            document.getElementById('objetivo-status').value = objetivo.status || 'N/A';
            document.getElementById('objetivo-progresso-atual').value = `${objetivo.progresso || 0}%`;
            document.getElementById('objetivo-criado-por').value = objetivo.criador_nome || 'N/A';

            const detalhesFields = document.getElementById('detalhes-fields');
            let checkinsHtml = `
                <div class="form-group">
                    <label class="form-label">Responsáveis</label>
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb;">
                        ${responsaveisLista.map(r => `<div style="padding: 6px 0; color: #374151; display: flex; align-items: center;"><i data-lucide="user" style="width: 16px; height: 16px; margin-right: 8px; color: #0d556d;"></i>${r}</div>`).join('')}
                    </div>
                </div>
            `;

            if (checkins.length > 0) {
                const historyItems = checkins.map(c => {
                    const eventDate = new Date(c.created_at);
                    eventDate.setHours(eventDate.getHours() + 3);
                    const rawObservacoes = (c.observacoes || '').trim();
                    const isSystemEvent = /^\[SISTEMA\]/i.test(rawObservacoes);
                    const cleanedObservacoes = rawObservacoes.replace(/^\[SISTEMA\]\s*/i, '');
                    const lowerObs = cleanedObservacoes.toLowerCase();
                    const numericProgress = Number(c.progresso) || 0;

                    const theme = {
                        borderColor: '#0d556d',
                        badgeColor: '#0d556d',
                        badgeLabel: 'Check-in',
                        showProgress: true,
                        progressLabel: `Progresso: ${numericProgress}%`
                    };

                    if (isSystemEvent) {
                        theme.showProgress = false;
                        theme.badgeLabel = 'Atualização';
                        theme.borderColor = '#3b82f6';
                        theme.badgeColor = '#3b82f6';

                        if (lowerObs.includes('rejeit')) {
                            theme.badgeLabel = 'Rejeição';
                            theme.borderColor = '#ef4444';
                            theme.badgeColor = '#ef4444';
                            theme.showProgress = true;
                            theme.progressLabel = `Progresso restaurado para ${numericProgress}%`;
                        } else if (lowerObs.includes('aprov')) {
                            theme.badgeLabel = 'Aprovação';
                            theme.borderColor = '#10b981';
                            theme.badgeColor = '#10b981';
                        } else if (lowerObs.includes('aguard') || lowerObs.includes('pendente') || lowerObs.includes('solic')) {
                            theme.badgeLabel = 'Aguardando';
                            theme.borderColor = '#f59e0b';
                            theme.badgeColor = '#f59e0b';
                        }
                    }

                    const shouldTruncate = !isSystemEvent;
                    const displayObservacoes = cleanedObservacoes
                        ? (shouldTruncate && cleanedObservacoes.length > 250
                            ? `${cleanedObservacoes.slice(0, 250)}...`
                            : cleanedObservacoes)
                        : '';

                    const observacoesHtml = displayObservacoes
                        ? `<div style="color: #6b7280; font-size: 14px; white-space: pre-wrap; word-break: break-word;">${displayObservacoes}</div>`
                        : '';

                    const progressHtml = theme.showProgress
                        ? `<div style="color: #059669; font-weight: 600; margin-bottom: 4px;">${theme.progressLabel}</div>`
                        : '';

                    const displayName = isSystemEvent ? 'Sistema' : (c.user_name || 'Sistema');

                    return `
                        <div style="padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid ${theme.borderColor};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <strong style="color: #374151;">${displayName}</strong>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; border: 1px solid ${theme.badgeColor}; color: ${theme.badgeColor}; background-color: ${theme.badgeColor}1A;">
                                        ${theme.badgeLabel}
                                    </span>
                                    <span style="color: #6b7280; font-size: 14px;">
                                        ${eventDate.toLocaleDateString('pt-BR')} ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                            ${progressHtml}
                            ${observacoesHtml}
                        </div>
                    `;
                }).join('');

                checkinsHtml += `
                    <div class="form-group">
                        <label class="form-label">Histórico</label>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${historyItems}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                checkinsHtml += `
                    <div class="form-group">
                        <label class="form-label">Histórico</label>
                        <div style="padding: 20px; text-align: center; color: #6b7280; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <i data-lucide="info" style="width: 24px; height: 24px; margin-bottom: 8px; display: inline-block;"></i>
                            <p>Nenhuma atividade registrada ainda.</p>
                        </div>
                    </div>
                `;
            }

            const finalHtml = `
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <input type="text" class="form-input" id="objetivo-status" value="${objetivo.status || 'N/A'}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Progresso Atual</label>
                    <input type="text" class="form-input" id="objetivo-progresso-atual" value="${objetivo.progresso || 0}%" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Criado por</label>
                    <input type="text" class="form-input" id="objetivo-criado-por" value="${objetivo.criador_nome || 'N/A'}" readonly>
                </div>
                ${checkinsHtml}
            `;
            detalhesFields.innerHTML = finalHtml;
            
            // Inicializar ícones Lucide após inserir o HTML
            if (window.lucide) {
                lucide.createIcons();
            }

            Modal.open('objetivo-modal');
        } catch (error) {
            console.error('Erro ao carregar objetivo:', error);
            alert('Erro ao carregar objetivo');
        }
    },

    async complete(objetivoId) {
        if (!confirm('Tem certeza que deseja marcar este objetivo como concluído?')) return;

        try {
            const result = await API.put(`/api/objetivos/${objetivoId}/complete`);
            await this.loadList();
            if (result.pointsEarned) {
                Notifications.points(result.pointsEarned, 'concluir objetivo');
                await Dashboard.loadGamification();
            } else {
                Notifications.success('Objetivo concluído com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao concluir objetivo:', error);
            alert('Erro ao concluir objetivo');
        }
    },

    async approve(objetivoId) {
        let confirmed = false;
        if (window.Configuracoes && typeof Configuracoes.showConfirm === 'function') {
            confirmed = await Configuracoes.showConfirm('Deseja aprovar a conclusão deste objetivo?');
        } else {
            confirmed = confirm('Deseja aprovar a conclusão deste objetivo?');
        }
        if (!confirmed) return;

        try {
            const response = await API.post(`/api/objetivos/${objetivoId}/approve`);
            await this.loadList();
            const message = (response && response.message) || 'Objetivo aprovado com sucesso!';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(message, 'success');
            } else if (window.Notifications && typeof Notifications.success === 'function') {
                Notifications.success(message);
            } else {
                alert(message);
            }
        } catch (error) {
            console.error('Erro ao aprovar objetivo:', error);
            const serverMessage = (error && (error.message || (error.data && (error.data.error || error.data.message)))) || '';
            const displayMessage = serverMessage || 'Erro ao aprovar objetivo';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(displayMessage, 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error(displayMessage);
            } else {
                alert(displayMessage);
            }
        }
    },

    openRejectionModal(objetivoId) {
        this.state.rejectModal = {
            objetivoId,
        };
        const overlay = document.getElementById('objetivo-reject-modal');
        const textarea = document.getElementById('objetivo-reject-reason');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('show');
        }
        if (textarea) {
            textarea.value = '';
            textarea.focus();
        }
    },

    closeRejectionModal() {
        this.state.rejectModal = null;
        const overlay = document.getElementById('objetivo-reject-modal');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('show');
        }
    },

    async rejectCurrentObjetivo() {
        if (!this.state.rejectModal || !this.state.rejectModal.objetivoId) {
            this.closeRejectionModal();
            return;
        }
        const textarea = document.getElementById('objetivo-reject-reason');
        const motivo = textarea ? textarea.value.trim().slice(0, 500) : '';
        if (!motivo) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Informe o motivo da rejeição.', 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error('Informe o motivo da rejeição.');
            } else {
                alert('Informe o motivo da rejeição.');
            }
            if (textarea) textarea.focus();
            return;
        }

        const objetivoId = this.state.rejectModal.objetivoId;
        try {
            const response = await API.post(`/api/objetivos/${objetivoId}/reject`, { motivo });
            await this.loadList();
            const progressoAnterior = response && typeof response.progressoAnterior === 'number'
                ? response.progressoAnterior
                : null;
            let message = 'Objetivo rejeitado com sucesso.';
            if (progressoAnterior !== null) {
                message = `Objetivo rejeitado e revertido para ${progressoAnterior}%`;
            } else if (response && response.message) {
                message = response.message;
            }
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(message, 'warning');
            } else if (window.Notifications && typeof Notifications.warning === 'function') {
                Notifications.warning(message);
            } else if (window.Notifications && typeof Notifications.info === 'function') {
                Notifications.info(message);
            } else {
                alert(message);
            }
            this.closeRejectionModal();
        } catch (error) {
            console.error('Erro ao rejeitar objetivo:', error);
            const serverMessage = (error && (error.message || (error.data && (error.data.error || error.data.message)))) || '';
            const displayMessage = serverMessage || 'Erro ao rejeitar objetivo';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(displayMessage, 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error(displayMessage);
            } else {
                alert(displayMessage);
            }
        }
    },

    openDeleteModal(objetivoId) {
        this.state.pendingDeleteId = objetivoId;
        const modal = document.getElementById('objetivo-delete-modal');
        if (modal) {
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }
    },

    closeDeleteModal() {
        const modal = document.getElementById('objetivo-delete-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.state.pendingDeleteId = null;
    },

    async confirmDelete() {
        const objetivoId = this.state.pendingDeleteId;
        if (!objetivoId) return;

        this.closeDeleteModal();

        try {
            await API.delete(`/api/objetivos/${objetivoId}`);
            await this.loadList();
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Objetivo excluído com sucesso!', 'success');
            } else if (window.Notifications && typeof Notifications.success === 'function') {
                Notifications.success('Objetivo excluído com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao excluir objetivo:', error);
            const serverMessage = (error && (error.message || (error.data && (error.data.error || error.data.message)))) || '';
            const displayMessage = serverMessage || 'Erro ao excluir objetivo';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(displayMessage, 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error(displayMessage);
            } else {
                alert(displayMessage);
            }
        }
    },

    async delete(objetivoId) {
        this.openDeleteModal(objetivoId);
    },

    async populateForm() {
        const user = State.getUser();
        const isGestor = user && user.hierarchyLevel >= 3;
        let availableUsers = [];

        if (isGestor) {
            try {
                const data = await API.get('/api/objetivos/filtros');
                if (data.responsaveis && Array.isArray(data.responsaveis)) {
                    availableUsers = data.responsaveis.map(u => ({
                        userId: u.Id,
                        nomeCompleto: u.NomeCompleto,
                        departamento: u.DescricaoDepartamento || u.descricaoDepartamento || u.Departamento || u.departamento || 'N/A'
                    }));
                }
            } catch (error) {
                console.error('Erro ao buscar responsáveis:', error);
            }
        } else {
            availableUsers = [{
                userId: user.userId,
                nomeCompleto: user.nomeCompleto,
                departamento: user.descricaoDepartamento || user.DescricaoDepartamento || user.departamento || user.Departamento || 'N/A'
            }];
        }

        const responsavelList = document.getElementById('objetivo-responsavel-list');
        if (responsavelList) {
            responsavelList.innerHTML = '';

            availableUsers.forEach(u => {
                const displayName = `${u.nomeCompleto} - ${u.departamento}`;
                responsavelList.innerHTML += `<div class="select-option" data-value="${u.userId}" ` +
                    `onclick="selectMultipleUser('${u.userId}', '${displayName}')">${displayName}</div>`;
            });
        }
    }
};

// Global functions for onclick
// Global functions for onclick
window.openObjetivoModal = function () { Objetivos.openModal(); };
window.openNewObjetivoModal = function () { Objetivos.openModal(); };
window.closeObjetivoModal = function () { Objetivos.closeModal(); };
window.submitObjetivo = function () { Objetivos.submit(); };
window.editObjetivo = function (id) { Objetivos.edit(id); };
window.checkinObjetivo = function (id) { Objetivos.checkin(id); };
window.viewObjetivoDetails = function (id) { Objetivos.viewDetails(id); };
window.deleteObjetivo = function (id) { Objetivos.delete(id); };
window.completeObjetivo = function (id) { Objetivos.complete(id); };
window.approveObjetivo = function (id) { Objetivos.approve(id); };
window.rejectObjetivo = function (id) { Objetivos.openRejectionModal(id); };
window.loadObjetivos = function () { Objetivos.loadList(); };
window.populateObjetivoForm = function () { Objetivos.populateForm(); };
function selectMultipleUser(userId, userName) {
    if (!userId) return;
    const userIdNum = parseInt(userId, 10);
    if (Objetivos.state.selectedResponsaveis.some(u => u.id === userIdNum)) {
        const list = document.getElementById('objetivo-responsavel-list');
        if (list) list.classList.remove('show');
        return;
    }
    Objetivos.state.selectedResponsaveis.push({ id: userIdNum, name: userName });
    updateSelectedResponsaveisUI();

    const searchInput = document.getElementById('objetivo-responsavel-search');
    if (searchInput) searchInput.value = '';

    const list = document.getElementById('objetivo-responsavel-list');
    if (list) list.classList.remove('show');
}
function filterObjetivoResponsaveis(searchId, listId) {
    const searchInput = document.getElementById(searchId);
    const list = document.getElementById(listId);
    const searchTerm = Objetivos.normalizeText(searchInput.value);

    list.querySelectorAll('.select-option').forEach(option => {
        const text = Objetivos.normalizeText(option.textContent || '');
        option.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });

    list.classList.add('show');
}
function removeSelectedResponsavel(userId) {
    const userIdToRemove = parseInt(userId, 10);
    Objetivos.state.selectedResponsaveis = Objetivos.state.selectedResponsaveis.filter(u => u.id !== userIdToRemove);
    updateSelectedResponsaveisUI();
}
function updateSelectedResponsaveisUI() {
    const container = document.getElementById('selected-responsaveis-container');
    if (!container) return;

    if (Objetivos.state.selectedResponsaveis.length === 0) {
        container.innerHTML = '<div class="no-responsavel-placeholder" style="color: #dc3545; border: 1px dashed #dc3545; padding: 8px; border-radius: 4px; text-align: center; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Nenhum responsável selecionado</div>';
        return;
    }

    container.innerHTML = Objetivos.state.selectedResponsaveis.map(r => `
        <div class="selected-responsavel">
            ${r.name}
            <button type="button" class="remove-btn" onclick="removeSelectedResponsavel('${r.id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}
function clearSelectedResponsaveis() {
    Objetivos.state.selectedResponsaveis = [];
    updateSelectedResponsaveisUI();
}
function getSelectedResponsaveisIds() {
    return Objetivos.state.selectedResponsaveis.map(u => u.id);
}
function formatarDataParaExibicao(dateString) {
    return Objetivos.formatDate(dateString);
}
function toggleObjetivosFilters() {
    const container = document.getElementById('objetivos-filters-container');
    const btn = event.currentTarget;
    const icon = btn.querySelector('svg:last-child');
    const card = btn.closest('.card');

    if (container && btn) {
        container.classList.toggle('collapsed');
        btn.classList.toggle('active');
        const isCollapsed = container.classList.contains('collapsed');
        if (card) {
            card.classList.toggle('filters-collapsed', isCollapsed);
        }

        if (icon) {
            if (isCollapsed) {
                icon.style.transform = 'rotate(0deg)';
            } else {
                icon.style.transform = 'rotate(180deg)';
            }
        }
    }
}
function clearObjetivosFilters() {
    document.getElementById('objetivos-search').value = '';
    document.getElementById('objetivos-responsavel-search').value = '';
    document.getElementById('objetivos-status-filter').value = '';
    Objetivos.loadList();
}

function togglePDIsFilters() {
    const container = document.getElementById('pdis-filters-container');
    const btn = event.currentTarget;
    const icon = btn.querySelector('svg:last-child');
    const card = btn.closest('.card');

    if (container && btn) {
        container.classList.toggle('collapsed');
        btn.classList.toggle('active');
        const isCollapsed = container.classList.contains('collapsed');
        if (card) {
            card.classList.toggle('filters-collapsed', isCollapsed);
        }

        if (icon) {
            if (isCollapsed) {
                icon.style.transform = 'rotate(0deg)';
            } else {
                icon.style.transform = 'rotate(180deg)';
            }
        }
    }
}

function clearPDIsFilters() {
    document.getElementById('pdis-search').value = '';
    document.getElementById('pdis-status-filter').value = '';
    Objetivos.loadPDIs();
}

document.addEventListener('DOMContentLoaded', () => {
    const rejectModal = document.getElementById('objetivo-reject-modal');
    if (rejectModal) {
        rejectModal.addEventListener('click', (event) => {
            if (event.target === rejectModal) {
                Objetivos.closeRejectionModal();
            }
        });
    }

    const deleteModal = document.getElementById('objetivo-delete-modal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (event) => {
            if (event.target === deleteModal) {
                Objetivos.closeDeleteModal();
            }
        });
    }

    const pdiRejectModal = document.getElementById('pdi-reject-modal');
    if (pdiRejectModal) {
        pdiRejectModal.addEventListener('click', (event) => {
            if (event.target === pdiRejectModal) {
                PDIs.closeRejectionModal();
            }
        });
    }

    const closeBtn = document.querySelector('[data-action="closeRejectionModal"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => Objetivos.closeRejectionModal());
    }

    const cancelBtn = document.querySelector('[data-action="cancelRejection"]');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => Objetivos.closeRejectionModal());
    }

    const confirmBtn = document.querySelector('[data-action="confirmRejection"]');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => Objetivos.rejectCurrentObjetivo());
    }

    const closePDIRejectBtn = document.querySelector('[data-action="closePDIRejectionModal"]');
    if (closePDIRejectBtn) {
        closePDIRejectBtn.addEventListener('click', () => PDIs.closeRejectionModal());
    }

    const cancelPDIRejectBtn = document.querySelector('[data-action="cancelPDIRejection"]');
    if (cancelPDIRejectBtn) {
        cancelPDIRejectBtn.addEventListener('click', () => PDIs.closeRejectionModal());
    }

    const confirmPDIRejectBtn = document.querySelector('[data-action="confirmPDIRejection"]');
    if (confirmPDIRejectBtn) {
        confirmPDIRejectBtn.addEventListener('click', () => PDIs.rejectCurrentPDI());
    }
});

window.Objetivos = Objetivos;

// Global functions for onclick handlers
window.openNewObjetivoModal = function () {
    Objetivos.openModal();
};

window.closeObjetivoModal = function () {
    Objetivos.closeModal();
};

window.submitObjetivo = function () {
    Objetivos.submit();
};

// ========================================
// FUNCIONALIDADES DE PDI
// ========================================

const PDIs = {
    state: {
        currentPDI: null,
        currentCheckin: null,
        rejectModal: null,
        pendingApprovalId: null
    },

    async loadList() {
        try {
            const container = document.getElementById('objetivos-pdis-list');
            if (!container) return;

            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando PDIs...</div>';

            const pdis = await API.get('/api/objetivos/pdis/meus');
            
            // Aplicar filtros no cliente, insensíveis a acentos
            const pdisSearch = document.getElementById('pdis-search');
            const statusFilter = document.getElementById('pdis-status-filter');
            
            let lista = pdis;
            
            // Usar normalizeText do Objetivos se disponível
            const normalizeText = (window.Objetivos && typeof Objetivos.normalizeText === 'function') 
                ? Objetivos.normalizeText.bind(Objetivos)
                : (text) => text;
            
            if (pdisSearch?.value.trim()) {
                const searchTerm = normalizeText(pdisSearch.value.trim().toLowerCase());
                lista = lista.filter(pdi => {
                    const titulo = normalizeText((pdi.Titulo || '').toLowerCase());
                    const feedback = normalizeText((pdi.FeedbackGestor || pdi.Feedback || '').toLowerCase());
                    const colaborador = normalizeText((pdi.ColaboradorNome || '').toLowerCase());
                    return titulo.includes(searchTerm) || feedback.includes(searchTerm) || colaborador.includes(searchTerm);
                });
            }

            if (statusFilter?.value.trim()) {
                lista = lista.filter(pdi => pdi.Status === statusFilter.value.trim());
            }

            // Usar a função updatePDIsList do Objetivos
            if (window.Objetivos && typeof Objetivos.updatePDIsList === 'function') {
                Objetivos.updatePDIsList(lista);
            } else {
                // Fallback: usar updateList se updatePDIsList não estiver disponível
                this.updateList(lista);
            }
        } catch (error) {
            console.error('Erro ao carregar PDIs:', error);
            const container = document.getElementById('objetivos-pdis-list');
            if (container) {
                container.innerHTML = `
                    <div class="historico-empty" style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
                        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ef4444; margin-bottom: 16px;"></i>
                        <h4 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px;">Erro ao carregar PDIs</h4>
                        <p style="color: #6b7280;">Não foi possível carregar os Planos de Desenvolvimento Individual.</p>
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
            }
        }
    },

    updateList(pdis) {
        // Usar a mesma função updatePDIsList que está no Objetivos
        if (window.Objetivos && typeof Objetivos.updatePDIsList === 'function') {
            Objetivos.updatePDIsList(pdis);
            return;
        }
        
        const container = document.getElementById('objetivos-pdis-list');
        if (!container) return;

        if (!pdis || pdis.length === 0) {
            container.innerHTML = `
                <div class="historico-empty" style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
                    <i data-lucide="graduation-cap" style="width: 48px; height: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nenhum PDI encontrado</h4>
                    <p style="color: #6b7280;">Você ainda não possui Planos de Desenvolvimento Individual.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = pdis.map(pdi => {
            const currentUser = State.getUser();
            const currentUserId = currentUser && (currentUser.userId || currentUser.Id);
            const progresso = pdi.Progresso || 0;
            const prazoConclusao = pdi.PrazoConclusao || pdi.PrazoRevisao || pdi.DataFim;
            const dataInicio = pdi.DataInicio ? (this.formatPDIDate ? this.formatPDIDate(pdi.DataInicio) : this.formatDate(pdi.DataInicio)) : '';
            const dataFim = prazoConclusao ? (this.formatPDIDate ? this.formatPDIDate(prazoConclusao) : this.formatDate(prazoConclusao)) : '';
            const isOverdue = prazoConclusao && new Date(prazoConclusao + 'T00:00:00') < new Date() && pdi.Status === 'Ativo';

            const statusConfig = {
                'Ativo': { color: '#10b981', icon: 'play-circle' },
                'Aguardando Validação': { color: '#f59e0b', icon: 'clock' },
                'Concluído': { color: '#059669', icon: 'check-circle' },
                'Expirado': { color: '#ef4444', icon: 'x-circle' }
            };
            const { color, icon } = statusConfig[pdi.Status] || { color: '#6b7280', icon: 'circle' };

            // Verificar se o usuário é gestor direto do PDI
            const isGestorDireto = currentUserId && pdi.GestorId && Number(currentUserId) === Number(pdi.GestorId);
            const canApprovePDI = isGestorDireto && pdi.Status === 'Aguardando Validação';
            const isColaboradorPDI = currentUserId && pdi.UserId && Number(currentUserId) === Number(pdi.UserId);

            return `
                <div class="objetivo-item" data-pdi-id="${pdi.Id}" style="border-left-color: ${color};">
                    <div class="objetivo-header">
                        <div class="objetivo-info">
                            <h4>${pdi.Titulo || 'PDI'}</h4>
                            <p style="color: #6b7280; margin: 8px 0;">${pdi.FeedbackGestor || pdi.Feedback || 'Sem feedback'}</p>
                            <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">
                                <span>Colaborador: ${pdi.ColaboradorNome || 'N/A'}</span>
                                ${dataInicio ? `<span style="margin-left: 16px;">Início: ${dataInicio}</span>` : ''}
                                ${dataFim ? `<span style="margin-left: 16px;">Prazo: ${dataFim}</span>` : ''}
                                ${isOverdue ? '<span style="margin-left: 16px; color: #ef4444; display: inline-flex; align-items: center; gap: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Atrasado</span>' : ''}
                            </div>
                        </div>
                        <div class="objetivo-badges">
                            <span class="badge" style="background-color: ${color}; color: white;">
                                <i data-lucide="${icon}" style="width: 14px; height: 14px; margin-right: 4px;"></i> ${pdi.Status}
                            </span>
                        </div>
                    </div>
                    <div class="objetivo-progresso">
                        <div class="progresso-bar">
                            <div class="progresso-fill" style="width: ${progresso}%"></div>
                        </div>
                        <div class="progresso-text">
                            <span>Progresso:</span>
                            <span>${progresso}%</span>
                        </div>
                    </div>
                    <div class="objetivo-actions">
                        ${pdi.Status === 'Ativo' && isColaboradorPDI ? `
                            <button class="btn btn-secondary btn-sm" onclick="PDIs.checkin(${pdi.Id})">
                                <i data-lucide="check-circle" style="width: 16px; height: 16px; margin-right: 6px;"></i> Check-in
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="PDIs.viewDetails(${pdi.Id})">
                            <i data-lucide="eye" style="width: 16px; height: 16px; margin-right: 6px;"></i> Ver Detalhes
                        </button>
                        ${canApprovePDI ? `
                            <button class="btn btn-success btn-sm" onclick="PDIs.openApprovalModal(${pdi.Id})">
                                <i data-lucide="check" style="width: 16px; height: 16px; margin-right: 6px;"></i> Aprovar
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="PDIs.openRejectionModal(${pdi.Id})">
                                <i data-lucide="x-circle" style="width: 16px; height: 16px; margin-right: 6px;"></i> Rejeitar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Inicializar ícones Lucide após renderizar
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            // Se já é um objeto Date, converter para string
            let dateValue = dateString;
            if (dateString instanceof Date) {
                dateValue = dateString.toISOString();
            } else if (typeof dateString !== 'string') {
                dateValue = String(dateString);
            }
            
            // Extrair a parte da data (antes do T se houver)
            const dateStr = dateValue.split('T')[0];
            if (!dateStr) return '';
            
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                // Formato YYYY-MM-DD: criar Date usando componentes locais (não UTC)
                const [ano, mes, dia] = parts;
                const date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                if (isNaN(date.getTime())) return '';
                return date.toLocaleDateString('pt-BR');
            }
            
            // Tentar outro formato (DD/MM/YYYY)
            const parts2 = dateStr.split('/');
            if (parts2.length === 3) {
                const [dia, mes, ano] = parts2;
                const date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                if (isNaN(date.getTime())) return '';
                return date.toLocaleDateString('pt-BR');
            }
            
            return '';
        } catch (error) {
            console.error('Erro ao formatar data:', error, dateString);
            return '';
        }
    },

    openCheckinModal(pdiId) {
        const modal = document.getElementById('pdi-checkin-modal');
        const inputProgresso = document.getElementById('pdi-checkin-progresso');
        const textareaObservacoes = document.getElementById('pdi-checkin-observacoes');
        const hiddenId = document.getElementById('pdi-checkin-id');
        
        if (!modal || !inputProgresso || !textareaObservacoes || !hiddenId) {
            console.error('Elementos do modal de check-in não encontrados');
            return;
        }

        // Armazenar o ID do PDI
        hiddenId.value = pdiId;
        
        // Limpar campos
        inputProgresso.value = '';
        textareaObservacoes.value = '';
        
        // Abrir o modal
        modal.classList.remove('hidden');
        
        // Focar no campo de progresso
        setTimeout(() => inputProgresso.focus(), 100);
    },

    async checkin(pdiId) {
        this.openCheckinModal(pdiId);
    },

    async submitCheckin() {
        const inputProgresso = document.getElementById('pdi-checkin-progresso');
        const textareaObservacoes = document.getElementById('pdi-checkin-observacoes');
        const hiddenId = document.getElementById('pdi-checkin-id');
        
        if (!inputProgresso || !textareaObservacoes || !hiddenId) {
            console.error('Elementos do modal não encontrados');
            return;
        }

        const pdiId = hiddenId.value;
        const progresso = inputProgresso.value.trim();
        const observacoes = textareaObservacoes.value.trim();

        if (!progresso) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Por favor, informe o progresso atual', 'error');
            }
            return;
        }

        const progressoNum = parseInt(progresso, 10);
        if (isNaN(progressoNum) || progressoNum < 0 || progressoNum > 100) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Progresso deve ser entre 0 e 100', 'error');
            }
            return;
        }

        try {
            await API.post(`/api/objetivos/pdis/${pdiId}/checkin`, { 
                progresso: progressoNum, 
                observacoes 
            });
            
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Check-in registrado com sucesso!', 'success');
            }
            
            // Fechar o modal
            this.closeCheckinModal();
            
            // Recarregar a lista
            if (window.Objetivos && typeof Objetivos.loadPDIs === 'function') {
                Objetivos.loadPDIs();
            }
            if (this.loadList && typeof this.loadList === 'function') {
                this.loadList();
            }
        } catch (error) {
            console.error('Erro ao registrar check-in:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                const errorMsg = error.message || 'Erro ao registrar check-in';
                EmailPopup.showToast(errorMsg, 'error');
            }
        }
    },

    closeCheckinModal() {
        const modal = document.getElementById('pdi-checkin-modal');
        const inputProgresso = document.getElementById('pdi-checkin-progresso');
        const textareaObservacoes = document.getElementById('pdi-checkin-observacoes');
        const hiddenId = document.getElementById('pdi-checkin-id');
        
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (inputProgresso) {
            inputProgresso.value = '';
        }
        
        if (textareaObservacoes) {
            textareaObservacoes.value = '';
        }
        
        if (hiddenId) {
            hiddenId.value = '';
        }
    },

    async viewDetails(pdiId) {
        const modal = document.getElementById('pdi-detalhes-modal');
        const content = document.getElementById('pdi-detalhes-content');
        
        if (!modal || !content) {
            console.error('Elementos do modal de detalhes não encontrados');
            return;
        }

        // Abrir modal e mostrar loading
        modal.classList.remove('hidden');
        content.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando detalhes...</div>';

        try {
            const [pdi, checkins] = await Promise.all([
                API.get(`/api/objetivos/pdis/${pdiId}`),
                API.get(`/api/objetivos/pdis/${pdiId}/checkins`)
            ]);

            // Verificar se o usuário atual é o colaborador ou gestor
            const user = State.getUser();
            const userId = user && (user.userId || user.Id);
            const isColaborador = userId && pdi.UserId && Number(userId) === Number(pdi.UserId);
            const isGestor = userId && pdi.GestorId && Number(userId) === Number(pdi.GestorId);

            const progresso = pdi.Progresso || 0;
            // Usar PrazoConclusao diretamente (o backend já faz o alias correto)
            const prazoConclusao = pdi.PrazoConclusao;
            
            let prazoFormatado = 'Não informado';
            if (prazoConclusao) {
                // Usar formatPDIDate do Objetivos (mais simples e robusta)
                if (window.Objetivos && typeof Objetivos.formatPDIDate === 'function') {
                    const formatted = Objetivos.formatPDIDate(prazoConclusao);
                    if (formatted && formatted.trim()) {
                        prazoFormatado = formatted;
                    } else {
                        // Fallback: tentar criar Date diretamente
                        const date = new Date(prazoConclusao);
                        if (!isNaN(date.getTime())) {
                            prazoFormatado = date.toLocaleDateString('pt-BR');
                        }
                    }
                } else {
                    // Fallback para formatDate do PDIs
                    const formatted = this.formatDate ? this.formatDate(prazoConclusao) : '';
                    if (formatted && formatted.trim()) {
                        prazoFormatado = formatted;
                    } else {
                        // Último recurso: tentar criar Date diretamente
                        const date = new Date(prazoConclusao);
                        if (!isNaN(date.getTime())) {
                            prazoFormatado = date.toLocaleDateString('pt-BR');
                        }
                    }
                }
            }
            const isOverdue = prazoConclusao && new Date(prazoConclusao + 'T00:00:00') < new Date() && pdi.Status === 'Ativo';

            const statusConfig = {
                'Ativo': { color: '#10b981', icon: 'play-circle' },
                'Aguardando Validação': { color: '#f59e0b', icon: 'clock' },
                'Concluído': { color: '#059669', icon: 'check-circle' },
                'Expirado': { color: '#ef4444', icon: 'x-circle' }
            };
            const { color } = statusConfig[pdi.Status] || { color: '#6b7280' };

            // Usar FeedbackGestor ao invés de Feedback
            const feedbackGestor = pdi.FeedbackGestor || pdi.Feedback || 'Sem feedback';

            content.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    ${!isColaborador ? `
                        <div class="form-group">
                            <label class="form-label">Colaborador</label>
                            <input type="text" class="form-input" value="${pdi.ColaboradorNome || 'N/A'}" readonly>
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <input type="text" class="form-input" value="${pdi.Status || 'N/A'}" readonly 
                            style="color: ${color}; font-weight: 600;">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Progresso</label>
                        <input type="text" class="form-input" value="${progresso}%" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Prazo de Conclusão</label>
                        <input type="text" class="form-input" value="${prazoFormatado}${isOverdue ? ' ⚠ Atrasado' : ''}" readonly
                            style="${isOverdue ? 'color: #ef4444;' : ''}">
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${progresso}%; height: 100%; background: ${color}; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 13px; color: #6b7280;">
                        <span>Progresso atual</span>
                        <span style="font-weight: 600;">${progresso}%</span>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Feedback</label>
                    <textarea class="form-textarea" rows="3" readonly>${feedbackGestor}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Objetivos</label>
                    <textarea class="form-textarea" rows="4" readonly>${pdi.Objetivos || 'Não definidos'}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Ações</label>
                    <textarea class="form-textarea" rows="4" readonly>${pdi.Acoes || 'Não definidas'}</textarea>
                </div>

                ${checkins && checkins.length > 0 ? `
                    <div style="margin-top: 24px;">
                        <h4 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px;">
                            Histórico de Check-ins
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0px;">
                            ${checkins.map(c => {
                                const eventDate = new Date(c.created_at);
                                eventDate.setHours(eventDate.getHours() + 3);
                                const rawObservacoes = (c.observacoes || '').trim();
                                const isSystemEvent = /^\[SISTEMA\]/i.test(rawObservacoes);
                                const cleanedObservacoes = rawObservacoes.replace(/^\[SISTEMA\]\s*/i, '');
                                const lowerObs = cleanedObservacoes.toLowerCase();
                                const numericProgress = Number(c.progresso) || 0;

                                const theme = {
                                    borderColor: '#0d556d',
                                    badgeColor: '#0d556d',
                                    badgeLabel: 'Check-in',
                                    showProgress: true,
                                    progressLabel: `Progresso: ${numericProgress}%`
                                };

                                if (isSystemEvent) {
                                    theme.showProgress = false;
                                    theme.badgeLabel = 'Atualização';
                                    theme.borderColor = '#3b82f6';
                                    theme.badgeColor = '#3b82f6';

                                    if (lowerObs.includes('rejeit')) {
                                        theme.badgeLabel = 'Rejeição';
                                        theme.borderColor = '#ef4444';
                                        theme.badgeColor = '#ef4444';
                                        theme.showProgress = true;
                                        theme.progressLabel = `Progresso restaurado para ${numericProgress}%`;
                                    } else if (lowerObs.includes('aprov')) {
                                        theme.badgeLabel = 'Aprovação';
                                        theme.borderColor = '#10b981';
                                        theme.badgeColor = '#10b981';
                                    } else if (lowerObs.includes('aguard') || lowerObs.includes('pendente') || lowerObs.includes('solic')) {
                                        theme.badgeLabel = 'Aguardando';
                                        theme.borderColor = '#f59e0b';
                                        theme.badgeColor = '#f59e0b';
                                    }
                                }

                                const shouldTruncate = !isSystemEvent;
                                const displayObservacoes = cleanedObservacoes
                                    ? (shouldTruncate && cleanedObservacoes.length > 250
                                        ? `${cleanedObservacoes.slice(0, 250)}...`
                                        : cleanedObservacoes)
                                    : '';

                                const observacoesHtml = displayObservacoes
                                    ? `<div style="color: #6b7280; font-size: 14px; white-space: pre-wrap; word-break: break-word; margin-top: 8px;">${displayObservacoes}</div>`
                                    : '';

                                const progressHtml = theme.showProgress
                                    ? `<div style="color: #059669; font-weight: 600; font-size: 14px; margin-bottom: 4px;">${theme.progressLabel}</div>`
                                    : '';

                                const displayName = isSystemEvent ? 'Sistema' : (c.user_name || 'Sistema');

                                return `
                                    <div style="padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid ${theme.borderColor};">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <strong style="color: #374151;">${displayName}</strong>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; border: 1px solid ${theme.badgeColor}; color: ${theme.badgeColor}; background-color: ${theme.badgeColor}1A;">
                                                    ${theme.badgeLabel}
                                                </span>
                                                <span style="color: #6b7280; font-size: 14px;">
                                                    ${eventDate.toLocaleDateString('pt-BR')} ${eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        ${progressHtml}
                                        ${observacoesHtml}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : `
                    <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center;">
                        <i data-lucide="info" style="width: 24px; height: 24px; margin-bottom: 8px; display: inline-block; color: #6b7280;"></i>
                        <p style="color: #6b7280; margin: 0;">Nenhum check-in registrado ainda.</p>
                    </div>
                `}
            `;
            
            // Inicializar ícones Lucide após inserir o HTML
            if (window.lucide) {
                lucide.createIcons();
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do PDI:', error);
            content.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p style="color: #ef4444; margin: 0;">Erro ao carregar detalhes do PDI.</p>
                </div>
            `;
        }
    },

    closeDetalhesModal() {
        const modal = document.getElementById('pdi-detalhes-modal');
        const content = document.getElementById('pdi-detalhes-content');
        
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (content) {
            content.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando detalhes...</div>';
        }
    },

    openApprovalModal(pdiId) {
        this.state.pendingApprovalId = pdiId;
        const overlay = document.getElementById('pdi-approve-modal');
        if (overlay) {
            overlay.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }
    },

    closeApprovalModal() {
        this.state.pendingApprovalId = null;
        const overlay = document.getElementById('pdi-approve-modal');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    async confirmApprove() {
        if (!this.state.pendingApprovalId) {
            this.closeApprovalModal();
            return;
        }

        const pdiId = this.state.pendingApprovalId;

        try {
            await API.post(`/api/objetivos/pdis/${pdiId}/approve`);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('PDI aprovado com sucesso!', 'success');
            }
            this.closeApprovalModal();
            // Recarregar a listagem de PDIs
            if (window.Objetivos && typeof Objetivos.loadPDIs === 'function') {
                await Objetivos.loadPDIs();
            } else if (this.loadList && typeof this.loadList === 'function') {
                await this.loadList();
            }
        } catch (error) {
            console.error('Erro ao aprovar PDI:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao aprovar PDI', 'error');
            }
        }
    },

    openRejectionModal(pdiId) {
        this.state.rejectModal = {
            pdiId: pdiId
        };
        const overlay = document.getElementById('pdi-reject-modal');
        const textarea = document.getElementById('pdi-reject-reason');
        if (overlay) {
            overlay.classList.remove('hidden');
            if (textarea) {
                textarea.value = '';
                setTimeout(() => textarea.focus(), 100);
            }
        }
    },

    closeRejectionModal() {
        this.state.rejectModal = null;
        const overlay = document.getElementById('pdi-reject-modal');
        const textarea = document.getElementById('pdi-reject-reason');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        if (textarea) {
            textarea.value = '';
        }
    },

    async rejectCurrentPDI() {
        if (!this.state.rejectModal || !this.state.rejectModal.pdiId) {
            this.closeRejectionModal();
            return;
        }

        const textarea = document.getElementById('pdi-reject-reason');
        if (!textarea) {
            this.closeRejectionModal();
            return;
        }

        const motivo = textarea.value.trim();
        if (!motivo) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Por favor, informe o motivo da rejeição', 'error');
            } else {
                alert('Por favor, informe o motivo da rejeição');
            }
            return;
        }

        const pdiId = this.state.rejectModal.pdiId;

        try {
            const response = await API.post(`/api/objetivos/pdis/${pdiId}/reject`, { motivo });
            const message = response && response.message ? response.message : 'PDI rejeitado com sucesso';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(message, 'warning');
            } else if (window.Notifications && typeof Notifications.warning === 'function') {
                Notifications.warning(message);
            } else {
                alert(message);
            }
            this.closeRejectionModal();
            // Recarregar a listagem de PDIs
            if (window.Objetivos && typeof Objetivos.loadPDIs === 'function') {
                await Objetivos.loadPDIs();
            } else if (this.loadList && typeof this.loadList === 'function') {
                await this.loadList();
            }
        } catch (error) {
            console.error('Erro ao rejeitar PDI:', error);
            const serverMessage = (error && (error.message || (error.data && (error.data.error || error.data.message)))) || '';
            const displayMessage = serverMessage || 'Erro ao rejeitar PDI';
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast(displayMessage, 'error');
            } else if (window.Notifications && typeof Notifications.error === 'function') {
                Notifications.error(displayMessage);
            } else {
                alert(displayMessage);
            }
        }
    }
};

// Função global para alternar entre subabas
window.toggleObjetivosSubTab = function (subtab) {
    const objetivosTab = document.querySelector('[data-objetivos-subtab="objetivos"]');
    const pdisTab = document.querySelector('[data-objetivos-subtab="pdis"]');
    const objetivosContent = document.getElementById('objetivos-subtab-content');
    const pdisContent = document.getElementById('pdis-subtab-content');

    if (subtab === 'objetivos') {
        objetivosTab.classList.add('active');
        pdisTab.classList.remove('active');
        objetivosContent.style.display = 'block';
        pdisContent.style.display = 'none';
        Objetivos.loadList();
    } else if (subtab === 'pdis') {
        objetivosTab.classList.remove('active');
        pdisTab.classList.add('active');
        objetivosContent.style.display = 'none';
        pdisContent.style.display = 'block';
        PDIs.loadList();
    }
};

window.PDIs = PDIs;

// Funções globais para handlers inline dos modais de PDI
function closePDIDetalhesModal() {
    if (window.PDIs && typeof PDIs.closeDetalhesModal === 'function') {
        PDIs.closeDetalhesModal();
    }
}

function closePDICheckinModal() {
    if (window.PDIs && typeof PDIs.closeCheckinModal === 'function') {
        PDIs.closeCheckinModal();
    }
}

function submitPDICheckin() {
    if (window.PDIs && typeof PDIs.submitCheckin === 'function') {
        PDIs.submitCheckin();
    }
}
