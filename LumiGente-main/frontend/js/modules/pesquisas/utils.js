// Pesquisas - Utilities
const SurveyUtils = {
    formatDate(dateString) {
        if (!dateString) return 'Não definido';
        
        const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        
        if (parts) {
            const date = new Date(
                parseInt(parts[1]),
                parseInt(parts[2]) - 1,
                parseInt(parts[3]),
                parseInt(parts[4]),
                parseInt(parts[5]),
                parseInt(parts[6])
            );
            
            // Adicionar 3 horas para compensar o timezone UTC-3
            date.setHours(date.getHours() + 3);
            
            return date.toLocaleDateString('pt-BR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        const date = new Date(dateString);
        date.setHours(date.getHours() + 3);
        
        return date.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') return text;
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },

    notifyParentWindow(type, data) {
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type, ...data }, '*');
                console.log(`✅ Mensagem enviada para janela pai: ${type}`);
            } catch (error) {
                console.warn('⚠️ Não foi possível notificar janela pai:', error);
            }
        }
    },

    collectFormData(form, perguntas) {
        const formData = new FormData(form);
        
        const data = {
            titulo: formData.get('titulo'),
            descricao: formData.get('descricao'),
            data_inicio: formData.get('data_inicio') || null,
            data_encerramento: formData.get('data_encerramento') || null,
            anonima: formData.has('anonima'),
            perguntas: []
        };
        
        const targetType = document.querySelector('input[name="target_type"]:checked')?.value;
        data.target_type = targetType || 'todos';
        
        if (targetType === 'filial') {
            const select = document.getElementById('filial-select');
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption.value) {
                data.filial_filtro = {
                    codigo: selectedOption.value,
                    nome: selectedOption.dataset.nome
                };
            }
        }
        
        if (targetType === 'departamento') {
            const select = document.getElementById('departamento-select');
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption.value) {
                data.departamento_filtro = {
                    departamento_unico: selectedOption.value,
                    nome: selectedOption.dataset.nome,
                    filial: selectedOption.dataset.filial
                };
            }
        }
        
        perguntas.forEach(pergunta => {
            const perguntaData = {
                texto: formData.get(`pergunta_texto_${pergunta.id}`),
                tipo: pergunta.tipo,
                obrigatoria: formData.has(`pergunta_obrigatoria_${pergunta.id}`)
            };
            
            if (pergunta.tipo === 'multipla_escolha') {
                perguntaData.opcoes = [];
                let i = 1;
                while (formData.get(`opcao_${pergunta.id}_${i}`)) {
                    perguntaData.opcoes.push(formData.get(`opcao_${pergunta.id}_${i}`));
                    i++;
                }
            } else if (pergunta.tipo === 'escala') {
                perguntaData.escala_min = parseInt(formData.get(`escala_min_${pergunta.id}`)) || 1;
                perguntaData.escala_max = parseInt(formData.get(`escala_max_${pergunta.id}`)) || 5;
            }
            
            data.perguntas.push(perguntaData);
        });
        
        return data;
    },

    collectResponses(perguntas, formData) {
        const respostas = [];
        
        for (const pergunta of perguntas) {
            const fieldName = `resposta_${pergunta.Id}`;
            const valor = formData.get(fieldName);
            
            if (valor) {
                const resposta = { question_id: pergunta.Id };
                
                if (pergunta.tipo === 'texto_livre' || pergunta.tipo === 'sim_nao') {
                    resposta.resposta_texto = valor;
                } else if (pergunta.tipo === 'escala') {
                    resposta.resposta_numerica = parseInt(valor);
                } else if (pergunta.tipo === 'multipla_escolha') {
                    resposta.option_id = parseInt(valor);
                }
                
                respostas.push(resposta);
            }
        }
        
        return respostas;
    }
};

window.SurveyUtils = SurveyUtils;
