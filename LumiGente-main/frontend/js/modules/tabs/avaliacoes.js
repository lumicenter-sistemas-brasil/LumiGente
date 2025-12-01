// Avaliações Tab Module
const Avaliacoes = {
    state: {
        avaliacaoAtual: null,
        respostasAvaliacao: {}
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

    async load() {
        await this.checkPermissions();
        await this.loadMinhas();
        this.refreshIcons();
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
        
        if (avaliacoes.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div style="text-align: center; padding: 40px 20px;">
                        ${this.renderIcon('inbox', 64, 'color: #e5e7eb; margin-bottom: 16px;')}
                        <h4 style="color: #6b7280;">Nenhuma avaliação cadastrada</h4>
                    </div>
                </div>
            `;
            this.refreshIcons();
            return;
        }
        
        container.innerHTML = `
            <div class="card">
                <p style="color: #6b7280; font-size: 14px;">Total: ${avaliacoes.length} avaliação(ões)</p>
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
                    const podeResponder = isParticipante && !jaRespondeu && avaliacao.StatusAvaliacao === 'Pendente';
                    
                    let textoBotao, iconeBotao, statusExibido;
                    if (jaRespondeu) {
                        statusExibido = 'Concluída';
                        textoBotao = ambasPartesResponderam ? 'Ver Detalhes' : 'Ver Status';
                        iconeBotao = ambasPartesResponderam ? 'eye' : 'clock';
                    } else {
                        statusExibido = avaliacao.StatusAvaliacao;
                        if (podeResponder) {
                            textoBotao = 'Responder Avaliação';
                            iconeBotao = 'clipboard-check';
                        } else {
                            textoBotao = 'Ver Detalhes';
                            iconeBotao = 'eye';
                        }
                    }
                    
                    const tipoDias = avaliacao.TipoAvaliacao.includes('45') ? '45 dias' : '90 dias';
                    
                    return `
                        <div class="avaliacao-item" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                        <h4 style="margin: 0;">${avaliacao.NomeCompleto}</h4>
                                        <span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${tipoDias}</span>
                                    </div>
                                    <p style="margin: 0; color: #6b7280; font-size: 13px;">${avaliacao.Departamento || 'Departamento não informado'}</p>
                                </div>
                                <span class="badge" style="${this.getStatusBadgeStyle(statusExibido)}">${statusExibido}</span>
                            </div>
                            <button class="btn btn-amber btn-sm" onclick="Avaliacoes.open(${avaliacao.Id})">
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
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Tipo de Avaliação</p><p style="margin: 0; color: #111827; font-weight: 600;">${avaliacao.TipoAvaliacao}</p></div>
                <div><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Colaborador Avaliado</p><p style="margin: 0; color: #111827;">${avaliacao.NomeCompleto}</p></div>
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
            const data = await API.get(`/api/avaliacoes/${avaliacao.Id}/respostas`);
            console.log('📊 Dados recebidos:', data);
            
            const { perguntas, minhasRespostas, respostasOutraParte } = data;
            
            console.log('📝 Perguntas:', perguntas.length);
            console.log('📝 Minhas respostas:', minhasRespostas);
            console.log('📝 Respostas outra parte:', respostasOutraParte);
            
            const todasRespostas = [...minhasRespostas, ...respostasOutraParte];
            console.log('📝 Todas as respostas:', todasRespostas);
            
            const respostasColaborador = todasRespostas.filter(r => r.TipoRespondente === 'colaborador');
            const respostasGestor = todasRespostas.filter(r => r.TipoRespondente === 'gestor');
            
            console.log('👤 Respostas colaborador:', respostasColaborador.length);
            console.log('👨‍💼 Respostas gestor:', respostasGestor.length);
            
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
                        const tipoLabel = tipoLabels[pergunta.TipoPergunta] || pergunta.TipoPergunta;
                        
                        let infoAdicional = '';
                        if (pergunta.TipoPergunta === 'escala') {
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
                                            ${Array.from({length: max - min + 1}, (_, i) => min + i).map(v => 
                                                `<span style="padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; font-weight: 600;">${v}</span>`
                                            ).join('')}
                                        </div>
                                        <span style="font-size: 11px; color: #6b7280;">${this.escapeHtml(labelMax)}</span>
                                    </div>
                                </div>
                            `;
                        } else if (pergunta.TipoPergunta === 'multipla_escolha' && pergunta.Opcoes && pergunta.Opcoes.length > 0) {
                            infoAdicional = `
                                <div style="margin-top: 12px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600;">Opções disponíveis:</p>
                                    <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 12px;">
                                        ${pergunta.Opcoes.map(op => `<li>${this.escapeHtml(op.TextoOpcao)}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                        }
                        
                        return `
                            <div style="padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
                                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 8px;">
                                    <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;">${index + 1}</span>
                                    <div style="flex: 1;">
                                        <p style="margin: 0 0 4px 0; color: #111827; font-size: 16px; font-weight: 500;">${this.escapeHtml(pergunta.Pergunta)}</p>
                                        <span style="display: inline-block; padding: 2px 8px; background: #f3f4f6; color: #6b7280; border-radius: 4px; font-size: 11px; font-weight: 600;">${tipoLabel}</span>
                                    </div>
                                </div>
                                ${infoAdicional}
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                                    <div style="padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 13px;">${this.renderIcon('user', 16, 'margin-right: 6px;')} Colaborador</p>
                                        <p style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: 600;">${respostaColab ? this.escapeHtml(respostaColab.Resposta) : '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                    <div style="padding: 12px; background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: 6px;">
                                        <p style="margin: 0 0 8px 0; color: #6d28d9; font-weight: 600; font-size: 13px;">${this.renderIcon('user-cog', 16, 'margin-right: 6px;')} Gestor</p>
                                        <p style="margin: 0; color: #5b21b6; font-size: 14px; font-weight: 600;">${respostaGest ? this.escapeHtml(respostaGest.Resposta) : '<em style="color: #9ca3af; font-weight: normal;">Sem resposta</em>'}</p>
                                    </div>
                                </div>
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
        
        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #fef2f2; border-radius: 12px; border: 2px solid #fca5a5;">
                ${this.renderIcon('alert-triangle', 64, 'color: #dc2626; margin-bottom: 24px;')}
                <h3 style="color: #991b1b; margin-bottom: 12px; justify-content: center;">Avaliação Expirada</h3>
                <p style="color: #7f1d1d; font-size: 16px;">O prazo expirou em <strong>${this.formatDate(avaliacao.DataLimiteResposta)}</strong>.</p>
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
            const tipo = avaliacao.TipoAvaliacao.includes('45') ? '45' : '90';
            const perguntas = await API.get(`/api/avaliacoes/questionario/${tipo}`);
            
            // Carregar opções para perguntas de múltipla escolha
            for (const pergunta of perguntas) {
                if (pergunta.TipoPergunta === 'multipla_escolha') {
                    pergunta.opcoes = await API.get(`/api/avaliacoes/questionario/${tipo}/perguntas/${pergunta.Id}/opcoes`);
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
        const obrigatorioMark = pergunta.Obrigatoria ? '<span style="color: #dc2626;">*</span>' : '';
        
        let inputHtml = '';
        
        switch (pergunta.TipoPergunta) {
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
                            ${this.escapeHtml(pergunta.Pergunta)} ${obrigatorioMark}
                        </p>
                    </div>
                </div>
                ${inputHtml}
            </div>
        `;
    },

    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    switchTab(aba) {
        const tabs = document.querySelectorAll('.avaliacao-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-avaliacao-tab="${aba}"]`)?.classList.add('active');
        
        const formulario = document.getElementById('formulario-avaliacao');
        const visualizacao = document.getElementById('visualizacao-avaliacao');
        
        if (formulario) formulario.style.display = aba === 'responder' ? 'block' : 'none';
        if (visualizacao) visualizacao.style.display = aba === 'visualizar' ? 'block' : 'none';
        this.refreshIcons();
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
        
        console.log('🔍 Validando', obrigatorios.length, 'campos obrigatórios');
        
        for (const campo of obrigatorios) {
            if (campo.type === 'radio') {
                const name = campo.name;
                if (radioGroups.has(name)) continue;
                radioGroups.add(name);
                
                const checked = document.querySelector(`#formulario-avaliacao input[name="${name}"]:checked`);
                if (!checked) {
                    console.error('❌ Campo radio não respondido:', name);
                    if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                        window.EmailPopup.showToast('Por favor, responda todas as perguntas obrigatórias', 'error');
                    }
                    return;
                }
            } else if (campo.tagName === 'TEXTAREA' && !campo.value.trim()) {
                console.error('❌ Textarea não preenchido:', campo.id);
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Por favor, responda todas as perguntas obrigatórias', 'error');
                }
                campo.focus();
                return;
            }
        }
        
        console.log('✅ Validação passou - enviando', respostas.length, 'respostas');
        
        if (respostas.length === 0) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Por favor, responda pelo menos uma pergunta', 'error');
            }
            return;
        }
        
        try {
            await API.post('/api/avaliacoes/responder', {
                avaliacaoId: this.state.avaliacaoAtual.Id,
                respostas,
                tipoRespondente
            });
            
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Respostas enviadas com sucesso!', 'success');
            }
            this.closeModal();
            this.loadMinhas();
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
            
            // Usar descricaoDepartamento (minúscula) que contém o texto completo
            const dept = (user?.descricaoDepartamento || user?.DescricaoDepartamento || '').toUpperCase();
            const isHRTD = dept.includes('SUPERVISAO RH') ||
                           dept.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
                           dept.includes('TREINAMENTO') ||
                           dept.includes('DESENVOLVIMENTO') ||
                           dept.includes('T&D') ||
                           dept.includes('RECURSOS HUMANOS') ||
                           dept.includes('ADM/RH/SESMT');
            
            console.log('🔍 Verificação de permissões:', { 
                descricaoDepartamento: user?.descricaoDepartamento,
                dept, 
                isHRTD
            });
            
            const toggleButtons = document.getElementById('avaliacoes-toggle-buttons');
            if (toggleButtons) {
                toggleButtons.style.display = isHRTD ? 'block' : 'none';
            }

            const btnEditarTemplates = document.getElementById('btn-editar-templates');
            if (btnEditarTemplates) {
                btnEditarTemplates.style.display = isHRTD ? 'inline-flex' : 'none';
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
