// Pesquisas - Question Renderer
const QuestionRenderer = {
    renderForCreation(pergunta, questionId) {
        const questionNumber = document.querySelectorAll('.question-card').length + 1;
        
        return `
            <div class="question-card" data-question-id="${questionId}">
                <div class="question-header">
                    <div class="question-number">${questionNumber}</div>
                    <div class="question-title">Pergunta ${questionNumber}</div>
                    <div class="question-actions">
                        ${questionNumber > 1 ? `
                            <button type="button" class="btn-icon btn-danger" onclick="removeQuestion(${questionId})">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="question-content">
                    <div class="form-group">
                        <label>Texto da Pergunta *</label>
                        <textarea name="pergunta_texto_${questionId}" required rows="2" 
                                  placeholder="Digite sua pergunta aqui..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Tipo de Pergunta</label>
                        <div class="question-type-selector">
                            <div class="type-option active" data-type="texto_livre" onclick="setQuestionType(${questionId}, 'texto_livre')">
                                <i class="fas fa-edit"></i><br>Texto Livre
                            </div>
                            <div class="type-option" data-type="multipla_escolha" onclick="setQuestionType(${questionId}, 'multipla_escolha')">
                                <i class="fas fa-list"></i><br>Múltipla Escolha
                            </div>
                            <div class="type-option" data-type="escala" onclick="setQuestionType(${questionId}, 'escala')">
                                <i class="fas fa-star"></i><br>Escala
                            </div>
                            <div class="type-option" data-type="sim_nao" onclick="setQuestionType(${questionId}, 'sim_nao')">
                                <i class="fas fa-check"></i><br>Sim/Não
                            </div>
                        </div>
                    </div>
                    
                    <div id="question-options-${questionId}" class="question-options"></div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" name="pergunta_obrigatoria_${questionId}">
                            <span class="checkmark"></span>
                            Pergunta obrigatória
                        </label>
                    </div>
                </div>
            </div>
        `;
    },

    renderOptionsForType(questionId, tipo) {
        switch (tipo) {
            case 'multipla_escolha':
                return `
                    <div class="form-group">
                        <label>Opções de Resposta</label>
                        <div class="options-container" id="options-${questionId}">
                            <div class="option-input">
                                <input type="text" name="opcao_${questionId}_1" placeholder="Opção 1" required>
                                <button type="button" class="btn-icon btn-danger" onclick="this.parentElement.remove()">
                                    <i class="fas fa-minus"></i>
                                </button>
                            </div>
                            <div class="option-input">
                                <input type="text" name="opcao_${questionId}_2" placeholder="Opção 2" required>
                                <button type="button" class="btn-icon btn-danger" onclick="this.parentElement.remove()">
                                    <i class="fas fa-minus"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline" onclick="addOption(${questionId})">
                            <i class="fas fa-plus"></i> Adicionar Opção
                        </button>
                    </div>
                `;
            
            case 'escala':
                return `
                    <div class="form-group">
                        <label>Configuração da Escala</label>
                        <div class="scale-inputs">
                            <div>
                                <label>Valor Mínimo</label>
                                <input type="number" name="escala_min_${questionId}" value="1" min="1" max="10" required>
                            </div>
                            <div>
                                <label>Valor Máximo</label>
                                <input type="number" name="escala_max_${questionId}" value="5" min="1" max="10" required>
                            </div>
                        </div>
                        <small>Exemplo: 1 a 5 (muito insatisfeito a muito satisfeito)</small>
                    </div>
                `;
            
            default:
                return '';
        }
    },

    renderForResponse(pergunta, index) {
        const required = pergunta.obrigatoria ? 'required' : '';
        const requiredMark = pergunta.obrigatoria ? '<span class="question-required">*</span>' : '';
        
        let inputHtml = '';
        
        switch (pergunta.tipo) {
            case 'texto_livre':
                inputHtml = `
                    <textarea name="resposta_${pergunta.Id}" class="response-input response-textarea" 
                              placeholder="Digite sua resposta..." ${required}></textarea>
                `;
                break;
                
            case 'multipla_escolha':
                if (!pergunta.opcoes || pergunta.opcoes.length === 0) {
                    inputHtml = `<p style="color: red;">Erro: Opções não disponíveis</p>`;
                } else {
                    inputHtml = `
                        <div class="response-options">
                            ${pergunta.opcoes.map(opcao => `
                                <label class="option-label">
                                    <input type="radio" name="resposta_${pergunta.Id}" value="${opcao.Id}" ${required}>
                                    <span>${opcao.opcao}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                }
                break;
                
            case 'escala':
                const options = [];
                for (let i = pergunta.escala_min; i <= pergunta.escala_max; i++) {
                    options.push(`
                        <label class="scale-option">
                            <input type="radio" name="resposta_${pergunta.Id}" value="${i}" ${required} style="display: none;">
                            <div class="scale-number">${i}</div>
                        </label>
                    `);
                }
                inputHtml = `
                    <div class="scale-options">
                        ${options.join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; color: #718096; font-size: 0.9em;">
                        <span>Mínimo (${pergunta.escala_min})</span>
                        <span>Máximo (${pergunta.escala_max})</span>
                    </div>
                `;
                break;
                
            case 'sim_nao':
                inputHtml = `
                    <div class="response-options">
                        <label class="option-label">
                            <input type="radio" name="resposta_${pergunta.Id}" value="sim" ${required}>
                            <span>Sim</span>
                        </label>
                        <label class="option-label">
                            <input type="radio" name="resposta_${pergunta.Id}" value="nao" ${required}>
                            <span>Não</span>
                        </label>
                    </div>
                `;
                break;
        }
        
        return `
            <div class="question-item">
                <div class="question-title">
                    ${index + 1}. ${pergunta.pergunta} ${requiredMark}
                </div>
                ${inputHtml}
            </div>
        `;
    }
};

window.QuestionRenderer = QuestionRenderer;
