// Pesquisas - Form Validator
const SurveyValidator = {
    validateSurveyData(data) {
        if (!data.titulo || data.titulo.trim() === '') {
            return { valid: false, message: 'Título é obrigatório' };
        }
        
        if (data.perguntas.length === 0) {
            return { valid: false, message: 'Adicione pelo menos uma pergunta' };
        }
        
        for (let i = 0; i < data.perguntas.length; i++) {
            const pergunta = data.perguntas[i];
            
            if (!pergunta.texto || pergunta.texto.trim() === '') {
                return { valid: false, message: `Pergunta ${i + 1}: Texto é obrigatório` };
            }
            
            if (pergunta.tipo === 'multipla_escolha') {
                if (!pergunta.opcoes || pergunta.opcoes.length < 2) {
                    return { valid: false, message: `Pergunta ${i + 1}: Adicione pelo menos 2 opções` };
                }
            }
            
            if (pergunta.tipo === 'escala') {
                if (pergunta.escala_max <= pergunta.escala_min) {
                    return { valid: false, message: `Pergunta ${i + 1}: Valor máximo deve ser maior que o mínimo` };
                }
            }
        }
        
        // Validar filtros
        const targetType = document.querySelector('input[name="target_type"]:checked')?.value;
        if (targetType === 'filiais' && data.filiais_filtro.length === 0) {
            return { valid: false, message: 'Selecione pelo menos uma filial' };
        }
        if (targetType === 'departamentos' && data.departamentos_filtro.length === 0) {
            return { valid: false, message: 'Selecione pelo menos um departamento' };
        }
        if (targetType === 'ambos' && data.filiais_filtro.length === 0 && data.departamentos_filtro.length === 0) {
            return { valid: false, message: 'Selecione pelo menos uma filial ou um departamento' };
        }
        
        return { valid: true };
    },

    validateResponse(perguntas, formData) {
        for (const pergunta of perguntas) {
            const fieldName = `resposta_${pergunta.Id}`;
            const valor = formData.get(fieldName);
            
            if (pergunta.obrigatoria && !valor) {
                return { valid: false, message: `Por favor, responda: ${pergunta.pergunta}` };
            }
        }
        
        return { valid: true };
    }
};

window.SurveyValidator = SurveyValidator;
