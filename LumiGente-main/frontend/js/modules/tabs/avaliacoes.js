// Avaliações Tab Module
const Avaliacoes = {
    state: {
        avaliacaoAtual: null,
        respostasAvaliacao: {}
    },

    async load() {
        await this.checkPermissions();
        await this.loadMinhas();
    },

    async loadMinhas() {
        try {
            const avaliacoes = await API.get('/api/avaliacoes/minhas');
            this.updateMinhasList(avaliacoes);
        } catch (error) {
            console.error('Erro ao carregar avaliações:', error);
        }
    },

    async loadTodas() {
        try {
            const avaliacoes = await API.get('/api/avaliacoes/todas');
            this.updateTodasList(avaliacoes);
        } catch (error) {
            console.error('Erro ao carregar todas as avaliações:', error);
        }
    },

    updateMinhasList(avaliacoes) {
        const container = document.querySelector('#minhas-avaliacoes-view .card');
        if (!container) return;
        
        if (avaliacoes.length === 0) {
            container.innerHTML = `
                <h3><i class="fas fa-clipboard-check" style="color: #10b981;"></i> Minhas Avaliações</h3>
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-check-circle" style="font-size: 64px; color: #10b981; margin-bottom: 16px;"></i>
                    <h4 style="color: #6b7280;">Nenhuma avaliação pendente</h4>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <h3><i class="fas fa-clipboard-check" style="color: #10b981;"></i> Minhas Avaliações</h3>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Total: ${avaliacoes.length} avaliação(ões)</p>
            ${this.renderList(avaliacoes, false)}
        `;
    },

    updateTodasList(avaliacoes) {
        const container = document.getElementById('todas-avaliacoes-conteudo');
        if (!container) return;
        
        if (avaliacoes.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div style="text-align: center; padding: 40px 20px;">
                        <i class="fas fa-inbox" style="font-size: 64px; color: #e5e7eb; margin-bottom: 16px;"></i>
                        <h4 style="color: #6b7280;">Nenhuma avaliação cadastrada</h4>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="card">
                <p style="color: #6b7280; font-size: 14px;">Total: ${avaliacoes.length} avaliação(ões)</p>
            </div>
            <div id="lista-avaliacoes-container">${this.renderList(avaliacoes, true)}</div>
        `;
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
                    
                    const textoBotao = (isAdmin || !isParticipante || jaRespondeu) ? 'Ver Detalhes' : 
                                      (avaliacao.StatusAvaliacao === 'Pendente' ? 'Responder Avaliação' : 'Ver Detalhes');
                    
                    return `
                        <div class="avaliacao-item" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                                <div>
                                    <h4 style="margin: 0 0 4px 0;">${avaliacao.NomeCompleto}</h4>
                                    <p style="margin: 0; color: #6b7280; font-size: 14px;">${avaliacao.Departamento || 'N/A'}</p>
                                </div>
                                <span class="badge">${avaliacao.StatusAvaliacao}</span>
                            </div>
                            <button class="btn btn-amber btn-sm" onclick="Avaliacoes.open(${avaliacao.Id})">
                                <i class="fas fa-${textoBotao === 'Ver Detalhes' ? 'eye' : 'clipboard-check'}"></i>
                                ${textoBotao}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    async open(avaliacaoId) {
        try {
            const avaliacao = await API.get(`/api/avaliacoes/${avaliacaoId}`);
            this.state.avaliacaoAtual = avaliacao;
            this.state.respostasAvaliacao = {};
            
            const user = State.getUser();
            const eColaborador = avaliacao.UserId === user.userId;
            const eGestor = avaliacao.GestorId === user.userId;
            const eParticipante = eColaborador || eGestor;
            const jaRespondeu = eColaborador ? avaliacao.RespostaColaboradorConcluida : avaliacao.RespostaGestorConcluida;
            const estaExpirada = avaliacao.StatusAvaliacao === 'Expirada' || new Date() > new Date(avaliacao.DataLimiteResposta);
            const estaAgendada = avaliacao.StatusAvaliacao === 'Agendada';
            
            this.displayInfo(avaliacao, eColaborador, eGestor, eParticipante);
            
            if (estaAgendada && eParticipante) {
                this.showAgendadaMessage(avaliacao);
            } else if (!eParticipante) {
                this.showViewOnlyMode();
            } else if (jaRespondeu) {
                this.showViewOnlyMode();
            } else if (estaExpirada) {
                this.showExpiradaMessage(avaliacao);
            } else {
                await this.loadQuestionario(avaliacao);
            }
            
            Modal.open('responder-avaliacao-modal');
        } catch (error) {
            console.error('Erro ao abrir avaliação:', error);
            alert('Erro ao carregar avaliação');
        }
    },

    displayInfo(avaliacao, eColaborador, eGestor, eParticipante) {
        const container = document.getElementById('info-avaliacao');
        if (!container) return;
        
        let quartoCampoLabel, quartoCampoConteudo;
        if (eParticipante) {
            quartoCampoLabel = 'Você responde como:';
            quartoCampoConteudo = `<p style="margin: 0; color: #0d556d; font-weight: 600;"><i class="fas fa-${eColaborador ? 'user' : 'user-tie'}"></i> ${eColaborador ? 'Colaborador' : 'Gestor'}</p>`;
        } else {
            quartoCampoLabel = 'Gestor Responsável:';
            quartoCampoConteudo = `<p style="margin: 0; color: #8b5cf6; font-weight: 600;"><i class="fas fa-user-tie"></i> ${avaliacao.NomeGestor || 'Não atribuído'}</p>`;
        }
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Tipo de Avaliação</p><p style="margin: 0; color: #111827; font-weight: 600;">${avaliacao.TipoAvaliacao}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Colaborador</p><p style="margin: 0; color: #111827;">${avaliacao.NomeCompleto}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Prazo de Resposta</p><p style="margin: 0; color: #111827;">${this.formatDate(avaliacao.DataLimiteResposta)}</p></div>
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
                <i class="fas fa-calendar-alt" style="font-size: 64px; color: #3b82f6; margin-bottom: 24px;"></i>
                <h3 style="color: #1e40af; margin-bottom: 12px;">Avaliação Agendada</h3>
                <p style="color: #1e3a8a; font-size: 16px;">Esta avaliação ainda não está disponível.</p>
                <p style="color: #3b82f6; font-size: 14px;">Faltam aproximadamente <strong>${diasFaltantes} dia(s)</strong>.</p>
            </div>
        `;
        this.switchTab('responder');
    },

    showViewOnlyMode() {
        document.getElementById('tab-responder').style.display = 'none';
        document.getElementById('tab-visualizar').style.display = 'inline-flex';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'flex';
        this.switchTab('visualizar');
    },

    showExpiradaMessage(avaliacao) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        document.getElementById('btn-enviar-avaliacao').style.display = 'none';
        document.getElementById('acoes-avaliacao').style.display = 'none';
        
        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #fef2f2; border-radius: 12px; border: 2px solid #fca5a5;">
                <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #dc2626; margin-bottom: 24px;"></i>
                <h3 style="color: #991b1b; margin-bottom: 12px;">Avaliação Expirada</h3>
                <p style="color: #7f1d1d; font-size: 16px;">O prazo expirou em <strong>${this.formatDate(avaliacao.DataLimiteResposta)}</strong>.</p>
            </div>
        `;
        this.switchTab('responder');
    },

    async loadQuestionario(avaliacao) {
        document.getElementById('tab-responder').style.display = 'inline-flex';
        document.getElementById('btn-enviar-avaliacao').style.display = 'inline-flex';
        document.getElementById('acoes-avaliacao').style.display = 'flex';
        document.getElementById('tab-visualizar').style.display = 'none';
        
        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-clipboard-list" style="font-size: 48px; color: #3b82f6; margin-bottom: 16px;"></i>
                <p style="color: #6b7280;">Questionário será carregado aqui</p>
            </div>
        `;
        this.switchTab('responder');
    },

    switchTab(aba) {
        const tabs = document.querySelectorAll('.avaliacao-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-avaliacao-tab="${aba}"]`)?.classList.add('active');
        
        document.getElementById('formulario-avaliacao').style.display = aba === 'responder' ? 'block' : 'none';
        document.getElementById('visualizacao-avaliacao').style.display = aba === 'visualizar' ? 'block' : 'none';
    },

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const [year, month, day] = dateString.split('T')[0].split('-');
            return `${day}/${month}/${year}`;
        } catch {
            return 'Data inválida';
        }
    },

    closeModal() {
        Modal.close('responder-avaliacao-modal');
        this.state.avaliacaoAtual = null;
        this.state.respostasAvaliacao = {};
    },

    toggleView(view) {
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
        } else {
            minhasView.style.display = 'none';
            todasView.style.display = 'block';
            this.loadTodas();
        }
    },

    async checkPermissions() {
        try {
            const user = State.getUser();
            const isHRTD = user && user.departamento && (
                user.departamento.toUpperCase().includes('RH') ||
                user.departamento.toUpperCase().includes('TREINAM&DESENVOLV') ||
                user.departamento.toUpperCase().includes('ADM/RH/SESMT')
            );
            
            const toggleButtons = document.getElementById('avaliacoes-toggle-buttons');
            if (toggleButtons) {
                toggleButtons.style.display = isHRTD ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Erro ao verificar permissões:', error);
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
