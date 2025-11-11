class SurveyResponseForm {
    constructor() {
        this.surveyId = null;
        this.survey = null;
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.surveyId = urlParams.get('id');
        
        if (!this.surveyId) {
            this.showError('ID da pesquisa não encontrado na URL');
            return;
        }

        this.loadSurvey();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('response-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitResponse();
        });
    }

    async loadSurvey() {
        try {
            this.survey = await SurveyAPI.getSurvey(this.surveyId);
            
            if (!this.survey.pode_responder) {
                throw new Error('Você não pode responder esta pesquisa');
            }

            if (this.survey.ja_respondeu) {
                this.showAlreadyResponded();
                return;
            }

            if (this.survey.status !== 'Ativa') {
                throw new Error('Esta pesquisa não está mais ativa');
            }

            this.renderSurvey();
            
        } catch (error) {
            console.error('❌ Erro ao carregar pesquisa:', error);
            this.showError(error.message);
        }
    }

    renderSurvey() {
        document.getElementById('survey-title').textContent = this.survey.titulo;
        document.getElementById('survey-status').textContent = 
            `${this.survey.total_perguntas} pergunta(s) • ${this.survey.anonima ? 'Anônima' : 'Identificada'}`;

        if (this.survey.descricao) {
            document.getElementById('survey-description').textContent = this.survey.descricao;
            document.getElementById('survey-description').style.display = 'block';
        }

        const questionsContainer = document.getElementById('questions-container');
        questionsContainer.innerHTML = this.survey.perguntas
            .map((pergunta, index) => QuestionRenderer.renderForResponse(pergunta, index))
            .join('');

        // Adicionar event listeners para elementos interativos
        this.setupInteractiveElements();

        document.getElementById('loading').style.display = 'none';
        document.getElementById('survey-content').style.display = 'block';
    }

    setupInteractiveElements() {
        // Event listeners para opções de múltipla escolha e sim/não
        document.querySelectorAll('.option-label').forEach(label => {
            label.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
        });

        // Event listeners para escala numérica
        document.querySelectorAll('.scale-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    // Desmarcar outros radios do mesmo grupo
                    const name = radio.name;
                    document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.checked = false);
                    // Marcar o selecionado
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    }

    async submitResponse() {
        try {
            const formData = new FormData(document.getElementById('response-form'));
            
            const validation = SurveyValidator.validateResponse(this.survey.perguntas, formData);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            const respostas = SurveyUtils.collectResponses(this.survey.perguntas, formData);
            
            if (respostas.length === 0) {
                throw new Error('Você deve responder pelo menos uma pergunta');
            }

            await SurveyAPI.submitResponse(this.surveyId, respostas);
            this.showSuccess();

        } catch (error) {
            console.error('❌ Erro ao enviar resposta:', error);
            this.showError(error.message);
        }
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('survey-content').style.display = 'none';
        document.getElementById('success-message').style.display = 'none';
        
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    showSuccess() {
        document.getElementById('survey-content').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
        
        const successElement = document.getElementById('success-message');
        successElement.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 8px;"></i>
            <p style="margin: 0; font-weight: 600;">Resposta enviada com sucesso!</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">Obrigado por participar da pesquisa.</p>
            <button onclick="window.close()" class="btn btn-primary" style="margin-top: 16px;">
                <i class="fas fa-times"></i> Fechar
            </button>
        `;
        successElement.style.display = 'block';

        SurveyUtils.notifyParentWindow('SURVEY_RESPONSE_SUBMITTED', { surveyId: this.surveyId });
        setTimeout(() => window.close(), 3000);
    }

    showAlreadyResponded() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('survey-content').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
        
        const successElement = document.getElementById('success-message');
        successElement.innerHTML = `
            <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 8px;"></i>
            <p style="margin: 0; font-weight: 600;">Você já respondeu esta pesquisa</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">Obrigado por sua participação!</p>
            <button onclick="window.close()" class="btn btn-primary" style="margin-top: 16px;">
                <i class="fas fa-times"></i> Fechar
            </button>
        `;
        successElement.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => new SurveyResponseForm());
