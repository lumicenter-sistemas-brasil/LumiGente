const AvaliacoesDesempenhoManager = require('../services/AvaliacoesDesempenhoManager');

// Helper para verificar permissão de RH/Admin
function verificarPermissaoAdmin(req) {
    const user = req.session.user;
    if (!user) return false;

    const departamento = (user.descricaoDepartamento || user.DescricaoDepartamento || user.departamento || '').toUpperCase().trim();

    const isHR = departamento.includes('SUPERVISAO RH') ||
        departamento.includes('RH') ||
        departamento.includes('RECURSOS HUMANOS');
    const isTD = departamento.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
        departamento.includes('TREINAMENTO') ||
        departamento.includes('DESENVOLVIMENTO') ||
        departamento.includes('T&D');
    const isAdmin = user.role === 'Administrador';

    return isAdmin || isHR || isTD;
}

exports.criarAvaliacao = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { userIds, titulo, dataLimite, perguntas } = req.body;
        const criadoPor = req.session.user.userId;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !titulo) {
            return res.status(400).json({ error: 'Dados inválidos' });
        }

        const ids = await AvaliacoesDesempenhoManager.criarAvaliacao({
            userIds,
            titulo,
            dataLimite,
            criadoPor,
            perguntas // Passar perguntas personalizadas (opcional)
        });

        res.json({ success: true, message: `${ids.length} avaliações criadas com sucesso`, ids });
    } catch (error) {
        console.error('Erro ao criar avaliação:', error);
        res.status(500).json({ error: 'Erro ao criar avaliação' });
    }
};

exports.listarMinhasAvaliacoes = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        // Busca onde sou o avaliado
        const comoColaborador = await AvaliacoesDesempenhoManager.listarAvaliacoes({ userId });
        // Busca onde sou o gestor
        const comoGestor = await AvaliacoesDesempenhoManager.listarAvaliacoes({ gestorId: userId });

        res.json({ comoColaborador, comoGestor });
    } catch (error) {
        console.error('Erro ao listar minhas avaliações:', error);
        res.status(500).json({ error: 'Erro ao listar avaliações' });
    }
};

exports.listarTodasAvaliacoes = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const avaliacoes = await AvaliacoesDesempenhoManager.listarAvaliacoes({});
        res.json(avaliacoes);
    } catch (error) {
        console.error('Erro ao listar todas as avaliações:', error);
        res.status(500).json({ error: 'Erro ao listar avaliações' });
    }
};

exports.getAvaliacao = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.session.user;
        const avaliacao = await AvaliacoesDesempenhoManager.getAvaliacao(id, user.userId);

        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        // Verificar permissão (Participante ou Admin)
        const isAdmin = verificarPermissaoAdmin(req);
        const isParticipante = avaliacao.UserId === user.userId || avaliacao.GestorId === user.userId;

        if (!isAdmin && !isParticipante) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Incluir feedback do gestor se existir
        if (avaliacao.Status === 'Concluída' && avaliacao.FeedbackGestor) {
            avaliacao.FeedbackGestor = avaliacao.FeedbackGestor;
        }

        res.json(avaliacao);
    } catch (error) {
        console.error('Erro ao buscar avaliação:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliação' });
    }
};

exports.responderAvaliacao = async (req, res) => {
    try {
        const { id } = req.params;
        const { respostas } = req.body;
        const user = req.session.user;

        const avaliacao = await AvaliacoesDesempenhoManager.getAvaliacao(id);
        if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });

        let tipoRespondente = null;
        if (avaliacao.UserId === user.userId) tipoRespondente = 'colaborador';
        else if (avaliacao.GestorId === user.userId) tipoRespondente = 'gestor';
        else return res.status(403).json({ error: 'Você não é participante desta avaliação' });

        await AvaliacoesDesempenhoManager.salvarRespostas(id, respostas, tipoRespondente);

        res.json({ success: true, message: 'Respostas salvas com sucesso' });
    } catch (error) {
        console.error('Erro ao responder avaliação:', error);
        res.status(500).json({ error: 'Erro ao responder avaliação' });
    }
};

exports.calibrarAvaliacao = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { id } = req.params;
        const { respostas, consideracoesFinais } = req.body;
        const criadoPor = req.session.user.userId;

        await AvaliacoesDesempenhoManager.salvarCalibragem(id, { respostas, consideracoesFinais }, criadoPor);

        res.json({ success: true, message: 'Calibragem salva com sucesso' });
    } catch (error) {
        console.error('Erro ao calibrar avaliação:', error);
        res.status(500).json({ error: 'Erro ao calibrar avaliação' });
    }
};

exports.salvarFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedback } = req.body;
        const user = req.session.user;

        const avaliacao = await AvaliacoesDesempenhoManager.getAvaliacao(id);
        if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });

        const isAdmin = verificarPermissaoAdmin(req);
        if (avaliacao.GestorId !== user.userId && !isAdmin) {
            return res.status(403).json({ error: 'Apenas o gestor pode salvar o feedback' });
        }

        await AvaliacoesDesempenhoManager.salvarFeedback(id, feedback, user.userId);

        res.json({ success: true, message: 'Feedback salvo com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar feedback:', error);
        res.status(500).json({ error: 'Erro ao salvar feedback' });
    }
};

exports.salvarPDI = async (req, res) => {
    try {
        const { id } = req.params;
        const { pdi } = req.body;
        const user = req.session.user;

        const avaliacao = await AvaliacoesDesempenhoManager.getAvaliacao(id);
        if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });

        const isAdmin = verificarPermissaoAdmin(req);
        if (avaliacao.GestorId !== user.userId && !isAdmin) {
            return res.status(403).json({ error: 'Apenas o gestor pode salvar o PDI' });
        }

        await AvaliacoesDesempenhoManager.salvarPDI(id, pdi, user.userId);

        res.json({ success: true, message: 'PDI salvo com sucesso. Avaliação concluída!' });
    } catch (error) {
        console.error('Erro ao salvar PDI:', error);
        res.status(500).json({ error: 'Erro ao salvar PDI' });
    }
};

exports.getQuestionario = async (req, res) => {
    try {
        const perguntas = await AvaliacoesDesempenhoManager.listarPerguntas();
        res.json(perguntas);
    } catch (error) {
        console.error('Erro ao buscar questionário:', error);
        res.status(500).json({ error: 'Erro ao buscar questionário' });
    }
};

exports.getRespostas = async (req, res) => {
    try {
        const { id } = req.params;
        const respostas = await AvaliacoesDesempenhoManager.listarRespostas(id);
        res.json(respostas);
    } catch (error) {
        console.error('Erro ao buscar respostas:', error);
        res.status(500).json({ error: 'Erro ao buscar respostas' });
    }
};

exports.criarPergunta = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
        const id = await AvaliacoesDesempenhoManager.criarPergunta(req.body);
        res.json({ success: true, id });
    } catch (error) {
        console.error('Erro ao criar pergunta:', error);
        res.status(500).json({ error: 'Erro ao criar pergunta' });
    }
};

exports.atualizarPergunta = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
        const { id } = req.params;
        await AvaliacoesDesempenhoManager.atualizarPergunta(id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar pergunta:', error);
        res.status(500).json({ error: 'Erro ao atualizar pergunta' });
    }
};

exports.excluirPergunta = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
        const { id } = req.params;
        await AvaliacoesDesempenhoManager.excluirPergunta(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir pergunta:', error);
        res.status(500).json({ error: 'Erro ao excluir pergunta' });
    }
};

exports.reordenarPerguntas = async (req, res) => {
    try {
        if (!verificarPermissaoAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
        const { itens } = req.body;
        await AvaliacoesDesempenhoManager.reordenarPerguntas(itens);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao reordenar perguntas:', error);
        res.status(500).json({ error: 'Erro ao reordenar perguntas' });
    }
};

exports.getQuestionarioAvaliacao = async (req, res) => {
    try {
        const { id } = req.params;
        const perguntas = await AvaliacoesDesempenhoManager.listarPerguntasPorAvaliacao(id);
        res.json(perguntas);
    } catch (error) {
        console.error('Erro ao buscar questionário da avaliação:', error);
        res.status(500).json({ error: 'Erro ao buscar questionário' });
    }
};

exports.salvarFeedbackPDI = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedbackGestor, pdi } = req.body;
        const user = req.session.user;

        const avaliacao = await AvaliacoesDesempenhoManager.getAvaliacao(id);
        if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });

        const isAdmin = verificarPermissaoAdmin(req);
        if (avaliacao.GestorId !== user.userId && !isAdmin) {
            return res.status(403).json({ error: 'Apenas o gestor pode salvar o feedback e PDI' });
        }

        await AvaliacoesDesempenhoManager.salvarFeedbackPDI(id, feedbackGestor, pdi, user.userId);

        res.json({ success: true, message: 'Feedback e PDI salvos com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar feedback e PDI:', error);
        res.status(500).json({ error: 'Erro ao salvar feedback e PDI' });
    }
};
