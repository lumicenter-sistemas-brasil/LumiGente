// Avaliações - Renderer Module
const AvaliacoesRenderer = {
    renderizarQuestionario(perguntas, tipo) {
        const container = document.getElementById('formulario-avaliacao');
        
        if (perguntas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h4>Nenhuma pergunta cadastrada</h4>
                </div>
            `;
            return;
        }
        
        const html = perguntas.map((pergunta, index) => `
            <div class="pergunta-avaliacao" data-pergunta-id="${pergunta.Id}">
                <div class="pergunta-avaliacao-header">
                    <span class="pergunta-numero-badge">${pergunta.Ordem}</span>
                    <div class="pergunta-titulo">
                        ${pergunta.Pergunta}
                        ${pergunta.Obrigatoria ? '<span class="pergunta-obrigatoria-badge">*</span>' : ''}
                    </div>
                </div>
                ${this.renderizarCampoPergunta(pergunta, tipo)}
            </div>
        `).join('');
        
        container.innerHTML = html;
    },

    renderizarCampoPergunta(pergunta, tipoQuestionario) {
        const perguntaId = pergunta.Id;
        
        switch (pergunta.TipoPergunta) {
            case 'texto':
                return `
                    <textarea 
                        class="form-textarea" 
                        id="resposta-${perguntaId}" 
                        placeholder="Digite sua resposta..."
                        rows="4"
                        ${pergunta.Obrigatoria ? 'required' : ''}
                    ></textarea>
                `;
            
            case 'multipla_escolha':
                return `
                    <div class="opcoes-resposta">
                        ${pergunta.Opcoes.map(opcao => `
                            <label class="opcao-resposta-item" onclick="selecionarOpcao(this, ${perguntaId}, ${opcao.Id})">
                                <input 
                                    type="radio" 
                                    name="resposta-${perguntaId}" 
                                    value="${opcao.Id}" 
                                    ${pergunta.Obrigatoria ? 'required' : ''}
                                />
                                <span>${opcao.TextoOpcao}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            
            case 'escala':
                const min = pergunta.EscalaMinima || 1;
                const max = pergunta.EscalaMaxima || 5;
                const opcoes = [];
                
                for (let i = min; i <= max; i++) {
                    opcoes.push(i);
                }
                
                return `
                    <div class="escala-resposta">
                        ${opcoes.map(valor => `
                            <div class="escala-opcao" onclick="selecionarEscala(this, ${perguntaId}, ${valor})">
                                <span class="escala-numero">${valor}</span>
                                ${valor === min && pergunta.EscalaLabelMinima ? 
                                    `<span class="escala-label">${pergunta.EscalaLabelMinima}</span>` : 
                                    valor === max && pergunta.EscalaLabelMaxima ? 
                                    `<span class="escala-label">${pergunta.EscalaLabelMaxima}</span>` : 
                                    ''}
                            </div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="resposta-${perguntaId}" ${pergunta.Obrigatoria ? 'required' : ''} />
                `;
            
            case 'sim_nao':
                return `
                    <div class="simnao-resposta">
                        <div class="simnao-opcao" onclick="selecionarSimNao(this, ${perguntaId}, 'Sim')">
                            <i class="fas fa-check-circle" style="font-size: 20px; margin-right: 8px;"></i>
                            Sim
                        </div>
                        <div class="simnao-opcao nao" onclick="selecionarSimNao(this, ${perguntaId}, 'Não')">
                            <i class="fas fa-times-circle" style="font-size: 20px; margin-right: 8px;"></i>
                            Não
                        </div>
                    </div>
                    <input type="hidden" id="resposta-${perguntaId}" ${pergunta.Obrigatoria ? 'required' : ''} />
                `;
            
            default:
                return '<p style="color: #ef4444;">Tipo de pergunta não suportado</p>';
        }
    },

    renderizarRespostas(dados) {
        const container = document.getElementById('respostas-avaliacao');
        const { minhasRespostas, respostasOutraParte, perguntas } = dados;
        
        const eParticipante = avaliacaoAtual.UserId === currentUser.userId || 
                             avaliacaoAtual.GestorId === currentUser.userId;
        const jaRespondeu = minhasRespostas && minhasRespostas.length > 0;
        
        if (eParticipante && !jaRespondeu) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #f59e0b; background: #fffbeb; border-radius: 8px; border: 2px dashed #fbbf24;">
                    <i class="fas fa-lock" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h4>Responda a avaliação primeiro</h4>
                    <p style="color: #92400e; margin-bottom: 0;">
                        Você precisa responder a avaliação antes de visualizar as respostas.
                    </p>
                </div>
            `;
            return;
        }
        
        if ((!minhasRespostas || minhasRespostas.length === 0) && 
            (!respostasOutraParte || respostasOutraParte.length === 0)) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <i class="fas fa-info-circle" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h4>Nenhuma resposta registrada ainda</h4>
                    <p>Aguardando respostas dos participantes</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        perguntas.forEach((pergunta, index) => {
            const minhaResp = minhasRespostas?.find(r => r.PerguntaId === pergunta.Id);
            const outraResp = respostasOutraParte?.find(r => r.PerguntaId === pergunta.Id);
            const mostrarOutraResposta = outraResp && (!eParticipante || jaRespondeu);
            
            html += `
                <div class="pergunta-avaliacao">
                    <div class="pergunta-avaliacao-header">
                        <span class="pergunta-numero-badge">${pergunta.Ordem}</span>
                        <div class="pergunta-titulo">${pergunta.Pergunta}</div>
                    </div>
                    
                    ${minhaResp ? `
                        <div style="margin-bottom: ${mostrarOutraResposta ? '16px' : '0'};">
                            <p style="margin: 0 0 8px 0; color: #0d556d; font-weight: 600; font-size: 14px;">
                                <i class="fas fa-${eParticipante ? 'user' : (minhaResp.TipoRespondente === 'Colaborador' ? 'user' : 'user-tie')}"></i> 
                                ${eParticipante ? 'Sua Resposta' : `Resposta do ${minhaResp.TipoRespondente}`}:
                            </p>
                            <div style="padding: 12px; background: #dbeafe; border-left: 4px solid #0d556d; border-radius: 4px;">
                                ${AvaliacoesFormatter.formatarResposta(minhaResp, pergunta)}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${mostrarOutraResposta ? `
                        <div>
                            <p style="margin: 0 0 8px 0; color: #8b5cf6; font-weight: 600; font-size: 14px;">
                                <i class="fas fa-${outraResp.TipoRespondente === 'Gestor' ? 'user-tie' : 'user'}"></i> 
                                Resposta do ${outraResp.TipoRespondente}:
                            </p>
                            <div style="padding: 12px; background: #f3e8ff; border-left: 4px solid #8b5cf6; border-radius: 4px;">
                                ${AvaliacoesFormatter.formatarResposta(outraResp, pergunta)}
                            </div>
                        </div>
                    ` : eParticipante && jaRespondeu ? `
                        <div style="padding: 12px; background: #f9fafb; border-left: 4px solid #e5e7eb; border-radius: 4px; text-align: center;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                <i class="fas fa-clock"></i> Aguardando resposta do ${minhaResp?.TipoRespondente === 'Colaborador' ? 'Gestor' : 'Colaborador'}
                            </p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
};
