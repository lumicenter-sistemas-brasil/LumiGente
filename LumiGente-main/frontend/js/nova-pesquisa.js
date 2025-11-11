class NovaPesquisa {
    constructor() {
        this.filtros = { filiais: [], departamentos: [] };
        this.perguntas = [];
        this.departamentosFiltrados = [];
        this.searchTerm = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFiltros();
        this.addFirstQuestion();
    }

    setupEventListeners() {
        // Tipo de público alvo
        document.querySelectorAll('input[name="target_type"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleTargetTypeChange());
        });

        // Adicionar pergunta
        document.getElementById('add-question').addEventListener('click', () => {
            this.addQuestion();
        });

        // Submit do formulário
        document.getElementById('surveyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitSurvey();
        });

        // Input de pesquisa de departamentos
        const searchInput = document.getElementById('departamento-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleDepartamentoSearch(e.target.value);
            });
        }

        // Botão de limpar pesquisa
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearDepartamentoSearch();
            });
        }
    }

    async loadFiltros() {
        try {
            this.filtros = await SurveyAPI.getFiltros();
            this.renderFiliais();
            this.renderDepartamentos();
        } catch (error) {
            console.error('Erro ao carregar filtros:', error);
            this.showError('Erro ao carregar filtros disponíveis');
        }
    }

    renderFiliais() {
        const container = document.getElementById('filiais-list');
        if (!this.filtros.filiais || this.filtros.filiais.length === 0) {
            container.innerHTML = '<div class="loading-filters">Nenhuma filial encontrada</div>';
            return;
        }

        container.innerHTML = this.filtros.filiais.map(filial => `
            <div class="filter-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="filiais" value="${filial.codigo}" data-nome="${filial.nome}">
                    <span class="checkmark"></span>
                    ${filial.nome} (${filial.codigo})
                </label>
            </div>
        `).join('');

        // Adicionar event listeners
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateTargetSummary());
        });
    }

    renderDepartamentos() {
        const container = document.getElementById('departamentos-list');
        if (!this.filtros.departamentos || this.filtros.departamentos.length === 0) {
            container.innerHTML = '<div class="loading-filters">Nenhum departamento encontrado</div>';
            return;
        }

        // Inicializar lista filtrada com todos os departamentos
        this.departamentosFiltrados = [...this.filtros.departamentos];
        this.renderDepartamentosList();
    }

    renderDepartamentosList() {
        const container = document.getElementById('departamentos-list');
        
        if (this.departamentosFiltrados.length === 0) {
            container.innerHTML = '<div class="loading-filters">Nenhum departamento encontrado</div>';
            return;
        }

        container.innerHTML = this.departamentosFiltrados.map(dept => `
            <div class="filter-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="departamentos" value="${dept.codigo}" data-nome="${dept.nome}">
                    <span class="checkmark"></span>
                    ${this.highlightSearchTerm(dept.nome, this.searchTerm)}
                </label>
            </div>
        `).join('');

        // Adicionar event listeners
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateTargetSummary());
        });
    }

    highlightSearchTerm(text, searchTerm) {
        return SurveyUtils.highlightSearchTerm(text, searchTerm);
    }

    handleTargetTypeChange() {
        const targetType = document.querySelector('input[name="target_type"]:checked').value;
        
        // Mostrar/ocultar seções
        document.getElementById('filiais-section').style.display = 
            (targetType === 'filiais' || targetType === 'ambos') ? 'block' : 'none';
        
        document.getElementById('departamentos-section').style.display = 
            (targetType === 'departamentos' || targetType === 'ambos') ? 'block' : 'none';

        // Limpar pesquisa quando mudar o tipo
        if (targetType !== 'departamentos' && targetType !== 'ambos') {
            this.clearDepartamentoSearch();
        } else if (targetType === 'departamentos' || targetType === 'ambos') {
            // Garantir que a lista seja renderizada quando a seção for exibida
            if (this.filtros.departamentos && this.filtros.departamentos.length > 0) {
                this.departamentosFiltrados = [...this.filtros.departamentos];
                this.renderDepartamentosList();
            }
        }

        this.updateTargetSummary();
    }

    handleDepartamentoSearch(searchTerm) {
        this.searchTerm = searchTerm.trim();
        
        // Atualizar botão de limpar
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.style.display = this.searchTerm ? 'block' : 'none';
        }

        // Filtrar departamentos
        if (this.searchTerm === '') {
            this.departamentosFiltrados = [...this.filtros.departamentos];
        } else {
            this.departamentosFiltrados = this.filtros.departamentos.filter(dept => 
                dept.nome.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        }

        // Atualizar contador de resultados
        this.updateSearchResultsInfo();

        // Re-renderizar lista
        this.renderDepartamentosList();
    }

    clearDepartamentoSearch() {
        const searchInput = document.getElementById('departamento-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }

        this.handleDepartamentoSearch('');
    }

    updateSearchResultsInfo() {
        const resultsInfo = document.getElementById('search-results-info');
        const searchCount = document.getElementById('search-count');
        
        if (this.searchTerm) {
            resultsInfo.style.display = 'block';
            searchCount.textContent = this.departamentosFiltrados.length;
        } else {
            resultsInfo.style.display = 'none';
        }
    }

    updateTargetSummary() {
        const targetType = document.querySelector('input[name="target_type"]:checked').value;
        const descriptionEl = document.getElementById('target-description');
        const countEl = document.getElementById('target-count');

        let description = '';
        let selectedFiliais = [];
        let selectedDepartamentos = [];

        switch (targetType) {
            case 'todos':
                description = 'Todos os funcionários';
                break;
            
            case 'filiais':
                selectedFiliais = Array.from(document.querySelectorAll('input[name="filiais"]:checked'))
                    .map(cb => cb.dataset.nome);
                description = selectedFiliais.length > 0 
                    ? `${selectedFiliais.length} filiais selecionadas`
                    : 'Nenhuma filial selecionada';
                break;
            
            case 'departamentos':
                selectedDepartamentos = Array.from(document.querySelectorAll('input[name="departamentos"]:checked'))
                    .map(cb => cb.dataset.nome);
                description = selectedDepartamentos.length > 0 
                    ? `${selectedDepartamentos.length} departamentos selecionados`
                    : 'Nenhum departamento selecionado';
                break;
            
            case 'ambos':
                selectedFiliais = Array.from(document.querySelectorAll('input[name="filiais"]:checked'))
                    .map(cb => cb.dataset.nome);
                selectedDepartamentos = Array.from(document.querySelectorAll('input[name="departamentos"]:checked'))
                    .map(cb => cb.dataset.nome);
                
                const parts = [];
                if (selectedFiliais.length > 0) parts.push(`${selectedFiliais.length} filiais`);
                if (selectedDepartamentos.length > 0) parts.push(`${selectedDepartamentos.length} departamentos`);
                
                description = parts.length > 0 ? parts.join(' e ') + ' selecionados' : 'Nenhum filtro selecionado';
                break;
        }

        descriptionEl.textContent = description;
        
        // Mostrar detalhes se houver seleções específicas
        let details = [];
        if (selectedFiliais.length > 0 && selectedFiliais.length <= 5) {
            details.push('Filiais: ' + selectedFiliais.join(', '));
        }
        if (selectedDepartamentos.length > 0 && selectedDepartamentos.length <= 5) {
            details.push('Departamentos: ' + selectedDepartamentos.join(', '));
        }
        
        countEl.innerHTML = details.length > 0 ? details.map(d => `<div>${d}</div>`).join('') : '';
    }

    addFirstQuestion() {
        this.addQuestion();
    }

    addQuestion() {
        const questionId = Date.now();
        const questionHtml = QuestionRenderer.renderForCreation({ tipo: 'texto_livre' }, questionId);
        
        document.getElementById('perguntas-container').insertAdjacentHTML('beforeend', questionHtml);
        this.perguntas.push({ id: questionId, tipo: 'texto_livre' });
        this.updateQuestionNumbers();
        this.renderQuestionOptions(questionId, 'texto_livre');
    }

    removeQuestion(questionId) {
        if (this.perguntas.length <= 1) {
            this.showError('Deve haver pelo menos uma pergunta');
            return;
        }
        
        document.querySelector(`[data-question-id="${questionId}"]`).remove();
        this.perguntas = this.perguntas.filter(q => q.id !== questionId);
        this.updateQuestionNumbers();
    }

    setQuestionType(questionId, tipo) {
        const questionCard = document.querySelector(`[data-question-id="${questionId}"]`);
        
        // Atualizar visual dos tipos
        questionCard.querySelectorAll('.type-option').forEach(option => {
            option.classList.toggle('active', option.dataset.type === tipo);
        });
        
        // Atualizar array de perguntas
        const pergunta = this.perguntas.find(q => q.id === questionId);
        if (pergunta) pergunta.tipo = tipo;
        
        // Renderizar opções específicas do tipo
        this.renderQuestionOptions(questionId, tipo);
    }

    renderQuestionOptions(questionId, tipo) {
        const container = document.getElementById(`question-options-${questionId}`);
        container.innerHTML = QuestionRenderer.renderOptionsForType(questionId, tipo);
    }

    addOption(questionId) {
        const container = document.getElementById(`options-${questionId}`);
        const optionCount = container.children.length + 1;
        
        const optionHtml = `
            <div class="option-input">
                <input type="text" name="opcao_${questionId}_${optionCount}" placeholder="Opção ${optionCount}" required>
                <button type="button" class="btn-icon btn-danger" onclick="this.parentElement.remove()">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', optionHtml);
    }

    updateQuestionNumbers() {
        const questionCards = document.querySelectorAll('.question-card');
        questionCards.forEach((card, index) => {
            const number = index + 1;
            card.querySelector('.question-number').textContent = number;
            card.querySelector('.question-title').textContent = `Pergunta ${number}`;
        });
    }

    async submitSurvey() {
        try {
            this.showLoading(true);
            this.hideMessages();
            
            const formData = this.collectFormData();
            
            // Validar dados
            const validation = this.validateFormData(formData);
            if (!validation.valid) {
                this.showError(validation.message);
                return;
            }
            
            const result = await SurveyAPI.createSurvey(formData);
            
            this.showSuccess('Pesquisa criada com sucesso!');
            SurveyUtils.notifyParentWindow('SURVEY_CREATED', { survey: result.survey });
            
            setTimeout(() => window.close(), 2000);
            
        } catch (error) {
            console.error('Erro ao enviar pesquisa:', error);
            this.showError('Erro ao enviar pesquisa. Tente novamente.');
        } finally {
            this.showLoading(false);
        }
    }

    collectFormData() {
        const form = document.getElementById('surveyForm');
        return SurveyUtils.collectFormData(form, this.perguntas);
    }

    validateFormData(data) {
        return SurveyValidator.validateSurveyData(data);
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('surveyForm').style.display = show ? 'none' : 'block';
    }

    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.scrollIntoView({ behavior: 'smooth' });
    }

    showSuccess(message) {
        const successEl = document.getElementById('success');
        successEl.textContent = message;
        successEl.style.display = 'block';
        successEl.scrollIntoView({ behavior: 'smooth' });
    }

    hideMessages() {
        document.getElementById('error').style.display = 'none';
        document.getElementById('success').style.display = 'none';
    }
}

// Inicializar quando a página carregar
let novaPesquisa;
document.addEventListener('DOMContentLoaded', () => {
    novaPesquisa = new NovaPesquisa();
});

window.setQuestionType = (questionId, tipo) => {
    if (novaPesquisa) {
        novaPesquisa.setQuestionType(questionId, tipo);
    }
};

window.removeQuestion = (questionId) => {
    if (novaPesquisa) {
        novaPesquisa.removeQuestion(questionId);
    }
};

window.addOption = (questionId) => {
    if (novaPesquisa) {
        novaPesquisa.addOption(questionId);
    }
};