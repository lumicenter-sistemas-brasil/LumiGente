// Avaliações - Handlers Module
const AvaliacoesHandlers = {
    respostasAvaliacao: {},

    selecionarOpcao(elemento, perguntaId, opcaoId) {
        const parent = elemento.parentElement;
        parent.querySelectorAll('.opcao-resposta-item').forEach(item => item.classList.remove('selecionada'));
        elemento.classList.add('selecionada');
        
        const radio = elemento.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        
        this.respostasAvaliacao[perguntaId] = {
            tipo: 'multipla_escolha',
            opcaoId: opcaoId,
            valor: opcaoId
        };
    },

    selecionarEscala(elemento, perguntaId, valor) {
        const parent = elemento.parentElement;
        parent.querySelectorAll('.escala-opcao').forEach(item => item.classList.remove('selecionada'));
        elemento.classList.add('selecionada');
        
        document.getElementById(`resposta-${perguntaId}`).value = valor;
        
        this.respostasAvaliacao[perguntaId] = {
            tipo: 'escala',
            valor: valor
        };
    },

    selecionarSimNao(elemento, perguntaId, valor) {
        const parent = elemento.parentElement;
        parent.querySelectorAll('.simnao-opcao').forEach(item => item.classList.remove('selecionada'));
        elemento.classList.add('selecionada');
        
        document.getElementById(`resposta-${perguntaId}`).value = valor;
        
        this.respostasAvaliacao[perguntaId] = {
            tipo: 'sim_nao',
            valor: valor
        };
    },

    async enviarRespostas(avaliacaoAtual, currentUser) {
        if (!avaliacaoAtual) {
            alert('Erro: Avaliação não encontrada');
            return;
        }
        
        try {
            const textareas = document.querySelectorAll('#formulario-avaliacao textarea');
            textareas.forEach(textarea => {
                const perguntaId = parseInt(textarea.id.replace('resposta-', ''));
                const valor = textarea.value.trim();
                
                if (valor || textarea.hasAttribute('required')) {
                    this.respostasAvaliacao[perguntaId] = {
                        tipo: 'texto',
                        valor: valor
                    };
                }
            });
            
            const tipo = avaliacaoAtual.TipoAvaliacao.includes('45') ? '45' : '90';
            const responseRespostas = await fetch(`/api/avaliacoes/${avaliacaoAtual.Id}/respostas`);
            const dadosRespostas = await responseRespostas.json();
            const perguntas = dadosRespostas.perguntas;
            
            const perguntasNaoRespondidas = [];
            
            for (const pergunta of perguntas) {
                if (pergunta.Obrigatoria) {
                    const resposta = this.respostasAvaliacao[pergunta.Id];
                    if (!resposta || !resposta.valor || resposta.valor.toString().trim() === '') {
                        perguntasNaoRespondidas.push({
                            ordem: pergunta.Ordem,
                            pergunta: pergunta.Pergunta.substring(0, 50)
                        });
                    }
                }
            }
            
            if (perguntasNaoRespondidas.length > 0) {
                const detalhes = perguntasNaoRespondidas.map(p => `  ${p.ordem}. ${p.pergunta}...`).join('\n');
                alert(`Por favor, responda todas as perguntas obrigatórias (marcadas com *).\n\nPerguntas pendentes:\n${detalhes}`);
                return;
            }
            
            const eColaborador = avaliacaoAtual.UserId === currentUser.userId;
            const tipoRespondente = eColaborador ? 'Colaborador' : 'Gestor';
            
            const respostasArray = perguntas.map(pergunta => {
                const resposta = this.respostasAvaliacao[pergunta.Id];
                
                return {
                    perguntaId: pergunta.Id,
                    perguntaAvaliacaoId: pergunta.Id,
                    tipoQuestionario: tipo,
                    pergunta: pergunta.Pergunta,
                    tipoPergunta: pergunta.TipoPergunta,
                    resposta: resposta?.valor?.toString() || '',
                    opcaoSelecionadaId: resposta?.opcaoId || null,
                    opcoes: pergunta.Opcoes || []
                };
            });
            
            const saveResponse = await fetch('/api/avaliacoes/responder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    avaliacaoId: avaliacaoAtual.Id,
                    tipoRespondente: tipoRespondente,
                    respostas: respostasArray
                })
            });
            
            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                if (errorData.error && errorData.error.includes('expirada')) {
                    alert('⏰ ' + errorData.error + '\n\n' + (errorData.message || 'Entre em contato com o RH se necessário.'));
                    fecharModalResponderAvaliacao();
                    loadAvaliacoes();
                    return;
                }
                throw new Error(errorData.error || 'Erro ao salvar respostas');
            }
            
            alert('Avaliação respondida com sucesso!');
            fecharModalResponderAvaliacao();
            loadAvaliacoes();
            
        } catch (error) {
            console.error('Erro ao enviar respostas:', error);
            alert('Erro ao enviar respostas: ' + error.message);
        }
    }
};

// Funções globais para compatibilidade
function selecionarOpcao(elemento, perguntaId, opcaoId) {
    AvaliacoesHandlers.selecionarOpcao(elemento, perguntaId, opcaoId);
}

function selecionarEscala(elemento, perguntaId, valor) {
    AvaliacoesHandlers.selecionarEscala(elemento, perguntaId, valor);
}

function selecionarSimNao(elemento, perguntaId, valor) {
    AvaliacoesHandlers.selecionarSimNao(elemento, perguntaId, valor);
}

function enviarRespostasAvaliacao() {
    AvaliacoesHandlers.enviarRespostas(window.avaliacaoAtual, window.currentUser);
}

window.respostasAvaliacao = AvaliacoesHandlers.respostasAvaliacao;
