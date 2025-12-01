class NovaPesquisa {
    constructor() {
        this.filtros = { filiais: [], departamentos: [] };
        this.perguntas = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFiltros();
        this.addFirstQuestion();
    }

    setupEventListeners() {
        document.querySelectorAll('input[name="target_type"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleTargetTypeChange());
        });

        document.getElementById('add-question').addEventListener('click', () => {
            this.addQuestion();
        });

        document.getElementById('surveyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitSurvey();
        });

        document.getElementById('filial-select')?.addEventListener('change', () => this.updateTargetSummary());
        document.getElementById('filial-filter')?.addEventListener('change', (e) => this.filterDepartamentos(e.target.value));
        document.getElementById('departamento-select')?.addEventListener('change', () => this.updateTargetSummary());
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
        const filialSelect = document.getElementById('filial-select');
        const filialFilter = document.getElementById('filial-filter');
        
        if (!this.filtros.filiais || this.filtros.filiais.length === 0) return;

        const options = this.filtros.filiais.map(f => 
            `<option value="${f.codigo}" data-nome="${f.nome}">${f.nome} (${f.codigo})</option>`
        ).join('');
        
        if (filialSelect) filialSelect.innerHTML += options;
        if (filialFilter) filialFilter.innerHTML += options;
    }

    renderDepartamentos() {
        const select = document.getElementById('departamento-select');
        if (!this.filtros.departamentos || this.filtros.departamentos.length === 0) return;

        this.allDepartamentos = this.filtros.departamentos;
        console.log('Departamentos carregados:', this.allDepartamentos);
        this.filterDepartamentos('');
    }

    filterDepartamentos(filialCodigo) {
        const select = document.getElementById('departamento-select');
        select.innerHTML = '<option value="">Selecione um departamento...</option>';
        
        let departamentosFiltrados = this.allDepartamentos;
        if (filialCodigo && filialCodigo.trim() !== '') {
            // Quando há filtro de filial, mostrar apenas dessa filial + departamentos sem filial
            departamentosFiltrados = this.allDepartamentos.filter(d => 
                d.filial === filialCodigo || d.filial === 'SEM FILIAL' || !d.filial
            );
        }
        
        console.log('Departamentos filtrados:', departamentosFiltrados);
        
        const options = departamentosFiltrados.map(d => 
            `<option value="${d.departamento_unico}" data-nome="${d.nome}" data-filial="${d.filial || 'SEM FILIAL'}">${d.nome}${d.filial && d.filial !== 'SEM FILIAL' ? ' (' + d.filial + ')' : ''}</option>`
        ).join('');
        
        select.innerHTML += options;
    }

    handleTargetTypeChange() {
        const targetType = document.querySelector('input[name="target_type"]:checked').value;
        
        document.getElementById('filial-section').style.display = targetType === 'filial' ? 'block' : 'none';
        document.getElementById('departamento-section').style.display = targetType === 'departamento' ? 'block' : 'none';

        if (targetType !== 'filial') document.getElementById('filial-select').value = '';
        if (targetType !== 'departamento') {
            document.getElementById('filial-filter').value = '';
            document.getElementById('departamento-select').value = '';
        }

        this.updateTargetSummary();
    }

    updateTargetSummary() {
        const targetType = document.querySelector('input[name="target_type"]:checked').value;
        const descriptionEl = document.getElementById('target-description');
        const countEl = document.getElementById('target-count');

        let description = 'Todos os funcionários';
        let details = '';

        if (targetType === 'filial') {
            const select = document.getElementById('filial-select');
            const selectedOption = select.options[select.selectedIndex];
            description = selectedOption.value ? selectedOption.dataset.nome : 'Nenhuma filial selecionada';
        } else if (targetType === 'departamento') {
            const select = document.getElementById('departamento-select');
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption.value) {
                description = selectedOption.dataset.nome;
                details = `<div>Filial: ${selectedOption.dataset.filial}</div>`;
            } else {
                description = 'Nenhum departamento selecionado';
            }
        }

        descriptionEl.textContent = description;
        countEl.innerHTML = details;
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