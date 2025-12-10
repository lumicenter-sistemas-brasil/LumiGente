const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');
const { hasFullAccess } = require('../utils/permissionsHelper');

function ensureHistoricoAccess(req, res) {
    const user = req.session.user;
    if (!user || !hasFullAccess(user)) {
        res.status(403).json({ error: 'Acesso restrito. Apenas RH/T&D podem visualizar esta informação.' });
        return false;
    }
    return true;
}

exports.getAllObjectives = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const pool = await getDatabasePool();
        const { status, responsavelId, search, dateStart, dateEnd } = req.query;

        const conditions = [];
        const params = [];

        if (status && status !== 'todos') {
            conditions.push('LOWER(o.status) = LOWER(?)');
            params.push(status);
        }

        if (responsavelId) {
            conditions.push(`EXISTS (SELECT 1 FROM ObjetivoResponsaveis ors WHERE ors.objetivo_id = o.Id AND ors.responsavel_id = ?)`);
            params.push(responsavelId);
        }

        if (dateStart) {
            conditions.push('DATE(o.data_inicio) >= ?');
            params.push(dateStart);
        }

        if (dateEnd) {
            conditions.push('DATE(o.data_fim) <= ?');
            params.push(dateEnd);
        }

        if (search) {
            conditions.push(`(o.titulo LIKE ? OR CAST(o.descricao AS CHAR) LIKE ? OR c.NomeCompleto LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        let query = `
            SELECT 
                o.Id,
                o.titulo,
                CAST(o.descricao AS CHAR) AS descricao,
                o.status,
                o.data_inicio,
                o.data_fim,
                o.progresso,
                o.created_at,
                o.updated_at,
                c.NomeCompleto AS criador_nome,
                COALESCE((
                    SELECT GROUP_CONCAT(uInterno.NomeCompleto SEPARATOR '; ')
                    FROM ObjetivoResponsaveis ors
                    JOIN Users uInterno ON uInterno.Id = ors.responsavel_id
                    WHERE ors.objetivo_id = o.Id
                ), '') AS responsaveis,
                (SELECT COUNT(*) FROM ObjetivoCheckins oc WHERE oc.objetivo_id = o.Id) AS total_checkins
            FROM Objetivos o
            LEFT JOIN Users c ON o.criado_por = c.Id
        `;

        if (conditions.length) {
            query += ` WHERE ${conditions.join(' AND ')} `;
        }

        query += `
            ORDER BY o.created_at DESC
            LIMIT 500
        `;

        const [result] = await pool.query(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar objetivos para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar objetivos.' });
    }
};

exports.getAllFeedbacks = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const pool = await getDatabasePool();
        const { type, category, search, dateStart, dateEnd } = req.query;

        const conditions = [];
        const params = [];

        if (type && type !== 'todos') {
            conditions.push('LOWER(f.type) = LOWER(?)');
            params.push(type);
        }

        if (category && category !== 'todos') {
            conditions.push('LOWER(f.category) = LOWER(?)');
            params.push(category);
        }

        if (dateStart) {
            conditions.push('DATE(f.created_at) >= ?');
            params.push(dateStart);
        }

        if (dateEnd) {
            conditions.push('DATE(f.created_at) <= ?');
            params.push(dateEnd);
        }

        if (search) {
            conditions.push(`(f.message LIKE ? OR uFrom.NomeCompleto LIKE ? OR uTo.NomeCompleto LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        let query = `
            SELECT 
                f.Id,
                f.type,
                f.category,
                f.message,
                f.created_at,
                f.from_user_id,
                f.to_user_id,
                uFrom.NomeCompleto AS from_name,
                uTo.NomeCompleto AS to_name,
                uFrom.Departamento AS from_department,
                uTo.Departamento AS to_department,
                (SELECT COUNT(*) FROM FeedbackReplies fr WHERE fr.feedback_id = f.Id) AS replies_count
            FROM Feedbacks f
            JOIN Users uFrom ON uFrom.Id = f.from_user_id
            JOIN Users uTo ON uTo.Id = f.to_user_id
        `;

        if (conditions.length) {
            query += ` WHERE ${conditions.join(' AND ')} `;
        }

        query += ' ORDER BY f.created_at DESC LIMIT 500';

        const [result] = await pool.query(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar feedbacks para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar feedbacks.' });
    }
};

exports.getFeedbackMessages = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const { id } = req.params;
        const pool = await getDatabasePool();

        const [result] = await pool.query(`
            SELECT fr.Id, fr.user_id, fr.reply_text AS message, fr.created_at,
                   u.NomeCompleto AS user_name, u.Departamento AS department,
                   fr.reply_to_id, fr.reply_to_message, fr.reply_to_user
            FROM FeedbackReplies fr
            JOIN Users u ON u.Id = fr.user_id
            WHERE fr.feedback_id = ?
            ORDER BY fr.created_at ASC
        `, [id]);

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar mensagens do feedback para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar mensagens de feedback.' });
    }
};

exports.getAllRecognitions = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const pool = await getDatabasePool();
        const { badge, search, dateStart, dateEnd } = req.query;

        const conditions = [];
        const params = [];

        if (badge && badge !== 'todos') {
            if (badge === 'Outros') {
                conditions.push(`r.badge NOT IN ('Inovador', 'Colaborativo', 'Dedicado', 'Criativo')`);
            } else {
                conditions.push('LOWER(r.badge) = LOWER(?)');
                params.push(badge);
            }
        }

        if (search) {
            conditions.push(`(r.message LIKE ? OR uFrom.NomeCompleto LIKE ? OR uTo.NomeCompleto LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (dateStart) {
            conditions.push('DATE(r.created_at) >= ?');
            params.push(dateStart);
        }

        if (dateEnd) {
            conditions.push('DATE(r.created_at) <= ?');
            params.push(dateEnd);
        }

        let query = `
            SELECT 
                r.Id,
                r.badge,
                r.message,
                r.points,
                r.created_at,
                uFrom.NomeCompleto AS from_name,
                uFrom.Departamento AS from_department,
                uTo.NomeCompleto AS to_name,
                uTo.Departamento AS to_department
            FROM Recognitions r
            JOIN Users uFrom ON uFrom.Id = r.from_user_id
            JOIN Users uTo ON uTo.Id = r.to_user_id
        `;

        if (conditions.length) {
            query += ` WHERE ${conditions.join(' AND ')} `;
        }

        query += ' ORDER BY r.created_at DESC LIMIT 500';

        const [result] = await pool.query(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar reconhecimentos para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar reconhecimentos.' });
    }
};

exports.getHumorEntries = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const pool = await getDatabasePool();
        const { department, minScore, maxScore, dateStart, dateEnd, search } = req.query;

        const conditions = ['u.IsActive = 1'];
        const params = [];

        if (department && department !== 'todos') {
            conditions.push('u.Departamento = ?');
            params.push(department);
        }

        if (minScore) {
            conditions.push('CAST(dm.score AS SIGNED) >= ?');
            params.push(parseInt(minScore, 10));
        }

        if (maxScore) {
            conditions.push('CAST(dm.score AS SIGNED) <= ?');
            params.push(parseInt(maxScore, 10));
        }

        if (dateStart) {
            conditions.push('DATE(dm.created_at) >= ?');
            params.push(dateStart);
        }

        if (dateEnd) {
            conditions.push('DATE(dm.created_at) <= ?');
            params.push(dateEnd);
        }

        if (search) {
            conditions.push('(u.NomeCompleto LIKE ? OR dm.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        let query = `
            SELECT 
                dm.Id,
                dm.score,
                dm.description,
                dm.created_at,
                u.NomeCompleto AS user_name,
                u.Departamento AS department
            FROM DailyMood dm
            JOIN Users u ON u.Id = dm.user_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY dm.created_at DESC
            LIMIT 500
        `;

        const [result] = await pool.query(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar dados de humor para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de humor.' });
    }
};

exports.getAllPDIs = async (req, res) => {
    if (!ensureHistoricoAccess(req, res)) return;

    try {
        const pool = await getDatabasePool();
        const { search, dateStart, dateEnd } = req.query;

        // Verificar qual coluna existe (PrazoConclusao ou PrazoRevisao)
        const [colunaCheck] = await pool.query(`
            SELECT COUNT(*) as existe
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
        `);
        const usarPrazoConclusao = colunaCheck[0].existe > 0;
        const colunaPrazoSelect = usarPrazoConclusao 
            ? 'p.PrazoConclusao AS prazo_revisao' 
            : 'p.PrazoRevisao AS prazo_revisao';

        const conditions = [];
        const params = [];

        if (search) {
            conditions.push(`(CAST(p.Objetivos AS CHAR) LIKE ? OR CAST(p.Acoes AS CHAR) LIKE ? OR uColab.NomeCompleto LIKE ? OR uGestor.NomeCompleto LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (dateStart) {
            conditions.push('DATE(p.DataCriacao) >= ?');
            params.push(dateStart);
        }

        if (dateEnd) {
            conditions.push('DATE(p.DataCriacao) <= ?');
            params.push(dateEnd);
        }

        let query = `
            SELECT 
                p.Id,
                p.UserId,
                p.GestorId,
                uColab.NomeCompleto AS colaborador_nome,
                uColab.Departamento AS colaborador_departamento,
                uGestor.NomeCompleto AS gestor_nome,
                CAST(p.Objetivos AS CHAR) AS objetivos,
                CAST(p.Acoes AS CHAR) AS acoes,
                ${colunaPrazoSelect},
                p.DataCriacao AS criado_em,
                ad.Titulo AS avaliacao_titulo
            FROM PDIs p
            JOIN Users uColab ON uColab.Id = p.UserId
            LEFT JOIN Users uGestor ON uGestor.Id = p.GestorId
            LEFT JOIN AvaliacoesDesempenho ad ON ad.Id = p.AvaliacaoId
        `;

        if (conditions.length) {
            query += ` WHERE ${conditions.join(' AND ')} `;
        }

        query += ' ORDER BY p.DataCriacao DESC LIMIT 500';

        const [result] = await pool.query(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar PDIs para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar PDIs.' });
    }
};
