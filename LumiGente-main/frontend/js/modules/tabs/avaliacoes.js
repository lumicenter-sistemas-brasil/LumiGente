// Avaliações Tab Module
window.Avaliacoes = {
    state: {
        avaliacaoAtual: null,
        respostasAvaliacao: {},
        // Estado para criação de avaliação com perguntas personalizadas
        perguntasNovaAvaliacao: [],
        perguntaEditandoIndex: null,
        opcoesTemporarias: []
    },

    renderIcon(nome, tamanho = 20, estilosExtras = '') {
        const baseStyles = `width: ${tamanho}px; height: ${tamanho}px;`;
        return `<i data-lucide="${nome}" style="${baseStyles}${estilosExtras}"></i>`;
    },

    refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
        }
    },

    hasAdminPermission() {
        const user = State.getUser();
        if (!user) return false;

        const dept = (user.descricaoDepartamento || user.DescricaoDepartamento || user.department || '').toUpperCase().trim();
        const role = (user.role || '').toUpperCase();

        // Verificar apenas os departamentos específicos: SUPERVISAO RH ou DEPARTAMENTO TREINAM&DESENVOLV
        const isHRTD = dept === 'SUPERVISAO RH' || 
            dept.includes('DEPARTAMENTO TREINAM&DESENVOLV');

        return isHRTD || role === 'ADMINISTRADOR';
    },

    async load() {
        await this.checkPermissions();
        
        // Garantir que usuários sem permissão sempre vejam apenas "Minhas Avaliações"
        const hasAccess = this.hasHRTDAccess === true;
        if (!hasAccess) {
            const minhasView = document.getElementById('minhas-avaliacoes-view');
            const todasView = document.getElementById('todas-avaliacoes-view');
            if (minhasView) minhasView.style.display = 'block';
            if (todasView) todasView.style.display = 'none';
        }
        
        await this.loadMinhas();
        this.refreshIcons();
    },

    async loadMinhas() {
        try {
            const [legacy, desempenho] = await Promise.all([
                API.get('/api/avaliacoes/minhas'),
                API.get('/api/avaliacoes/desempenho/minhas')
            ]);

            // Normalizar dados de desempenho para o formato da lista
            const desempenhoFormatado = [
                ...(desempenho.comoColaborador || []).map(a => ({
                    ...a,
                    TipoAvaliacao: 'Desempenho',
                    StatusAvaliacao: a.StatusAvaliacao || a.Status,
                    DataLimiteResposta: a.DataLimiteAutoAvaliacao,
                    Origem: 'NOVA'
                })),
                ...(desempenho.comoGestor || []).map(a => ({
                    ...a,
                    TipoAvaliacao: 'Desempenho',
                    StatusAvaliacao: a.StatusAvaliacao || a.Status,
                    DataLimiteResposta: a.DataLimiteGestor,
                    Origem: 'NOVA'
                }))
            ];

            const todas = [...legacy, ...desempenhoFormatado];
            // Ordenar por data limite
            todas.sort((a, b) => new Date(a.DataLimiteResposta) - new Date(b.DataLimiteResposta));

            this.minhasAvaliacoes = todas;
            this.updateMinhasList(todas);
        } catch (error) {
            console.error('Erro ao carregar avaliações:', error);
        }
    },

    async loadTodas() {
        try {
            const [legacy, desempenho] = await Promise.all([
                API.get('/api/avaliacoes/todas'),
                API.get('/api/avaliacoes/desempenho/todas')
            ]);

            // Normalizar dados de desempenho
            const desempenhoFormatado = (desempenho || []).map(a => ({
                ...a,
                TipoAvaliacao: 'Desempenho',
                StatusAvaliacao: a.StatusAvaliacao || a.Status,
                DataLimiteResposta: a.DataLimiteGestor,
                Origem: 'NOVA'
            }));

            const todas = [...legacy, ...desempenhoFormatado];
            this.todasAvaliacoes = todas;
            this.updateTodasList(todas);
        } catch (error) {
            console.error('Erro ao carregar todas as avaliações:', error);
        }
    },

    toggleView(view) {
        // Verificar se o usuário tem permissão para ver todas as avaliações
        const hasAccess = this.hasHRTDAccess === true;

        // Se tentar acessar "todas" sem permissão, bloquear e mostrar apenas "minhas"
        if (view === 'todas' && !hasAccess) {
            view = 'minhas';
        }

        const minhasView = document.getElementById('minhas-avaliacoes-view');
        const todasView = document.getElementById('todas-avaliacoes-view');
        const btnMinhas = document.getElementById('btn-tab-minhas');
        const btnTodas = document.getElementById('btn-tab-todas');

        if (minhasView) minhasView.style.display = 'none';
        if (todasView) todasView.style.display = 'none';
        if (btnMinhas) btnMinhas.classList.remove('active');
        if (btnTodas) btnTodas.classList.remove('active');

        if (view === 'minhas') {
            if (minhasView) minhasView.style.display = 'block';
            if (btnMinhas) btnMinhas.classList.add('active');
            this.loadMinhas();
        } else if (view === 'todas' && hasAccess) {
            if (todasView) todasView.style.display = 'block';
            if (btnTodas) btnTodas.classList.add('active');
            this.loadTodas();
        }
    },

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
        this.state.avaliacaoAtual = null;
        this.state.respostasAvaliacao = {};
    },

    enviarRespostas() {
        if (typeof AvaliacoesHandlers !== 'undefined' && typeof AvaliacoesHandlers.enviarRespostas === 'function') {
            AvaliacoesHandlers.enviarRespostas(this.state.avaliacaoAtual, State.getUser());
        } else {
            console.error('AvaliacoesHandlers não encontrado');
            alert('Erro: Módulo de handlers não carregado.');
        }
    },

    switchTab(tab) {
        // Não fazer nada - as abas do modal são controladas por outros métodos
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        
        // Se já é um objeto Date, converter para string
        let dateValue = dateString;
        if (dateString instanceof Date) {
            dateValue = dateString.toISOString();
        } else if (typeof dateString !== 'string') {
            // Tentar converter para string se for outro tipo
            dateValue = String(dateString);
        }
        
        // Extrair a parte da data (antes do T se houver)
        const dateStr = dateValue.split('T')[0];
        const [year, month, day] = dateStr.split('-');
        
        if (!year || !month || !day) return '-';
        
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('pt-BR');
    },



    updateMinhasList(avaliacoes) {
        const container = document.querySelector('#minhas-avaliacoes-view .card');
        if (!container) return;

        if (avaliacoes.length === 0) {
            container.innerHTML = `
                <h3>${this.renderIcon('clipboard-check', 20, 'margin-right: 8px; color: #10b981;')}Minhas Avaliações</h3>
                <div style="text-align: center; padding: 40px 20px;">
                    ${this.renderIcon('check-circle', 64, 'color: #10b981; margin-bottom: 16px;')}
                    <h4 style="color: #6b7280;">Nenhuma avaliação pendente</h4>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        container.innerHTML = `
            <h3>${this.renderIcon('clipboard-check', 20, 'margin-right: 8px; color: #10b981;')}Minhas Avaliações</h3>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Total: ${avaliacoes.length} avaliação(ões)</p>
            ${this.renderList(avaliacoes, false)}
        `;
        this.refreshIcons();
    },

    updateTodasList(avaliacoes) {
        const container = document.getElementById('todas-avaliacoes-conteudo');
        if (!container) return;

        if (!this.todasAvaliacoes || this.todasAvaliacoes.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Todas as Avaliações</h3>
                        ${this.hasAdminPermission() ? `
                            <button class="btn btn-amber btn-sm" onclick="Avaliacoes.abrirModalCriacao()">
                                ${this.renderIcon('plus', 16, 'margin-right: 6px;')}
                                Nova Avaliação
                            </button>
                        ` : ''}
                    </div>
                    <div style="text-align: center; padding: 40px 20px;">
                        ${this.renderIcon('inbox', 64, 'color: #e5e7eb; margin-bottom: 16px;')}
                        <h4 style="color: #6b7280;">Nenhuma avaliação cadastrada</h4>
                        ${this.hasAdminPermission() ? `
                            <p style="color: #9ca3af; margin-top: 8px;">Clique em "Nova Avaliação" para começar.</p>
                        ` : ''}
                    </div>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        // Se os filtros já existem, atualiza apenas a lista
        const listaContainer = document.getElementById('lista-avaliacoes-container');
        if (listaContainer && document.getElementById('filtro-nome')) {
            listaContainer.innerHTML = this.renderList(avaliacoes, true);

            // Atualizar contador
            const contador = container.querySelector('p strong');
            if (contador) contador.textContent = avaliacoes.length;

            this.refreshIcons();
            return;
        }

        container.innerHTML = `
            <div class="card" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">Total: <strong>${avaliacoes.length}</strong> avaliação(ões)</p>
                    <div style="display: flex; gap: 8px;">
                        ${this.hasAdminPermission() ? `
                            <button class="btn btn-amber btn-sm" onclick="Avaliacoes.abrirModalCriacao()">
                                ${this.renderIcon('plus', 16, 'margin-right: 6px;')}
                                Nova Avaliação
                            </button>
                        ` : ''}
                        <button class="btn btn-sm" onclick="Avaliacoes.limparFiltros()" style="background: #6b7280; color: white;">
                            ${this.renderIcon('x', 16, 'margin-right: 6px;')}
                            Limpar Filtros
                        </button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    <input type="text" id="filtro-nome" placeholder="Buscar por nome..." class="form-input" style="padding: 8px 12px; font-size: 14px;" oninput="Avaliacoes.aplicarFiltros()">
                    <input type="text" id="filtro-departamento" placeholder="Buscar por departamento..." class="form-input" style="padding: 8px 12px; font-size: 14px;" oninput="Avaliacoes.aplicarFiltros()">
                    <select id="filtro-status" class="form-select" style="padding: 8px 12px; font-size: 14px;" onchange="Avaliacoes.aplicarFiltros()">
                        <option value="">Todos os status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Agendada">Agendada</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Aguardando Gestor">Aguardando Gestor</option>
                        <option value="Aguardando Colaborador">Aguardando Colaborador</option>
                        <option value="Concluida">Concluída</option>
                        <option value="Expirada">Expirada</option>
                    </select>
                    <select id="filtro-tipo" class="form-select" style="padding: 8px 12px; font-size: 14px;" onchange="Avaliacoes.aplicarFiltros()">
                        <option value="">Todos os tipos</option>
                        <option value="45">45 dias</option>
                        <option value="90">90 dias</option>
                        <option value="Desempenho">Desempenho</option>
                    </select>
                </div>
            </div>
            <div id="lista-avaliacoes-container">${this.renderList(avaliacoes, true)}</div>
        `;
        this.refreshIcons();
    },

    getStatusBadgeStyle(status) {
        const styles = {
            'Pendente': 'background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Agendada': 'background: #dbeafe; color: #1e40af; border: 1px solid #60a5fa; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Concluída': 'background: #d1fae5; color: #065f46; border: 1px solid #10b981; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Concluida': 'background: #d1fae5; color: #065f46; border: 1px solid #10b981; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Aguardando Gestor': 'background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Aguardando Colaborador': 'background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Em Andamento': 'background: #e0e7ff; color: #3730a3; border: 1px solid #818cf8; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;',
            'Expirada': 'background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;'
        };
        return styles[status] || 'background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; height: fit-content;';
    },

    renderList(avaliacoes, isAdmin = false) {
        const user = State.getUser();
        return `
            <div class="avaliacoes-lista">
                ${avaliacoes.map(avaliacao => {
            const isParticipante = avaliacao.UserId === user.userId || avaliacao.GestorId === user.userId;
            let jaRespondeu = false;
            if (avaliacao.UserId === user.userId) {
                jaRespondeu = avaliacao.RespostaColaboradorConcluida;
            } else if (avaliacao.GestorId === user.userId) {
                jaRespondeu = avaliacao.RespostaGestorConcluida;
            }

            const ambasPartesResponderam = avaliacao.RespostaColaboradorConcluida && avaliacao.RespostaGestorConcluida;
            const statusAtual = avaliacao.StatusAvaliacao || avaliacao.Status;
            const statusPendente = statusAtual === 'Pendente' || statusAtual === 'Criada' || statusAtual === 'Em Andamento';
            const podeResponder = isParticipante && !jaRespondeu && statusPendente;
            const emCalibragem = statusAtual === 'Calibragem' && this.hasAdminPermission();
            const estaExpirada = statusAtual === 'Expirada';

            let textoBotao, iconeBotao, statusExibido = statusAtual;
            let acaoBotao = `Avaliacoes.open(${avaliacao.Id})`;
            let btnClass = 'btn-amber';

            if (estaExpirada) {
                if (isAdmin) {
                    textoBotao = 'Reabrir Avaliação';
                    iconeBotao = 'refresh-cw';
                    acaoBotao = `Avaliacoes.abrirModalReabrirAvaliacao(${avaliacao.Id})`;
                } else {
                    textoBotao = 'Ver Detalhes';
                    iconeBotao = 'eye';
                    // Mantém ação padrão de abrir modal que mostra msg de expirada
                }
            } else if (emCalibragem) {
                textoBotao = 'Realizar Calibragem';
                iconeBotao = 'sliders';
            } else if (podeResponder) {
                textoBotao = 'Responder';
                iconeBotao = 'clipboard-check';
            } else if (statusAtual === 'Concluida' || statusAtual === 'Concluída') {
                textoBotao = 'Ver Detalhes';
                iconeBotao = 'eye';
            } else if (jaRespondeu) {
                textoBotao = 'Ver Status';
                iconeBotao = 'clock';
            } else {
                textoBotao = 'Ver Detalhes';
                iconeBotao = 'eye';
            }

            let tipoDias = avaliacao.TipoAvaliacao;
            if (avaliacao.Origem !== 'NOVA') {
                tipoDias = avaliacao.TipoAvaliacao.includes('45') ? '45 dias' : '90 dias';
            }

            const badgeColor = avaliacao.Origem === 'NOVA' ? '#7c3aed' : '#374151';
            const badgeBg = avaliacao.Origem === 'NOVA' ? '#f5f3ff' : '#f3f4f6';

            return `
                        <div class="avaliacao-item" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                        <h4 style="margin: 0;">${avaliacao.NomeCompleto}</h4>
                                        <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${tipoDias}</span>
                                    </div>
                                    <p style="margin: 0; color: #6b7280; font-size: 13px;">${avaliacao.Departamento || 'Departamento não informado'}</p>
                                </div>
                                <span class="badge" style="${this.getStatusBadgeStyle(statusExibido)}">${statusExibido}</span>
                            </div>
                            <button class="btn ${btnClass} btn-sm" onclick="${acaoBotao}">
                                ${this.renderIcon(iconeBotao, 16, 'margin-right: 6px;')}
                                ${textoBotao}
                            </button>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    async open(avaliacaoId) {
        // Verificar se é uma avaliação nova (pelo ID ou buscando na lista carregada)
        const avaliacaoNova = (this.todasAvaliacoes || []).find(a => a.Id === avaliacaoId && a.Origem === 'NOVA') ||
            (this.minhasAvaliacoes || []).find(a => a.Id === avaliacaoId && a.Origem === 'NOVA');

        if (avaliacaoNova) {
            try {
                const avaliacao = await API.get(`/api/avaliacoes/desempenho/${avaliacaoId}`);
                // Normalizar dados para o formato esperado pelas funções de renderização
                avaliacao.Origem = 'NOVA';
                avaliacao.TipoAvaliacao = 'Desempenho';
                this.state.avaliacaoAtual = avaliacao;

                const user = State.getUser();
                const eColaborador = avaliacao.UserId === user.userId;
                const eGestor = avaliacao.GestorId === user.userId;
                const eParticipante = eColaborador || eGestor;

                const jaRespondeu = eColaborador ? avaliacao.RespostaColaboradorConcluida : avaliacao.RespostaGestorConcluida;
                const estaExpirada = avaliacao.Status === 'Expirada'; // StatusAvaliacao vs Status
                const estaAgendada = avaliacao.Status === 'Agendada';
                const estaConcluida = avaliacao.Status === 'Concluida' || avaliacao.Status === 'Concluída';
                const ambasPartesResponderam = avaliacao.RespostaColaboradorConcluida && avaliacao.RespostaGestorConcluida;
                const emCalibragem = avaliacao.Status === 'Calibragem';
                const emFeedback = avaliacao.Status === 'Aguardando Feedback' || avaliacao.StatusAvaliacao === 'Realizar Feedback';

                const tituloModal = document.getElementById('titulo-avaliacao');

                // Exibir informações
                this.displayInfo(avaliacao, eColaborador, eGestor, eParticipante);

                // Lógica de exibição baseada no status
                if (estaAgendada && eParticipante) {
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clipboard-check"></i> Responder Avaliação';
                    this.showAgendadaMessage(avaliacao);
                } else if (!eParticipante && !this.hasAdminPermission()) {
                    // Usuário sem permissão
                    alert('Você não tem permissão para visualizar esta avaliação.');
                    return;
                } else if (emCalibragem && this.hasAdminPermission()) {
                    // Calibragem (RH)
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="sliders"></i> Calibragem da Avaliação';
                    await this.loadInterfaceCalibragem(avaliacao);
                } else if (!eParticipante && this.hasAdminPermission()) {
                    // Admin visualizando
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="eye"></i> Detalhes da Avaliação';
                    await this.loadRespostasComparativo(avaliacao, true);
                } else if (emFeedback && (eGestor || this.hasAdminPermission())) {
                    // Feedback (Gestor/RH)
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="message-square"></i> Feedback e PDI';
                    await this.loadInterfaceFeedbackPDI(avaliacao);
                } else if (jaRespondeu || estaConcluida || emCalibragem || emFeedback) {
                    // Já respondeu ou concluída
                    if (estaConcluida && eColaborador) {
                        // Colaborador só vê respostas quando concluída
                        if (tituloModal) tituloModal.innerHTML = '<i data-lucide="eye"></i> Ver Respostas';
                        await this.loadRespostasComparativo(avaliacao);
                    } else if (eColaborador) {
                        // Colaborador que já respondeu mas ainda não concluiu
                        if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clock"></i> Avaliação em Andamento';
                        this.showEmProcessamentoMessage();
                    } else if (eGestor && emCalibragem) {
                        if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clock"></i> Aguardando Calibragem';
                        this.showEmProcessamentoMessage(true);
                    } else if (eGestor || this.hasAdminPermission()) {
                        // Gestor e Admin podem ver respostas
                        if (tituloModal) tituloModal.innerHTML = '<i data-lucide="eye"></i> Ver Respostas';
                        await this.loadRespostasComparativo(avaliacao, this.hasAdminPermission());
                    } else {
                        this.showAguardandoMessage(avaliacao, eColaborador);
                    }
                } else if (estaExpirada) {
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="alert-circle"></i> Avaliação Expirada';
                    this.showExpiradaMessage(avaliacao);
                } else {
                    // Pendente e pode responder
                    if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clipboard-check"></i> Responder Avaliação';
                    await this.loadQuestionario(avaliacao);
                }

                const modal = document.getElementById('responder-avaliacao-modal');
                if (modal) modal.classList.remove('hidden');
                this.refreshIcons();

            } catch (error) {
                console.error('Erro ao abrir avaliação de desempenho:', error);
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Erro ao carregar avaliação', 'error');
                }
            }
            return;
        }

        try {
            const avaliacao = await API.get(`/api/avaliacoes/${avaliacaoId}`);
            this.state.avaliacaoAtual = avaliacao;
            const user = State.getUser();
            const eColaborador = avaliacao.UserId === user.userId;
            const eGestor = avaliacao.GestorId === user.userId;
            const eParticipante = eColaborador || eGestor;
            const jaRespondeu = eColaborador ? avaliacao.RespostaColaboradorConcluida : avaliacao.RespostaGestorConcluida;
            // Verificar expiração: 
            // O campo DataLimiteResposta já vem do backend com COALESCE(NovaDataLimiteResposta, DataLimiteResposta)
            // Se foi reaberta, o status será 'Pendente' e a DataLimiteResposta terá o valor de NovaDataLimiteResposta
            // Se o status é 'Pendente' ou 'Agendada', verificar apenas se a data limite já passou
            // Se o status é 'Expirada', está expirada independente da data
            const dataLimite = avaliacao.DataLimiteResposta ? new Date(avaliacao.DataLimiteResposta) : null;
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (dataLimite) {
                dataLimite.setHours(0, 0, 0, 0);
            }
            // Se status é 'Expirada', está expirada. Caso contrário, verificar se a data limite passou
            const estaExpirada = avaliacao.StatusAvaliacao === 'Expirada' || (avaliacao.StatusAvaliacao !== 'Expirada' && dataLimite && hoje > dataLimite);
            const estaAgendada = avaliacao.StatusAvaliacao === 'Agendada';
            const estaConcluida = avaliacao.StatusAvaliacao === 'Concluida' || avaliacao.StatusAvaliacao === 'Concluída';
            const ambasPartesResponderam = avaliacao.RespostaColaboradorConcluida && avaliacao.RespostaGestorConcluida;

            const tituloModal = document.getElementById('titulo-avaliacao');

            this.displayInfo(avaliacao, eColaborador, eGestor, eParticipante);

            if (estaAgendada && eParticipante) {
                if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clipboard-check"></i> Responder Avaliação';
                this.showAgendadaMessage(avaliacao);
            } else if (!eParticipante) {
                if (tituloModal) tituloModal.innerHTML = '<i data-lucide="eye"></i> Ver Detalhes';
                await this.loadRespostasComparativo(avaliacao, true);
            } else if (jaRespondeu || estaConcluida) {
                if (tituloModal) tituloModal.innerHTML = '<i data-lucide="eye"></i> Ver Respostas';
                if (ambasPartesResponderam) {
                    await this.loadRespostasComparativo(avaliacao);
                } else {
                    this.showAguardandoMessage(avaliacao, eColaborador);
                }
            } else if (estaExpirada) {
                if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clipboard-check"></i> Responder Avaliação';
                this.showExpiradaMessage(avaliacao);
            } else {
                if (tituloModal) tituloModal.innerHTML = '<i data-lucide="clipboard-check"></i> Responder Avaliação';
                await this.loadQuestionario(avaliacao);
            }

            const modal = document.getElementById('responder-avaliacao-modal');
            if (modal) modal.classList.remove('hidden');
            this.refreshIcons();
        } catch (error) {
            console.error('Erro ao abrir avaliação:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao carregar avaliação', 'error');
            }
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        return text
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    displayInfo(avaliacao, eColaborador, eGestor, eParticipante, modoVisualizacao = false, modoAdmin = false) {
        const container = document.getElementById('info-avaliacao');
        if (!container) return;

        let quartoCampoLabel, quartoCampoConteudo;
        if (modoAdmin) {
            quartoCampoLabel = 'Status das Respostas:';
            const statusColab = avaliacao.RespostaColaboradorConcluida ? '✅ Colaborador respondeu' : '⏳ Colaborador pendente';
            const statusGest = avaliacao.RespostaGestorConcluida ? '✅ Gestor respondeu' : '⏳ Gestor pendente';
            quartoCampoConteudo = `<p style="margin: 0; color: #6b7280; font-size: 13px;">${statusColab}<br>${statusGest}</p>`;
        } else if (modoVisualizacao) {
            quartoCampoLabel = 'Gestor Responsável:';
            quartoCampoConteudo = `<p style="margin: 0; color: #8b5cf6; font-weight: 600;">${this.renderIcon('user-cog', 18, 'margin-right: 6px;')}${avaliacao.NomeGestor || 'Não atribuído'}</p>`;
        } else if (eParticipante) {
            quartoCampoLabel = 'Você responde como:';
            const papel = eColaborador ? 'Colaborador' : 'Gestor';
            const cor = eColaborador ? '#0d556d' : '#7c3aed';
            const icone = eColaborador ? 'user' : 'user-cog';
            quartoCampoConteudo = `<p style="margin: 0; color: ${cor}; font-weight: 600;">${this.renderIcon(icone, 18, 'margin-right: 6px;')} ${papel}</p>`;
        } else {
            quartoCampoLabel = 'Gestor Responsável:';
            quartoCampoConteudo = `<p style="margin: 0; color: #8b5cf6; font-weight: 600;">${this.renderIcon('user-cog', 18, 'margin-right: 6px;')}${avaliacao.NomeGestor || 'Não atribuído'}</p>`;
        }

        const user = State.getUser();
        // Priorizar NovaDataLimiteResposta se existir (avaliação reaberta), caso contrário usar os outros campos
        const dataLimite = avaliacao.NovaDataLimiteResposta || 
                          avaliacao.DataLimiteAutoAvaliacao || 
                          avaliacao.DataLimiteGestor || 
                          avaliacao.DataLimiteResposta;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Tipo de Avaliação</p><p style="margin: 0; color: #111827; font-weight: 600;">${avaliacao.TipoAvaliacao}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Colaborador Avaliado</p><p style="margin: 0; color: #111827;">${avaliacao.NomeCompleto || 'Nome não disponível'}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Prazo de Resposta (Colaborador e Gestor)</p><p style="margin: 0; color: #111827;">${this.formatDate(dataLimite)}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">${quartoCampoLabel}</p>${quartoCampoConteudo}</div>
            </div>
        `;
    },

    showAgendadaMessage(avaliacao) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'none';

        const dataAdmissao = new Date(avaliacao.DataAdmissao);
        const hoje = new Date();
        const diasDesdeAdmissao = Math.floor((hoje - dataAdmissao) / (1000 * 60 * 60 * 24));
        const diasNecessarios = avaliacao.TipoAvaliacao.includes('45') ? 45 : 90;
        const diasFaltantes = diasNecessarios - diasDesdeAdmissao;

        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #eff6ff; border-radius: 12px; border: 2px solid #93c5fd;">
                ${this.renderIcon('calendar', 64, 'color: #3b82f6; margin-bottom: 24px;')}
                <h3 style="color: #1e40af; margin-bottom: 12px; justify-content: center;">Avaliação Agendada</h3>
                <p style="color: #1e3a8a; font-size: 16px;">Esta avaliação ainda não está disponível.</p>
                <p style="color: #3b82f6; font-size: 14px;">Faltam aproximadamente <strong>${diasFaltantes} dia(s)</strong>.</p>
            </div>
        `;
        this.switchTab('responder');
        this.refreshIcons();
    },

    showAguardandoMessage(avaliacao, eColaborador) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'none';

        const outraParte = eColaborador ? 'gestor' : 'colaborador';

        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #fef3c7; border-radius: 12px; border: 2px solid #fbbf24;">
                ${this.renderIcon('clock', 64, 'color: #f59e0b; margin-bottom: 24px;')}
                <h3 style="color: #92400e; margin-bottom: 12px; justify-content: center;">Avaliação Respondida</h3>
                <p style="color: #78350f; font-size: 16px;">Você já respondeu esta avaliação.</p>
                <p style="color: #b45309; font-size: 14px;">Aguardando resposta do <strong>${outraParte}</strong> para visualizar os resultados.</p>
            </div>
        `;
        this.switchTab('responder');
        this.refreshIcons();
    },

    showEmProcessamentoMessage(isGestor = false) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'none';

        const msgPrincipal = isGestor
            ? "Aguarde enquanto o RH realiza a calibragem das respostas."
            : "Aguarde enquanto o RH realiza a calibragem e o gestor prepara o feedback.";

        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #e0e7ff; border-radius: 12px; border: 2px solid #818cf8;">
                ${this.renderIcon('loader', 64, 'color: #4f46e5; margin-bottom: 24px;')}
                <h3 style="color: #3730a3; margin-bottom: 12px; justify-content: center;">Avaliação em Processamento</h3>
                <p style="color: #4338ca; font-size: 16px;">Sua avaliação foi respondida com sucesso!</p>
                <p style="color: #6366f1; font-size: 14px;">${msgPrincipal}</p>
                <p style="color: #818cf8; font-size: 13px; margin-top: 16px;">Você será notificado quando os resultados estiverem disponíveis.</p>
            </div>
        `;
        this.switchTab('responder');
        this.refreshIcons();
    },

    async loadRespostasComparativo(avaliacao, modoAdmin = false) {
        const tabResponder = document.getElementById('tab-responder');
        const tabVisualizar = document.getElementById('tab-visualizar');
        const btnEnviar = document.getElementById('btn-enviar-avaliacao');
        const acoes = document.getElementById('acoes-avaliacao');
        const avaliacoesTabs = document.querySelector('.avaliacoes-tabs');
        let container = document.getElementById('visualizacao-avaliacao');

        if (!container) {
            container = document.getElementById('formulario-avaliacao');
        }

        if (!container) {
            console.error('Container de visualização não encontrado');
            return;
        }

        if (tabResponder) tabResponder.style.display = 'none';
        if (tabVisualizar) tabVisualizar.style.display = 'none';
        if (btnEnviar) btnEnviar.style.display = 'none';
        if (acoes) acoes.style.display = 'none';
        if (avaliacoesTabs) avaliacoesTabs.style.display = 'none';

        this.displayInfo(avaliacao, false, false, false, !modoAdmin, modoAdmin);

        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="spinner"></div>
                <p style="color: #6b7280; margin-top: 16px;">Carregando respostas...</p>
            </div>
        `;

        try {
            let perguntas, respostasColaborador, respostasGestor;

            if (avaliacao.TipoAvaliacao === 'Desempenho' || avaliacao.Origem === 'NOVA') {
                // Buscar perguntas específicas da avaliação
                const perguntasRaw = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/questionario`);
                const respostasRaw = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/respostas`);

                // Normalizar perguntas
                perguntas = perguntasRaw.map(p => {
                    if (p.Opcoes && typeof p.Opcoes === 'string') {
                        try { p.opcoes = JSON.parse(p.Opcoes); } catch (e) { p.opcoes = []; }
                    } else {
                        p.opcoes = p.Opcoes || [];
                    }
                    if (p.opcoes.length > 0 && !p.opcoes[0].TextoOpcao) {
                        p.opcoes = p.opcoes.map(op => ({ TextoOpcao: op }));
                    }
                    return p;
                });

                // Mapear respostas
                const mapRespostas = new Map(respostasRaw.map(r => [r.PerguntaId, r]));

                respostasColaborador = perguntas.map(p => {
                    const r = mapRespostas.get(p.Id);
                    return {
                        Resposta: r ? r.RespostaColaborador : null,
                        RespostaCalibrada: r ? r.RespostaCalibrada : null,
                        JustificativaCalibrada: r ? r.JustificativaCalibrada : null
                    };
                });

                respostasGestor = perguntas.map(p => {
                    const r = mapRespostas.get(p.Id);
                    return { Resposta: r ? r.RespostaGestor : null };
                });

            } else {
                const data = await API.get(`/api/avaliacoes/${avaliacao.Id}/respostas`);
                perguntas = data.perguntas;
                const minhasRespostas = data.minhasRespostas;
                const respostasOutraParte = data.respostasOutraParte;
                const todasRespostas = [...minhasRespostas, ...respostasOutraParte];

                // Para legacy, precisamos garantir a ordem correta ou filtrar
                // O código original assumia que filter retornava na ordem das perguntas?
                // Vamos manter a lógica original de filter, mas é arriscado se não estiver ordenado.
                // Assumindo que o backend retorna ordenado ou que o filter preserva ordem relativa.
                respostasColaborador = todasRespostas.filter(r => r.TipoRespondente === 'colaborador');
                respostasGestor = todasRespostas.filter(r => r.TipoRespondente === 'gestor');
            }

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    ${perguntas.map((pergunta, index) => {
                const respostaColab = respostasColaborador[index];
                const respostaGest = respostasGestor[index];

                const tipoLabels = {
                    'texto': 'Texto Livre',
                    'multipla_escolha': 'Múltipla Escolha',
                    'escala': 'Escala',
                    'sim_nao': 'Sim/Não'
                };
                const tipoLabel = tipoLabels[pergunta.TipoPergunta || pergunta.Tipo] || pergunta.TipoPergunta || pergunta.Tipo;

                let infoAdicional = '';
                const tipo = pergunta.TipoPergunta || pergunta.Tipo;

                if (tipo === 'escala') {
                    const min = pergunta.EscalaMinima || 1;
                    const max = pergunta.EscalaMaxima || 5;
                    const labelMin = pergunta.EscalaLabelMinima || 'Mínimo';
                    const labelMax = pergunta.EscalaLabelMaxima || 'Máximo';
                    infoAdicional = `
                                <div style="margin-top: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Escala disponível:</p>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMin)}</span>
                                        <div style="display: flex; gap: 4px;">
                                            ${Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v =>
                        `<span style="padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: 600;">${v}</span>`
                    ).join('')}
                                        </div>
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMax)}</span>
                                    </div>
                                </div>
                            `;
                } else if (tipo === 'multipla_escolha' && pergunta.opcoes && pergunta.opcoes.length > 0) {
                    infoAdicional = `
                                <div style="margin-top: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções disponíveis:</p>
                                    <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 12px;">
                                        ${pergunta.opcoes.map(op => `<li>${this.escapeHtml(op.TextoOpcao)}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                }

                return `
                            <div style="padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
                                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 8px;">
                                    <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;">${index + 1}</span>
                                    <div style="flex: 1;">
                                        <p style="margin: 0 0 4px 0; color: #111827; font-size: 16px; font-weight: 500;">${this.escapeHtml(pergunta.Pergunta || pergunta.Texto)}</p>
                                        <span style="display: inline-block; padding: 2px 8px; background: #f3f4f6; color: #6b7280; border-radius: 4px; font-size: 11px; font-weight: 600;">${tipoLabel}</span>
                                    </div>
                                </div>
                                ${infoAdicional}
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                                    <div style="padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 13px;">${this.renderIcon('user', 16, 'margin-right: 6px;')} Colaborador</p>
                                        <p style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: 600;">${respostaColab && respostaColab.Resposta ? this.escapeHtml(respostaColab.Resposta) : '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                    <div style="padding: 12px; background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #6d28d9; font-weight: 600; font-size: 13px;">${this.renderIcon('user-cog', 16, 'margin-right: 6px;')} Gestor</p>
                                        <p style="margin: 0; color: #5b21b6; font-size: 14px; font-weight: 600;">${respostaGest && respostaGest.Resposta ? this.escapeHtml(respostaGest.Resposta) : '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                </div>
                                ${respostaColab && respostaColab.RespostaCalibrada ? `
                                    <div style="padding: 12px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px; margin-top: 16px;">
                                        <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 13px;">${this.renderIcon('sliders', 16, 'margin-right: 6px;')} Resposta Calibrada (RH)</p>
                                        <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">${this.escapeHtml(respostaColab.RespostaCalibrada)}</p>
                                        ${respostaColab.JustificativaCalibrada ? `
                                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #fbbf24;">
                                                <p style="margin: 0 0 4px 0; color: #92400e; font-weight: 600; font-size: 12px;">Justificativa:</p>
                                                <p style="margin: 0; color: #78350f; font-size: 13px;">${this.escapeHtml(respostaColab.JustificativaCalibrada)}</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `;
            }).join('')}
                </div>
            `;

            this.refreshIcons();
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #dc2626;">
                        ${this.renderIcon('alert-circle', 48, 'margin-bottom: 16px;')}
                        <p>Erro ao carregar respostas</p>
                    </div>
                `;
                this.refreshIcons();
            }
        }
    },

    showViewOnlyMode() {
        const tabResponder = document.getElementById('tab-responder');
        const tabVisualizar = document.getElementById('tab-visualizar');
        const btnEnviar = document.getElementById('btn-enviar-avaliacao');
        const acoes = document.getElementById('acoes-avaliacao');

        if (tabResponder) tabResponder.style.display = 'none';
        if (tabVisualizar) tabVisualizar.style.display = 'inline-flex';
        if (btnEnviar) btnEnviar.style.display = 'none';
        if (acoes) acoes.style.display = 'flex';
        this.switchTab('visualizar');
    },

    showExpiradaMessage(avaliacao) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'none';

        const isAdmin = this.hasAdminPermission();

        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #fef2f2; border-radius: 12px; border: 2px solid #fca5a5;">
                ${this.renderIcon('alert-triangle', 64, 'color: #dc2626; margin-bottom: 24px;')}
                <h3 style="color: #991b1b; margin-bottom: 12px; justify-content: center;">Avaliação Expirada</h3>
                <p style="color: #7f1d1d; font-size: 16px;">O prazo expirou em <strong>${this.formatDate(avaliacao.DataLimiteResposta)}</strong>.</p>
                ${isAdmin ? `
                    <div style="margin-top: 24px;">
                        <button class="btn btn-amber" onclick="Avaliacoes.abrirModalReabrirAvaliacao(${avaliacao.Id})">
                            ${this.renderIcon('refresh-cw', 16, 'margin-right: 6px;')}
                            Reabrir Avaliação
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        this.switchTab('responder');
        this.refreshIcons();
    },

    async loadQuestionario(avaliacao) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('btn-enviar-avaliacao').style.display = 'inline-flex';
        document.getElementById('acoes-avaliacao').style.display = 'flex';
        document.getElementById('tab-visualizar').style.display = 'none';

        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="spinner"></div>
                <p style="color: #6b7280; margin-top: 16px;">Carregando questionário...</p>
            </div>
        `;

        try {
            let perguntas;
            if (avaliacao.TipoAvaliacao === 'Desempenho' || avaliacao.Origem === 'NOVA') {
                perguntas = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/questionario`);
                // Normalizar opções se necessário
                perguntas = perguntas.map(p => {
                    if (p.Opcoes && typeof p.Opcoes === 'string') {
                        try { p.opcoes = JSON.parse(p.Opcoes); } catch (e) { p.opcoes = []; }
                    } else {
                        p.opcoes = p.Opcoes || [];
                    }
                    // Normalizar para o formato esperado pelo renderizador
                    if (p.opcoes.length > 0 && !p.opcoes[0].TextoOpcao) {
                        p.opcoes = p.opcoes.map(op => ({ TextoOpcao: op }));
                    }
                    return p;
                });
            } else {
                const tipo = avaliacao.TipoAvaliacao.includes('45') ? '45' : '90';
                perguntas = await API.get(`/api/avaliacoes/questionario/${tipo}`);

                // Carregar opções para perguntas de múltipla escolha
                for (const pergunta of perguntas) {
                    if (pergunta.TipoPergunta === 'multipla_escolha') {
                        pergunta.opcoes = await API.get(`/api/avaliacoes/questionario/${tipo}/perguntas/${pergunta.Id}/opcoes`);
                    }
                }
            }

            this.renderQuestionario(perguntas);
        } catch (error) {
            console.error('Erro ao carregar questionário:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #dc2626;">
                    ${this.renderIcon('alert-circle', 48, 'margin-bottom: 16px;')}
                    <p>Erro ao carregar questionário</p>
                </div>
            `;
        }

        this.switchTab('responder');
        this.refreshIcons();
    },

    renderQuestionario(perguntas) {
        const container = document.getElementById('formulario-avaliacao');

        if (!perguntas || perguntas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    ${this.renderIcon('inbox', 48, 'color: #9ca3af; margin-bottom: 16px;')}
                    <p style="color: #6b7280;">Nenhuma pergunta disponível</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 24px;">
                ${perguntas.map((pergunta, index) => this.renderPergunta(pergunta, index)).join('')}
            </div>
        `;
        this.refreshIcons();
    },

    renderPergunta(pergunta, index) {
        const textoPergunta = pergunta.Pergunta || pergunta.Texto;
        const tipoPergunta = pergunta.TipoPergunta || pergunta.Tipo;
        const obrigatorioMark = pergunta.Obrigatoria ? '<span style="color: #dc2626;">*</span>' : '';

        let inputHtml = '';

        switch (tipoPergunta) {
            case 'texto':
                inputHtml = `
                    <textarea 
                        class="form-textarea" 
                        id="resposta-${pergunta.Id}" 
                        data-pergunta-id="${pergunta.Id}"
                        placeholder="Digite sua resposta..."
                        rows="4"
                        ${pergunta.Obrigatoria ? 'required' : ''}
                    ></textarea>
                `;
                break;

            case 'multipla_escolha':
                inputHtml = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${(pergunta.opcoes || []).map(opcao => `
                            <label style="display: flex; align-items: center; padding: 12px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                                   onmouseover="this.style.borderColor='#f59e0b'; this.style.background='#fffbeb';"
                                   onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                                <input 
                                    type="radio" 
                                    name="resposta-${pergunta.Id}" 
                                    value="${this.escapeHtml(opcao.TextoOpcao)}"
                                    data-pergunta-id="${pergunta.Id}"
                                    style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                                    ${pergunta.Obrigatoria ? 'required' : ''}
                                >
                                <span style="color: #111827; font-size: 15px;">${this.escapeHtml(opcao.TextoOpcao)}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                break;

            case 'escala':
                const min = pergunta.EscalaMinima || 1;
                const max = pergunta.EscalaMaxima || 5;
                const labelMin = pergunta.EscalaLabelMinima || 'Mínimo';
                const labelMax = pergunta.EscalaLabelMaxima || 'Máximo';

                const opcoes = [];
                for (let i = min; i <= max; i++) {
                    opcoes.push(i);
                }

                inputHtml = `
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                            ${opcoes.map(valor => `
                                <label style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                                    <input 
                                        type="radio" 
                                        name="resposta-${pergunta.Id}" 
                                        value="${valor}"
                                        data-pergunta-id="${pergunta.Id}"
                                        style="width: 20px; height: 20px; cursor: pointer;"
                                        ${pergunta.Obrigatoria ? 'required' : ''}
                                    >
                                    <span style="font-weight: 600; color: #111827; font-size: 16px;">${valor}</span>
                                </label>
                            `).join('')}
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280;">
                            <span>${this.escapeHtml(labelMin)}</span>
                            <span>${this.escapeHtml(labelMax)}</span>
                        </div>
                    </div>
                `;
                break;

            case 'sim_nao':
                inputHtml = `
                    <div style="display: flex; gap: 16px;">
                        <label style="display: flex; align-items: center; padding: 12px 24px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; flex: 1; justify-content: center; transition: all 0.2s;"
                               onmouseover="this.style.borderColor='#10b981'; this.style.background='#ecfdf5';"
                               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                            <input 
                                type="radio" 
                                name="resposta-${pergunta.Id}" 
                                value="Sim"
                                data-pergunta-id="${pergunta.Id}"
                                style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                                ${pergunta.Obrigatoria ? 'required' : ''}
                            >
                            <span style="color: #111827; font-weight: 600; font-size: 15px;">Sim</span>
                        </label>
                        <label style="display: flex; align-items: center; padding: 12px 24px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; flex: 1; justify-content: center; transition: all 0.2s;"
                               onmouseover="this.style.borderColor='#ef4444'; this.style.background='#fef2f2';"
                               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                            <input 
                                type="radio" 
                                name="resposta-${pergunta.Id}" 
                                value="Não"
                                data-pergunta-id="${pergunta.Id}"
                                style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                                ${pergunta.Obrigatoria ? 'required' : ''}
                            >
                            <span style="color: #111827; font-weight: 600; font-size: 15px;">Não</span>
                        </label>
                    </div>
                `;
                break;
        }

        return `
            <div style="padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 16px;">
                    <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                        ${index + 1}
                    </span>
                    <div style="flex: 1;">
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500; line-height: 1.5;">
                            ${this.escapeHtml(textoPergunta)} ${obrigatorioMark}
                        </p>
                    </div>
                </div>
                ${inputHtml}
            </div>
        `;
    },

    async enviarRespostas() {
        if (!this.state.avaliacaoAtual) return;

        const user = State.getUser();
        const eColaborador = this.state.avaliacaoAtual.UserId === user.userId;
        const tipoRespondente = eColaborador ? 'colaborador' : 'gestor';

        // Coletar todas as respostas
        const respostas = [];
        const inputs = document.querySelectorAll('[data-pergunta-id]');

        for (const input of inputs) {
            const perguntaId = parseInt(input.getAttribute('data-pergunta-id'));
            let resposta = '';

            if (input.type === 'radio') {
                if (input.checked) {
                    resposta = input.value;
                } else {
                    continue;
                }
            } else if (input.tagName === 'TEXTAREA') {
                resposta = input.value.trim();
            }

            if (resposta) {
                const existente = respostas.find(r => r.perguntaId === perguntaId);
                if (!existente) {
                    respostas.push({ perguntaId, resposta });
                }
            }
        }

        // Validar campos obrigatórios
        const obrigatorios = document.querySelectorAll('#formulario-avaliacao [required]');
        const radioGroups = new Set();

        for (const campo of obrigatorios) {
            if (campo.type === 'radio') {
                const name = campo.name;
                if (radioGroups.has(name)) continue;
                radioGroups.add(name);

                const checked = document.querySelector(`#formulario-avaliacao input[name="${name}"]:checked`);
                if (!checked) {
                    if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                        window.EmailPopup.showToast('Por favor, responda todas as perguntas obrigatórias', 'error');
                    }
                    return;
                }
            } else if (campo.tagName === 'TEXTAREA' && !campo.value.trim()) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Por favor, responda todas as perguntas obrigatórias', 'error');
                }
                campo.focus();
                return;
            }
        }

        if (respostas.length === 0) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Por favor, responda pelo menos uma pergunta', 'error');
            }
            return;
        }

        try {
            if (this.state.avaliacaoAtual.TipoAvaliacao === 'Desempenho' || this.state.avaliacaoAtual.Origem === 'NOVA') {
                await API.post(`/api/avaliacoes/desempenho/${this.state.avaliacaoAtual.Id}/responder`, {
                    respostas
                });
            } else {
                await API.post('/api/avaliacoes/responder', {
                    avaliacaoId: this.state.avaliacaoAtual.Id,
                    respostas,
                    tipoRespondente
                });
            }

            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Respostas enviadas com sucesso!', 'success');
            }
            this.closeModal();
            this.loadMinhas();
            this.toggleView('minhas');
        } catch (error) {
            console.error('Erro ao enviar respostas:', error);
            const errorMsg = error.message || 'Erro ao enviar respostas. Tente novamente.';
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast(errorMsg, 'error');
            }
        }
    },

    closeModal() {
        const modal = document.getElementById('responder-avaliacao-modal');
        if (modal) modal.classList.add('hidden');
        this.state.avaliacaoAtual = null;
        this.state.respostasAvaliacao = {};
    },

    toggleView(view) {
        // Verificar se o usuário tem permissão para ver todas as avaliações
        const hasAccess = this.hasHRTDAccess === true;

        // Se tentar acessar "todas" sem permissão, bloquear e mostrar apenas "minhas"
        if (view === 'todas' && !hasAccess) {
            view = 'minhas';
        }

        const buttons = document.querySelectorAll('.btn-toggle');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-view') === view) {
                btn.classList.add('active');
            }
        });

        const minhasView = document.getElementById('minhas-avaliacoes-view');
        const todasView = document.getElementById('todas-avaliacoes-view');

        if (view === 'minhas') {
            minhasView.style.display = 'block';
            todasView.style.display = 'none';
            this.loadMinhas();
        } else if (view === 'todas' && hasAccess) {
            minhasView.style.display = 'none';
            todasView.style.display = 'block';
            this.loadTodas();
        }
    },

    async checkPermissions() {
        try {
            const user = State.getUser();

            // Verificar apenas os departamentos específicos: SUPERVISAO RH ou DEPARTAMENTO TREINAM&DESENVOLV
            const dept = (user?.descricaoDepartamento || user?.DescricaoDepartamento || '').toUpperCase().trim();
            const isHRTD = dept === 'SUPERVISAO RH' || 
                dept.includes('DEPARTAMENTO TREINAM&DESENVOLV');

            // Armazenar permissão para uso em outras funções
            this.hasHRTDAccess = isHRTD;

            const toggleButtons = document.getElementById('avaliacoes-toggle-buttons');
            if (toggleButtons) {
                toggleButtons.style.display = isHRTD ? 'block' : 'none';
            }

            const btnEditarTemplates = document.getElementById('btn-editar-templates');
            if (btnEditarTemplates) {
                btnEditarTemplates.style.display = isHRTD ? 'inline-flex' : 'none';
            }

            // Garantir que usuários sem permissão sempre vejam apenas "Minhas Avaliações"
            if (!isHRTD) {
                const minhasView = document.getElementById('minhas-avaliacoes-view');
                const todasView = document.getElementById('todas-avaliacoes-view');
                if (minhasView) minhasView.style.display = 'block';
                if (todasView) todasView.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao verificar permissões:', error);
            // Em caso de erro, garantir que não tenha acesso
            this.hasHRTDAccess = false;
        }
    },

    abrirModalReabrirAvaliacao(avaliacaoId) {
        const modal = document.getElementById('reabrir-avaliacao-modal');
        const inputData = document.getElementById('nova-data-limite-avaliacao');
        const hiddenId = document.getElementById('avaliacao-id-reabrir');
        
        if (!modal || !inputData || !hiddenId) {
            console.error('Elementos do modal de reabrir avaliação não encontrados');
            return;
        }

        // Armazenar o ID da avaliação no campo hidden
        hiddenId.value = avaliacaoId;
        
        // Limpar o campo de data
        inputData.value = '';
        
        // Abrir o modal
        modal.classList.remove('hidden');
        this.refreshIcons();
        
        // Focar no campo de data
        setTimeout(() => inputData.focus(), 100);
    },

    async confirmarReaberturaAvaliacao() {
        const inputData = document.getElementById('nova-data-limite-avaliacao');
        const hiddenId = document.getElementById('avaliacao-id-reabrir');
        
        if (!inputData || !hiddenId) {
            console.error('Elementos do modal não encontrados');
            return;
        }

        const avaliacaoId = hiddenId.value;
        const dataSelecionada = inputData.value;

        if (!dataSelecionada) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Por favor, selecione uma data limite', 'error');
            }
            return;
        }

        // Converter formato YYYY-MM-DD para o formato esperado pelo backend
        // O backend agora aceita formato YYYY-MM-DD diretamente
        const novaDataLimite = dataSelecionada;

        try {
            await API.post(`/api/avaliacoes/${avaliacaoId}/reabrir`, { novaDataLimite });
            
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Avaliação reaberta com sucesso!', 'success');
            }
            
            // Fechar o modal
            this.fecharModalReabrirAvaliacao();
            
            // Recarregar as avaliações
            if (this.hasHRTDAccess) {
                this.loadTodas();
            } else {
                this.loadMinhas();
            }
        } catch (error) {
            console.error('Erro ao reabrir avaliação:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                const errorMsg = error.message || 'Erro ao reabrir avaliação';
                window.EmailPopup.showToast(errorMsg, 'error');
            }
        }
    },

    fecharModalReabrirAvaliacao() {
        const modal = document.getElementById('reabrir-avaliacao-modal');
        const inputData = document.getElementById('nova-data-limite-avaliacao');
        const hiddenId = document.getElementById('avaliacao-id-reabrir');
        
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (inputData) {
            inputData.value = '';
        }
        
        if (hiddenId) {
            hiddenId.value = '';
        }
    },

    aplicarFiltros() {
        if (!this.todasAvaliacoes) return;

        const filtroNome = document.getElementById('filtro-nome')?.value || '';
        const filtroDept = document.getElementById('filtro-departamento')?.value || '';
        const filtroStatus = document.getElementById('filtro-status')?.value || '';
        const filtroTipo = document.getElementById('filtro-tipo')?.value || '';

        let filtradas = [...this.todasAvaliacoes];

        // Filtro por nome (case-insensitive)
        if (filtroNome.trim()) {
            const nomeLower = filtroNome.toLowerCase().trim();
            filtradas = filtradas.filter(av =>
                (av.NomeCompleto || '').toLowerCase().includes(nomeLower)
            );
        }

        // Filtro por departamento (case-insensitive)
        if (filtroDept.trim()) {
            const deptLower = filtroDept.toLowerCase().trim();
            filtradas = filtradas.filter(av =>
                (av.Departamento || '').toLowerCase().includes(deptLower) ||
                (av.DescricaoDepartamento || '').toLowerCase().includes(deptLower)
            );
        }

        // Filtro por status
        if (filtroStatus) {
            filtradas = filtradas.filter(av => {
                const user = State.getUser();
                const isParticipante = av.UserId === user.userId || av.GestorId === user.userId;
                let jaRespondeu = false;
                if (av.UserId === user.userId) {
                    jaRespondeu = av.RespostaColaboradorConcluida;
                } else if (av.GestorId === user.userId) {
                    jaRespondeu = av.RespostaGestorConcluida;
                }
                const ambasPartesResponderam = av.RespostaColaboradorConcluida && av.RespostaGestorConcluida;

                let statusCalculado;
                if (jaRespondeu) {
                    if (ambasPartesResponderam) {
                        statusCalculado = 'Concluida';
                    } else if (av.RespostaColaboradorConcluida && !av.RespostaGestorConcluida) {
                        statusCalculado = 'Aguardando Gestor';
                    } else if (!av.RespostaColaboradorConcluida && av.RespostaGestorConcluida) {
                        statusCalculado = 'Aguardando Colaborador';
                    } else {
                        statusCalculado = 'Em Andamento';
                    }
                } else {
                    statusCalculado = av.StatusAvaliacao || av.Status;
                }

                return statusCalculado === filtroStatus || av.StatusAvaliacao === filtroStatus || av.Status === filtroStatus;
            });
        }

        // Filtro por tipo (45 ou 90 dias)
        if (filtroTipo) {
            filtradas = filtradas.filter(av =>
                (av.TipoAvaliacao || '').includes(filtroTipo)
            );
        }

        this.updateTodasList(filtradas);
    },

    limparFiltros() {
        const filtroNome = document.getElementById('filtro-nome');
        const filtroDept = document.getElementById('filtro-departamento');
        const filtroStatus = document.getElementById('filtro-status');
        const filtroTipo = document.getElementById('filtro-tipo');

        if (filtroNome) filtroNome.value = '';
        if (filtroDept) filtroDept.value = '';
        if (filtroStatus) filtroStatus.value = '';
        if (filtroTipo) filtroTipo.value = '';

        this.updateTodasList(this.todasAvaliacoes);
    },

    async abrirModalCriacao() {
        try {
            // Limpar estado de perguntas
            this.state.perguntasNovaAvaliacao = [];
            this.state.perguntaEditandoIndex = null;
            this.state.opcoesTemporarias = [];

            // Carregar usuários para o select
            const users = await API.get('/api/users/feedback');
            const activeUsers = users.filter(u => u.Ativo !== false && u.Ativo !== 0);

            // Remover modal anterior se existir
            const existingModal = document.getElementById('criar-avaliacao-modal');
            if (existingModal) existingModal.remove();

            // Criar e adicionar novo modal
            const modalHtml = this.renderCriarModal(activeUsers);
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Adicionar event listeners
            document.getElementById('form-criar-avaliacao').addEventListener('submit', (e) => {
                e.preventDefault();
                this.criarAvaliacao();
            });

            // Mostrar modal
            document.getElementById('criar-avaliacao-modal').classList.remove('hidden');
            this.refreshIcons();
        } catch (error) {
            console.error('Erro ao abrir modal de criação:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao carregar usuários', 'error');
            }
        }
    },

    fecharModalCriacao() {
        const modal = document.getElementById('criar-avaliacao-modal');
        if (modal) modal.remove();

        // Limpar estado de perguntas
        this.state.perguntasNovaAvaliacao = [];
        this.state.perguntaEditandoIndex = null;
        this.state.opcoesTemporarias = [];
    },

    renderCriarModal(usuarios) {
        // Ordenar usuários por nome
        usuarios.sort((a, b) => (a.nomeCompleto || a.NomeCompleto || a.Nome || '').localeCompare(b.nomeCompleto || b.NomeCompleto || b.Nome || ''));

        return `
            <div id="criar-avaliacao-modal" class="modal-overlay">
                <div class="modal modal-large">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">
                                ${this.renderIcon('plus-circle', 24)}
                                Nova Avaliação de Desempenho
                            </h3>
                            <button class="btn-close-modal" onclick="Avaliacoes.fecharModalCriacao()">
                                ${this.renderIcon('x', 24)}
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="form-criar-avaliacao">
                                <div class="form-group">
                                    <label class="form-label">Título da Avaliação</label>
                                    <input type="text" id="criar-titulo" class="form-input" placeholder="Ex: Avaliação de Desempenho 2024.1" required>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Prazo de Resposta</label>
                                    <input type="date" id="criar-prazo" class="form-input" required>
                                    <p style="font-size: 12px; color: var(--color-gray-500); margin-top: 6px;">
                                        ${this.renderIcon('info', 14, 'display: inline; margin-right: 4px;')}
                                        Colaborador e gestor terão o mesmo prazo para responder.
                                    </p>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Colaboradores</label>
                                    <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md); padding: var(--spacing-md);">
                                        <div style="margin-bottom: var(--spacing-sm);">
                                            <input type="text" placeholder="Filtrar colaboradores..." onkeyup="Avaliacoes.filtrarColaboradoresCriacao(this.value)" class="form-input search-input" style="width: 100%;">
                                        </div>
                                        <div id="lista-colaboradores-criacao">
                                            <label style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-gray-100); cursor: pointer;">
                                                <input type="checkbox" onchange="Avaliacoes.toggleTodosColaboradores(this.checked)" style="margin-right: 12px; width: 16px; height: 16px;">
                                                <span style="font-weight: 600; color: var(--color-gray-700);">Selecionar Todos</span>
                                            </label>
                                            ${usuarios.map(u => `
                                                <label class="colaborador-item" style="display: flex; align-items: center; padding: 8px 0; cursor: pointer; border-bottom: 1px solid var(--color-gray-50);">
                                                    <input type="checkbox" name="colaboradores" value="${u.userId || u.Id}" style="margin-right: 12px; width: 16px; height: 16px;">
                                                    <span style="color: var(--color-gray-600);">${u.nomeCompleto || u.NomeCompleto || u.Nome || 'Sem Nome'} <span style="color: var(--color-gray-400); font-size: 12px;">(${u.descricaoDepartamento || u.DescricaoDepartamento || u.departamento || u.Departamento || 'Sem Dept'})</span></span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <p style="font-size: 12px; color: var(--color-gray-500); margin-top: 6px;">Selecione os colaboradores que participarão desta avaliação.</p>
                                </div>

                                <!-- Seção de Perguntas Personalizadas -->
                                <div class="form-group">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <label class="form-label" style="margin: 0;">Perguntas da Avaliação</label>
                                        <button type="button" class="btn btn-sm btn-amber" onclick="Avaliacoes.abrirModalNovaPerguntaAvaliacao()">
                                            ${this.renderIcon('plus', 16)}
                                            Nova Pergunta
                                        </button>
                                    </div>
                                    <div id="lista-perguntas-nova-avaliacao" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--color-gray-200); border-radius: var(--radius-md); padding: var(--spacing-md); background: var(--color-gray-50);">
                                        <div style="text-align: center; padding: 40px 20px; background: var(--color-gray-50); border-radius: var(--radius-md);">
                                            <i data-lucide="inbox" style="width: 48px; height: 48px; color: var(--color-gray-400); margin-bottom: 12px;"></i>
                                            <p style="color: var(--color-gray-500); margin: 0;">Nenhuma pergunta adicionada</p>
                                            <p style="color: var(--color-gray-400); font-size: 14px; margin: 8px 0 0 0;">Clique em "Nova Pergunta" para adicionar</p>
                                        </div>
                                    </div>
                                    <p style="font-size: 12px; color: var(--color-gray-500); margin-top: 6px;">
                                        ${this.renderIcon('info', 14, 'display: inline; margin-right: 4px;')}
                                        Se nenhuma pergunta for adicionada, será usado o questionário padrão.
                                    </p>
                                </div>

                                <div class="modal-footer">
                                    <button type="submit" class="btn btn-amber" style="width: 100%; justify-content: center;">Criar Avaliação</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    filtrarColaboradoresCriacao(texto) {
        const items = document.querySelectorAll('#lista-colaboradores-criacao .colaborador-item');
        const termo = texto.toLowerCase();
        items.forEach(item => {
            const nome = item.textContent.toLowerCase();
            item.style.display = nome.includes(termo) ? 'flex' : 'none';
        });
    },

    toggleTodosColaboradores(checked) {
        const checkboxes = document.querySelectorAll('#lista-colaboradores-criacao input[name="colaboradores"]');
        checkboxes.forEach(cb => {
            if (cb.closest('.colaborador-item').style.display !== 'none') {
                cb.checked = checked;
            }
        });
    },

    async criarAvaliacao() {
        const titulo = document.getElementById('criar-titulo').value;
        const prazo = document.getElementById('criar-prazo').value;

        const checkboxes = document.querySelectorAll('#lista-colaboradores-criacao input[name="colaboradores"]:checked');
        const userIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (userIds.length === 0) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Selecione pelo menos um colaborador', 'error');
            } else {
                alert('Selecione pelo menos um colaborador');
            }
            return;
        }

        try {
            const payload = {
                titulo,
                dataLimite: prazo,
                userIds
            };

            // Adicionar perguntas personalizadas se houver
            if (this.state.perguntasNovaAvaliacao.length > 0) {
                payload.perguntas = this.state.perguntasNovaAvaliacao;
            }

            const response = await API.post('/api/avaliacoes/desempenho/criar', payload);

            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Avaliações criadas com sucesso!', 'success');
            } else {
                alert('Avaliações criadas com sucesso!');
            }

            this.fecharModalCriacao();
            this.loadTodas(); // Recarregar lista
        } catch (error) {
            console.error('Erro ao criar avaliações:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao criar avaliações: ' + (error.message || 'Erro desconhecido'), 'error');
            } else {
                alert('Erro ao criar avaliações');
            }
        }
    },

    // ========== CRUD de Perguntas para Nova Avaliação ==========

    abrirModalNovaPerguntaAvaliacao() {

        try {
            this.state.perguntaEditandoIndex = null;
            this.state.opcoesTemporarias = [];

            // Limpar campos do modal
            document.getElementById('input-pergunta-texto').value = '';
            document.getElementById('input-tipo-pergunta').value = 'texto';
            document.getElementById('input-obrigatoria').value = 'true';
            document.getElementById('input-escala-minima').value = '1';
            document.getElementById('input-escala-maxima').value = '5';
            document.getElementById('input-escala-label-minima').value = '';
            document.getElementById('input-escala-label-maxima').value = '';
            document.getElementById('titulo-modal-pergunta').textContent = 'Nova Pergunta';

            // Esconder campos específicos
            document.getElementById('campos-escala').style.display = 'none';
            document.getElementById('campos-multipla-escolha').style.display = 'none';
            document.getElementById('lista-opcoes-multipla').innerHTML = '';


            const modal = document.getElementById('modal-pergunta-avaliacao');
            modal.setAttribute('data-mode', 'avaliacao');
            Modal.open('modal-pergunta-avaliacao');

            // Override buttons
            const btnSalvar = document.getElementById('btn-salvar-pergunta');
            const btnCancelar = document.getElementById('btn-cancelar-pergunta');

            if (btnSalvar) {
                // Remover onclick antigo para evitar conflitos
                btnSalvar.removeAttribute('onclick');
                btnSalvar.onclick = () => this.salvarPerguntaNovaAvaliacao();
            }
            if (btnCancelar) {
                btnCancelar.removeAttribute('onclick');
                btnCancelar.onclick = () => this.fecharModalPerguntaAvaliacao();
            }

            const btnAdicionarOpcao = document.getElementById('btn-adicionar-opcao');
            if (btnAdicionarOpcao) {
                btnAdicionarOpcao.removeAttribute('onclick');
                btnAdicionarOpcao.onclick = () => this.adicionarOpcaoAvaliacao();
            }


        } catch (error) {
            console.error('❌ Erro ao abrir modal de pergunta:', error);
            alert('Erro ao abrir modal: ' + error.message);
        }
    },

    editarPerguntaNovaAvaliacao(index) {
        this.state.perguntaEditandoIndex = index;
        const pergunta = this.state.perguntasNovaAvaliacao[index];

        // Preencher campos
        document.getElementById('input-pergunta-texto').value = pergunta.texto;
        document.getElementById('input-tipo-pergunta').value = pergunta.tipo;
        document.getElementById('input-obrigatoria').value = pergunta.obrigatoria.toString();
        document.getElementById('titulo-modal-pergunta').textContent = 'Editar Pergunta';

        // Campos específicos por tipo
        if (pergunta.tipo === 'escala') {
            document.getElementById('input-escala-minima').value = pergunta.escalaMinima || 1;
            document.getElementById('input-escala-maxima').value = pergunta.escalaMaxima || 5;
            document.getElementById('input-escala-label-minima').value = pergunta.escalaLabelMinima || '';
            document.getElementById('input-escala-label-maxima').value = pergunta.escalaLabelMaxima || '';
            document.getElementById('campos-escala').style.display = 'block';
        } else {
            document.getElementById('campos-escala').style.display = 'none';
        }

        if (pergunta.tipo === 'multipla_escolha') {
            this.state.opcoesTemporarias = [...(pergunta.opcoes || [])];
            this.renderizarOpcoesMultipla();
            document.getElementById('campos-multipla-escolha').style.display = 'block';
        } else {
            this.state.opcoesTemporarias = [];
            document.getElementById('campos-multipla-escolha').style.display = 'none';
        }

        const modal = document.getElementById('modal-pergunta-avaliacao');
        modal.setAttribute('data-mode', 'avaliacao');
        Modal.open('modal-pergunta-avaliacao');

        // Override buttons
        const btnSalvar = document.getElementById('btn-salvar-pergunta');
        const btnCancelar = document.getElementById('btn-cancelar-pergunta');

        if (btnSalvar) {
            btnSalvar.removeAttribute('onclick');
            btnSalvar.onclick = () => this.salvarPerguntaNovaAvaliacao();
        }
        if (btnCancelar) {
            btnCancelar.removeAttribute('onclick');
            btnCancelar.onclick = () => this.fecharModalPerguntaAvaliacao();
        }

        const btnAdicionarOpcao = document.getElementById('btn-adicionar-opcao');
        if (btnAdicionarOpcao) {
            btnAdicionarOpcao.removeAttribute('onclick');
            btnAdicionarOpcao.onclick = () => this.adicionarOpcaoAvaliacao();
        }
    },

    toggleCamposEscalaAvaliacao() {
        const tipo = document.getElementById('input-tipo-pergunta').value;
        const camposEscala = document.getElementById('campos-escala');
        const camposMultipla = document.getElementById('campos-multipla-escolha');

        camposEscala.style.display = tipo === 'escala' ? 'block' : 'none';
        camposMultipla.style.display = tipo === 'multipla_escolha' ? 'block' : 'none';

        if (tipo === 'multipla_escolha' && this.state.opcoesTemporarias.length === 0) {
            this.state.opcoesTemporarias = [];
            this.renderizarOpcoesMultipla();
        }
    },

    adicionarOpcaoAvaliacao() {
        const input = document.getElementById('nova-opcao-input');
        const texto = input.value.trim();

        if (!texto) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Digite o texto da opção', 'error');
            }
            return;
        }

        this.state.opcoesTemporarias.push(texto);
        input.value = '';
        this.renderizarOpcoesMultipla();
    },

    removerOpcaoAvaliacao(index) {
        this.state.opcoesTemporarias.splice(index, 1);
        this.renderizarOpcoesMultipla();
    },

    renderizarOpcoesMultipla() {
        const container = document.getElementById('lista-opcoes-multipla');
        container.innerHTML = this.state.opcoesTemporarias.map((opcao, index) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                <span style="flex: 1; color: #374151;">${opcao}</span>
                <button type="button" class="btn-icon" onclick="Avaliacoes.removerOpcaoAvaliacao(${index})" style="color: #dc2626;">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        `).join('');
        this.refreshIcons();
    },

    salvarPerguntaNovaAvaliacao() {

        const texto = document.getElementById('input-pergunta-texto').value.trim();
        const tipo = document.getElementById('input-tipo-pergunta').value;
        const obrigatoria = document.getElementById('input-obrigatoria').value === 'true';



        if (!texto) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Digite o texto da pergunta', 'error');
            }
            return;
        }

        // Validações específicas por tipo
        if (tipo === 'multipla_escolha' && this.state.opcoesTemporarias.length < 2) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Adicione pelo menos 2 opções', 'error');
            }
            return;
        }

        const pergunta = {
            texto,
            tipo,
            obrigatoria,
            ordem: this.state.perguntaEditandoIndex !== null
                ? this.state.perguntasNovaAvaliacao[this.state.perguntaEditandoIndex].ordem
                : this.state.perguntasNovaAvaliacao.length + 1
        };

        // Campos específicos por tipo
        if (tipo === 'escala') {
            pergunta.escalaMinima = parseInt(document.getElementById('input-escala-minima').value);
            pergunta.escalaMaxima = parseInt(document.getElementById('input-escala-maxima').value);
            pergunta.escalaLabelMinima = document.getElementById('input-escala-label-minima').value.trim();
            pergunta.escalaLabelMaxima = document.getElementById('input-escala-label-maxima').value.trim();

            if (pergunta.escalaMinima >= pergunta.escalaMaxima) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Valor mínimo deve ser menor que o máximo', 'error');
                }
                return;
            }
        }

        if (tipo === 'multipla_escolha') {
            pergunta.opcoes = [...this.state.opcoesTemporarias];
        }



        // Adicionar ou atualizar pergunta
        if (this.state.perguntaEditandoIndex !== null) {
            this.state.perguntasNovaAvaliacao[this.state.perguntaEditandoIndex] = pergunta;
        } else {
            this.state.perguntasNovaAvaliacao.push(pergunta);
        }



        this.renderizarPerguntasNovaAvaliacao();
        Modal.close('modal-pergunta-avaliacao');

        if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
            window.EmailPopup.showToast('Pergunta salva!', 'success');
        }
    },

    async excluirPerguntaNovaAvaliacao(index) {
        const confirmado = await this.showConfirmDialog(
            'Excluir Pergunta',
            'Deseja realmente excluir esta pergunta?',
            'Excluir'
        );

        if (confirmado) {
            try {
                this.state.perguntasNovaAvaliacao.splice(index, 1);
                this.state.perguntasNovaAvaliacao.forEach((p, i) => p.ordem = i + 1);
                this.renderizarPerguntasNovaAvaliacao();

                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Pergunta excluída com sucesso!', 'success');
                }
            } catch (error) {
                console.error('Erro ao excluir pergunta:', error);
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Erro ao excluir pergunta', 'error');
                }
            }
        }
    },

    showConfirmDialog(titulo, mensagem, textoBotaoConfirmar = 'Confirmar') {
        return new Promise((resolve) => {
            const modalHtml = `
                <div id="confirm-dialog-modal" class="modal-overlay" style="z-index: 10000;">
                    <div class="modal" style="max-width: 450px;">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3 class="modal-title">
                                    ${this.renderIcon('alert-circle', 24)}
                                    ${titulo}
                                </h3>
                                <button class="btn-close-modal" id="confirm-dialog-close">
                                    ${this.renderIcon('x', 24)}
                                </button>
                            </div>
                            <div class="modal-body" style="padding: 1rem 0 1rem 0;">
                                <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0;">${mensagem}</p>
                            </div>
                            <div class="modal-footer">
                                <button class="btn" id="confirm-dialog-confirm" style="width: 100%; justify-content: center; background: #dc2626; color: white; transition: background-color 0.2s;" onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">${textoBotaoConfirmar}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            this.refreshIcons();

            const modal = document.getElementById('confirm-dialog-modal');
            const btnConfirm = document.getElementById('confirm-dialog-confirm');
            const btnClose = document.getElementById('confirm-dialog-close');

            const cleanup = () => modal.remove();

            btnConfirm.onclick = () => {
                cleanup();
                resolve(true);
            };

            btnClose.onclick = () => {
                cleanup();
                resolve(false);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    },

    renderizarPerguntasNovaAvaliacao() {

        const container = document.getElementById('lista-perguntas-nova-avaliacao');

        if (!container) {
            return;
        }



        if (this.state.perguntasNovaAvaliacao.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #f9fafb; border-radius: 8px;">
                    <i data-lucide="inbox" style="width: 48px; height: 48px; color: #9ca3af; margin-bottom: 12px;"></i>
                    <p style="color: #6b7280; margin: 0;">Nenhuma pergunta adicionada</p>
                    <p style="color: #9ca3af; font-size: 14px; margin: 8px 0 0 0;">Clique em "Nova Pergunta" para adicionar</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }



        container.innerHTML = this.state.perguntasNovaAvaliacao.map((p, index) => {
            const tipoLabel = {
                'texto': 'Texto Livre',
                'multipla_escolha': 'Múltipla Escolha',
                'escala': 'Escala Numérica',
                'sim_nao': 'Sim/Não'
            }[p.tipo] || p.tipo;

            return `
                <div class="pergunta-item" draggable="true" data-index="${index}">
                    <span class="pergunta-item-ordem">${index + 1}</span>
                    <div class="pergunta-item-drag-handle">
                        <i data-lucide="grip-vertical" style="width: 20px; height: 20px;"></i>
                    </div>
                    <div class="pergunta-item-content">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div style="flex: 1;">
                                <p style="margin: 0 0 8px 0; color: #111827; font-weight: 500; font-size: 15px;">${this.escapeHtml(p.texto)}</p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-size: 12px; color: #6b7280; background: #f3f4f6; padding: 4px 10px; border-radius: 12px; font-weight: 500;">
                                        ${tipoLabel}
                                    </span>
                                    ${p.obrigatoria ? '<span style="font-size: 12px; color: #dc2626; background: #fee2e2; padding: 4px 10px; border-radius: 12px; font-weight: 500;">★ Obrigatória</span>' : ''}
                                    ${p.tipo === 'multipla_escolha' ? `<span style="font-size: 12px; color: #7c3aed; background: #f3e8ff; padding: 4px 10px; border-radius: 12px; font-weight: 500;">${p.opcoes.length} opções</span>` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; margin-left: 12px;">
                                <button type="button" class="btn-icon" onclick="Avaliacoes.editarPerguntaNovaAvaliacao(${index})" title="Editar">
                                    <i data-lucide="edit-2" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                </button>
                                <button type="button" class="btn-icon" onclick="Avaliacoes.excluirPerguntaNovaAvaliacao(${index})" title="Excluir">
                                    <i data-lucide="trash-2" style="width: 16px; height: 16px; color: #dc2626;"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Adicionar eventos de drag and drop
        this.initDragAndDrop();

        // Adicionar eventos de drag and drop
        this.initDragAndDrop();

        this.refreshIcons();
    },

    initDragAndDrop() {
        const items = document.querySelectorAll('.pergunta-item[draggable="true"]');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.innerHTML);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.pergunta-item').forEach(i => i.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                const dragging = document.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    const fromIndex = parseInt(dragging.dataset.index);
                    const toIndex = parseInt(item.dataset.index);

                    // Reordenar array
                    const [movedItem] = this.state.perguntasNovaAvaliacao.splice(fromIndex, 1);
                    this.state.perguntasNovaAvaliacao.splice(toIndex, 0, movedItem);

                    // Atualizar ordem
                    this.state.perguntasNovaAvaliacao.forEach((p, i) => p.ordem = i + 1);

                    // Re-renderizar
                    this.renderizarPerguntasNovaAvaliacao();
                }
            });
        });
    },

    fecharModalPerguntaAvaliacao() {
        Modal.close('modal-pergunta-avaliacao');
        this.state.perguntaEditandoIndex = null;
        this.state.opcoesTemporarias = [];
    },



    async loadInterfaceCalibragem(avaliacao) {
        const tabResponder = document.getElementById('tab-responder');
        const tabVisualizar = document.getElementById('tab-visualizar');
        const btnEnviar = document.getElementById('btn-enviar-avaliacao');
        const acoes = document.getElementById('acoes-avaliacao');
        const avaliacoesTabs = document.querySelector('.avaliacoes-tabs');
        let container = document.getElementById('formulario-avaliacao');

        if (tabResponder) tabResponder.style.display = 'none';
        if (tabVisualizar) tabVisualizar.style.display = 'none';
        if (btnEnviar) btnEnviar.style.display = 'inline-flex';
        if (acoes) acoes.style.display = 'flex';
        if (avaliacoesTabs) avaliacoesTabs.style.display = 'none';

        // Modificar botão de enviar para calibragem
        if (btnEnviar) {
            btnEnviar.textContent = 'Salvar Calibragem';
            btnEnviar.onclick = () => this.enviarCalibragem();
        }

        this.displayInfo(avaliacao, false, false, false, false, true);

        container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p style="color: #6b7280; margin-top: 16px;">Carregando...</p></div>';

        try {
            const perguntas = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/questionario`);
            const respostasRaw = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/respostas`);
            const mapRespostas = new Map(respostasRaw.map(r => [r.PerguntaId, r]));

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    ${perguntas.map((p, index) => {
                const r = mapRespostas.get(p.Id);

                // Renderizar opções disponíveis
                let opcoesHtml = '';
                if (p.Tipo === 'escala') {
                    const min = p.EscalaMinima || 1;
                    const max = p.EscalaMaxima || 5;
                    const labelMin = p.EscalaLabelMinima || 'Mínimo';
                    const labelMax = p.EscalaLabelMaxima || 'Máximo';
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Escala disponível:</p>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMin)}</span>
                                        <div style="display: flex; gap: 4px;">
                                            ${Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v =>
                        `<span style="padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: 600;">${v}</span>`
                    ).join('')}
                                        </div>
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMax)}</span>
                                    </div>
                                </div>
                            `;
                } else if (p.Tipo === 'multipla_escolha' && p.Opcoes && p.Opcoes.length > 0) {
                    const opcoes = typeof p.Opcoes === 'string' ? JSON.parse(p.Opcoes) : p.Opcoes;
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções disponíveis:</p>
                                    <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 12px;">
                                        ${opcoes.map(op => `<li>${this.escapeHtml(op.TextoOpcao || op)}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                } else if (p.Tipo === 'sim_nao') {
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções: Sim ou Não</p>
                                </div>
                            `;
                }

                return `
                            <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;">
                                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                                    <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${index + 1}</span>
                                    <div style="flex: 1;">
                                        <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px; font-weight: 500;">${this.escapeHtml(p.Texto)}</p>
                                        <span style="display: inline-block; padding: 2px 8px; background: #f3f4f6; color: #6b7280; border-radius: 4px; font-size: 11px; font-weight: 600;">${p.Tipo === 'texto' ? 'Texto Livre' : p.Tipo === 'multipla_escolha' ? 'Múltipla Escolha' : p.Tipo === 'escala' ? 'Escala' : 'Sim/Não'}</span>
                                    </div>
                                </div>
                                ${opcoesHtml}
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 13px;">${this.renderIcon('user', 16, 'margin-right: 6px;')} Colaborador</p>
                                        <p style="margin: 0; color: #1e3a8a; font-weight: 600;">${r?.RespostaColaborador || '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                    <div style="padding: 12px; background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #6d28d9; font-weight: 600; font-size: 13px;">${this.renderIcon('user-cog', 16, 'margin-right: 6px;')} Gestor</p>
                                        <p style="margin: 0; color: #5b21b6; font-weight: 600;">${r?.RespostaGestor || '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                </div>
                                <div style="padding: 12px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px;">
                                    <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 13px;">${this.renderIcon('sliders', 16, 'margin-right: 6px;')} Resposta Calibrada</p>
                                    ${this.renderCampoCalibragem(p, r)}
                                    <textarea 
                                        class="form-textarea" 
                                        id="justificativa-${p.Id}" 
                                        data-justificativa-id="${p.Id}"
                                        placeholder="Justificativa da calibragem (obrigatório)..."
                                        rows="2"
                                        required
                                        style="width: 100%; background: white; margin-top: 8px;"
                                    >${r?.JustificativaCalibrada || ''}</textarea>
                                </div>
                            </div>
                        `;
            }).join('')}
                    <div style="padding: 24px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 16px 0; color: #92400e; display: flex; align-items: center; gap: 8px;">
                            ${this.renderIcon('file-text', 20)} Considerações Finais
                        </h4>
                        <textarea id="consideracoes-finais" class="form-textarea" rows="4" placeholder="Considerações finais sobre a calibragem (opcional)"></textarea>
                    </div>
                </div>
            `;
            this.refreshIcons();
        } catch (error) {
            console.error('Erro ao carregar interface de calibragem:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc2626;"><p>Erro ao carregar dados</p></div>';
        }
    },

    renderCampoCalibragem(pergunta, resposta) {
        const valorAtual = resposta?.RespostaCalibrada || '';

        switch (pergunta.Tipo) {
            case 'texto':
                return `
                    <textarea 
                        class="form-textarea" 
                        id="calibragem-${pergunta.Id}" 
                        data-pergunta-id="${pergunta.Id}"
                        placeholder="Digite a resposta calibrada..."
                        rows="3"
                        style="width: 100%; background: white;"
                    >${this.escapeHtml(valorAtual)}</textarea>
                `;

            case 'multipla_escolha':
                const opcoes = typeof pergunta.Opcoes === 'string' ? JSON.parse(pergunta.Opcoes) : pergunta.Opcoes;
                return `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${opcoes.map(opcao => {
                    const textoOpcao = opcao.TextoOpcao || opcao;
                    return `
                                <label style="display: flex; align-items: center; padding: 12px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                                       onmouseover="this.style.borderColor='#f59e0b'; this.style.background='#fffbeb';"
                                       onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                                    <input 
                                        type="radio" 
                                        name="calibragem-${pergunta.Id}" 
                                        value="${this.escapeHtml(textoOpcao)}"
                                        data-pergunta-id="${pergunta.Id}"
                                        ${valorAtual === textoOpcao ? 'checked' : ''}
                                        style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                                    >
                                    <span style="color: #111827; font-size: 15px;">${this.escapeHtml(textoOpcao)}</span>
                                </label>
                            `;
                }).join('')}
                    </div>
                `;

            case 'escala':
                const min = pergunta.EscalaMinima || 1;
                const max = pergunta.EscalaMaxima || 5;
                const labelMin = pergunta.EscalaLabelMinima || 'Mínimo';
                const labelMax = pergunta.EscalaLabelMaxima || 'Máximo';
                const valores = [];
                for (let i = min; i <= max; i++) valores.push(i);

                return `
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                            ${valores.map(valor => `
                                <label style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                                    <input 
                                        type="radio" 
                                        name="calibragem-${pergunta.Id}" 
                                        value="${valor}"
                                        data-pergunta-id="${pergunta.Id}"
                                        ${valorAtual == valor ? 'checked' : ''}
                                        style="width: 20px; height: 20px; cursor: pointer;"
                                    >
                                    <span style="font-weight: 600; color: #111827; font-size: 16px;">${valor}</span>
                                </label>
                            `).join('')}
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280;">
                            <span>${this.escapeHtml(labelMin)}</span>
                            <span>${this.escapeHtml(labelMax)}</span>
                        </div>
                    </div>
                `;

            case 'sim_nao':
                return `
                    <div style="display: flex; gap: 16px;">
                        <label style="display: flex; align-items: center; padding: 12px 24px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; flex: 1; justify-content: center; transition: all 0.2s;"
                               onmouseover="this.style.borderColor='#10b981'; this.style.background='#ecfdf5';"
                               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                            <input 
                                type="radio" 
                                name="calibragem-${pergunta.Id}" 
                                value="Sim"
                                data-pergunta-id="${pergunta.Id}"
                                ${valorAtual === 'Sim' ? 'checked' : ''}
                                style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                            >
                            <span style="color: #111827; font-weight: 600; font-size: 15px;">Sim</span>
                        </label>
                        <label style="display: flex; align-items: center; padding: 12px 24px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; flex: 1; justify-content: center; transition: all 0.2s;"
                               onmouseover="this.style.borderColor='#ef4444'; this.style.background='#fef2f2';"
                               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                            <input 
                                type="radio" 
                                name="calibragem-${pergunta.Id}" 
                                value="Não"
                                data-pergunta-id="${pergunta.Id}"
                                ${valorAtual === 'Não' ? 'checked' : ''}
                                style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                            >
                            <span style="color: #111827; font-weight: 600; font-size: 15px;">Não</span>
                        </label>
                    </div>
                `;

            default:
                return `<p style="color: #dc2626;">Tipo de pergunta não suportado</p>`;
        }
    },

    async enviarCalibragem() {
        if (!this.state.avaliacaoAtual) return;

        const respostas = [];
        const processados = new Set();
        const inputs = document.querySelectorAll('[data-pergunta-id]');
        const totalPerguntas = new Set();

        // Contar total de perguntas
        inputs.forEach(input => {
            const perguntaId = parseInt(input.getAttribute('data-pergunta-id'));
            totalPerguntas.add(perguntaId);
        });

        for (const input of inputs) {
            const perguntaId = parseInt(input.getAttribute('data-pergunta-id'));

            if (processados.has(perguntaId)) continue;
            processados.add(perguntaId);

            let resposta = '';

            if (input.type === 'radio') {
                const checked = document.querySelector(`input[name="calibragem-${perguntaId}"]:checked`);
                resposta = checked ? checked.value.trim() : '';
            } else if (input.tagName === 'TEXTAREA') {
                resposta = input.value.trim();
            }

            const justificativaEl = document.getElementById(`justificativa-${perguntaId}`);
            const justificativa = justificativaEl ? justificativaEl.value.trim() : '';

            // Validar resposta obrigatória
            if (!resposta) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Todas as respostas calibradas são obrigatórias', 'error');
                }
                return;
            }

            // Validar justificativa obrigatória
            if (!justificativa) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Todas as justificativas são obrigatórias', 'error');
                }
                return;
            }

            respostas.push({ perguntaId, resposta, justificativa });
        }

        // Verificar se todas as perguntas foram respondidas
        if (respostas.length !== totalPerguntas.size) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Todas as perguntas devem ser calibradas', 'error');
            }
            return;
        }

        const consideracoesFinais = document.getElementById('consideracoes-finais')?.value.trim() || '';

        try {
            await API.post(`/api/avaliacoes/desempenho/${this.state.avaliacaoAtual.Id}/calibrar`, {
                respostas,
                consideracoesFinais
            });

            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Calibragem salva com sucesso!', 'success');
            }
            this.closeModal();
            this.loadTodas();
        } catch (error) {
            console.error('Erro ao salvar calibragem:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao salvar calibragem', 'error');
            }
        }
    },

    async loadInterfaceFeedbackPDI(avaliacao) {
        const tabResponder = document.getElementById('tab-responder');
        const tabVisualizar = document.getElementById('tab-visualizar');
        const btnEnviar = document.getElementById('btn-enviar-avaliacao');
        const acoes = document.getElementById('acoes-avaliacao');
        const avaliacoesTabs = document.querySelector('.avaliacoes-tabs');
        let container = document.getElementById('formulario-avaliacao');

        if (tabResponder) tabResponder.style.display = 'none';
        if (tabVisualizar) tabVisualizar.style.display = 'none';
        if (btnEnviar) btnEnviar.style.display = 'inline-flex';
        if (acoes) acoes.style.display = 'flex';
        if (avaliacoesTabs) avaliacoesTabs.style.display = 'none';

        if (btnEnviar) {
            btnEnviar.textContent = 'Salvar Feedback e Criar PDI';
            btnEnviar.onclick = () => this.enviarFeedbackPDI();
        }

        this.displayInfo(avaliacao, false, false, false, false, false);

        container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p style="color: #6b7280; margin-top: 16px;">Carregando...</p></div>';

        try {
            const perguntas = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/questionario`);
            const respostasRaw = await API.get(`/api/avaliacoes/desempenho/${avaliacao.Id}/respostas`);
            const mapRespostas = new Map(respostasRaw.map(r => [r.PerguntaId, r]));

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    ${perguntas.map((p, index) => {
                const r = mapRespostas.get(p.Id);

                let opcoesHtml = '';
                if (p.Tipo === 'escala') {
                    const min = p.EscalaMinima || 1;
                    const max = p.EscalaMaxima || 5;
                    const labelMin = p.EscalaLabelMinima || 'Mínimo';
                    const labelMax = p.EscalaLabelMaxima || 'Máximo';
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Escala disponível:</p>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMin)}</span>
                                        <div style="display: flex; gap: 4px;">
                                            ${Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v =>
                        `<span style="padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: 600;">${v}</span>`
                    ).join('')}
                                        </div>
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMax)}</span>
                                    </div>
                                </div>
                            `;
                } else if (p.Tipo === 'multipla_escolha' && p.Opcoes && p.Opcoes.length > 0) {
                    const opcoes = typeof p.Opcoes === 'string' ? JSON.parse(p.Opcoes) : p.Opcoes;
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções disponíveis:</p>
                                    <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 12px;">
                                        ${opcoes.map(op => `<li>${this.escapeHtml(op.TextoOpcao || op)}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                } else if (p.Tipo === 'sim_nao') {
                    opcoesHtml = `
                                <div style="margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções: Sim ou Não</p>
                                </div>
                            `;
                }

                return `
                            <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;">
                                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                                    <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${index + 1}</span>
                                    <div style="flex: 1;">
                                        <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px; font-weight: 500;">${this.escapeHtml(p.Texto)}</p>
                                        <span style="display: inline-block; padding: 2px 8px; background: #f3f4f6; color: #6b7280; border-radius: 4px; font-size: 11px; font-weight: 600;">${p.Tipo === 'texto' ? 'Texto Livre' : p.Tipo === 'multipla_escolha' ? 'Múltipla Escolha' : p.Tipo === 'escala' ? 'Escala' : 'Sim/Não'}</span>
                                    </div>
                                </div>
                                ${opcoesHtml}
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 13px;">${this.renderIcon('user', 16, 'margin-right: 6px;')} Colaborador</p>
                                        <p style="margin: 0; color: #1e3a8a; font-weight: 600;">${r?.RespostaColaborador || '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                    <div style="padding: 12px; background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #6d28d9; font-weight: 600; font-size: 13px;">${this.renderIcon('user-cog', 16, 'margin-right: 6px;')} Gestor</p>
                                        <p style="margin: 0; color: #5b21b6; font-weight: 600;">${r?.RespostaGestor || '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                    <div style="padding: 12px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 13px;">${this.renderIcon('sliders', 16, 'margin-right: 6px;')} Calibrada (RH)</p>
                                        <p style="margin: 0; color: #78350f; font-weight: 600;">${r?.RespostaCalibrada || '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                        ${r?.JustificativaCalibrada ? `
                                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #fbbf24;">
                                                <p style="margin: 0 0 4px 0; color: #92400e; font-weight: 600; font-size: 11px;">Justificativa:</p>
                                                <p style="margin: 0; color: #78350f; font-size: 12px;">${this.escapeHtml(r.JustificativaCalibrada)}</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
            }).join('')}
                    
                    ${avaliacao.FeedbackGestor ? `
                        <div style="padding: 24px; background: #dbeafe; border: 2px solid #3b82f6; border-radius: 12px; margin-top: 16px;">
                            <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">
                                ${this.renderIcon('message-square', 20)} Feedback do Gestor
                            </h4>
                            <div style="padding: 16px; background: white; border-radius: 8px; color: #1e3a8a; white-space: pre-wrap;">${this.escapeHtml(avaliacao.FeedbackGestor)}</div>
                        </div>
                    ` : ''}
                    
                    <div style="padding: 24px; background: #dbeafe; border: 2px solid #3b82f6; border-radius: 12px; margin-top: 16px;">
                        <h4 style="margin: 0 0 16px 0; color: #1e40af; display: flex; align-items: center; gap: 8px;">
                            ${this.renderIcon('message-square', 20)} Feedback do Gestor
                        </h4>
                        <textarea id="feedback-gestor" class="form-textarea" rows="6" placeholder="Digite o feedback detalhado para o colaborador (obrigatório)..." required style="width: 100%; background: white;"></textarea>
                    </div>

                    <div style="padding: 24px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 16px 0; color: #065f46; display: flex; align-items: center; gap: 8px;">
                            ${this.renderIcon('target', 20)} Plano de Desenvolvimento Individual (PDI)
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 16px;">
                            <div>
                                <label class="form-label" style="color: #065f46;">Objetivos de Desenvolvimento</label>
                                <textarea id="pdi-objetivos" class="form-textarea" rows="4" placeholder="Defina os objetivos de desenvolvimento do colaborador..." required style="width: 100%; background: white;"></textarea>
                            </div>
                            <div>
                                <label class="form-label" style="color: #065f46;">Ações e Recursos Necessários</label>
                                <textarea id="pdi-acoes" class="form-textarea" rows="4" placeholder="Liste as ações, treinamentos e recursos necessários..." required style="width: 100%; background: white;"></textarea>
                            </div>
                            <div>
                                <label class="form-label" style="color: #065f46;">Prazo para Conclusão</label>
                                <input type="date" id="pdi-prazo" class="form-input" required style="background: white;">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.refreshIcons();
        } catch (error) {
            console.error('Erro ao carregar interface de feedback:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc2626;"><p>Erro ao carregar dados</p></div>';
        }
    },

    async enviarFeedbackPDI() {
        if (!this.state.avaliacaoAtual) return;

        const feedbackGestor = document.getElementById('feedback-gestor')?.value.trim();
        const pdiObjetivos = document.getElementById('pdi-objetivos')?.value.trim();
        const pdiAcoes = document.getElementById('pdi-acoes')?.value.trim();
        const pdiPrazo = document.getElementById('pdi-prazo')?.value;

        if (!feedbackGestor) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('O feedback do gestor é obrigatório', 'error');
            }
            return;
        }

        if (!pdiObjetivos || !pdiAcoes || !pdiPrazo) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Todos os campos do PDI são obrigatórios', 'error');
            }
            return;
        }

        try {
            await API.post(`/api/avaliacoes/desempenho/${this.state.avaliacaoAtual.Id}/feedback-pdi`, {
                feedbackGestor,
                pdi: {
                    objetivos: pdiObjetivos,
                    acoes: pdiAcoes,
                    prazoRevisao: pdiPrazo
                }
            });

            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Feedback e PDI salvos com sucesso!', 'success');
            }
            this.closeModal();
            this.loadMinhas();
        } catch (error) {
            console.error('Erro ao salvar feedback e PDI:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao salvar feedback e PDI', 'error');
            }
        }
    },

    async concluirFeedback(id) {
        if (!confirm('Tem certeza que deseja concluir o feedback desta avaliação?')) return;

        try {
            await API.post(`/api/avaliacoes/desempenho/${id}/feedback`);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Feedback concluído com sucesso!', 'success');
            } else {
                alert('Feedback concluído com sucesso!');
            }
            this.closeModal();
            this.loadMinhas();
        } catch (error) {
            console.error('Erro ao concluir feedback:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao concluir feedback', 'error');
            } else {
                alert('Erro ao concluir feedback');
            }
        }
    }
};

// Global functions for onclick
function loadAvaliacoes() { Avaliacoes.load(); }
function abrirAvaliacao(id) { Avaliacoes.open(id); }
function toggleAvaliacoesView(view) { Avaliacoes.toggleView(view); }
function checkAvaliacoesPermissions() { Avaliacoes.checkPermissions(); }
function trocarAbaAvaliacao(aba) { Avaliacoes.switchTab(aba); }
function formatarData(dateString) { return Avaliacoes.formatDate(dateString); }
function enviarRespostasAvaliacao() {
    console.log('📤 enviarRespostasAvaliacao chamado - usando Avaliacoes.enviarRespostas()');

    // Verificar se Avaliacoes existe e tem o método
    if (typeof Avaliacoes !== 'undefined' && typeof Avaliacoes.enviarRespostas === 'function') {
        Avaliacoes.enviarRespostas();
    } else {
        console.error('❌ Avaliacoes.enviarRespostas não encontrado');
        alert('Erro: Sistema de avaliações não carregado. Recarregue a página.');
    }
}

function fecharModalAvaliacao() { Avaliacoes.closeModal(); }
function fecharModalResponderAvaliacao() { Avaliacoes.closeModal(); }
function fecharModalReabrirAvaliacao() { Avaliacoes.fecharModalReabrirAvaliacao(); }
function reabrirAvaliacao() { Avaliacoes.confirmarReaberturaAvaliacao(); }
