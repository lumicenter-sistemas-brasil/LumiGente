// Pesquisas - API Client
const SurveyAPI = {
    async getFiltros() {
        const response = await fetch('/api/surveys/meta/filtros');
        if (!response.ok) throw new Error('Erro ao carregar filtros');
        return response.json();
    },

    async getSurvey(id) {
        const response = await fetch(`/api/surveys/${id}`);
        if (!response.ok) throw new Error('Erro ao carregar pesquisa');
        return response.json();
    },

    async createSurvey(data) {
        const response = await fetch('/api/surveys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar pesquisa');
        }
        return response.json();
    },

    async submitResponse(surveyId, respostas) {
        const response = await fetch(`/api/surveys/${surveyId}/responder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ respostas })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao enviar respostas');
        }
        return response.json();
    },

    async getResults(surveyId) {
        const response = await fetch(`/api/surveys/${surveyId}/resultados`);
        if (!response.ok) throw new Error('Erro ao carregar resultados');
        return response.json();
    },

    async reopenSurvey(surveyId, novaData) {
        const response = await fetch(`/api/surveys/${surveyId}/reabrir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nova_data_encerramento: novaData })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        return response.json();
    },

    async closeSurvey(surveyId) {
        const response = await fetch(`/api/surveys/${surveyId}/encerrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao encerrar pesquisa');
        }
        return response.json();
    },

    async searchUsers(query, surveyId) {
        if (surveyId) {
            // Buscar apenas usuários elegíveis da pesquisa
            const response = await fetch(`/api/surveys/${surveyId}/usuarios-elegiveis?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Erro ao buscar usuários elegíveis');
            return response.json();
        } else {
            // Fallback: buscar todos os usuários (caso não tenha surveyId)
            const response = await fetch(`/api/users/list?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Erro ao buscar usuários');
            return response.json();
        }
    }
};

window.SurveyAPI = SurveyAPI;
