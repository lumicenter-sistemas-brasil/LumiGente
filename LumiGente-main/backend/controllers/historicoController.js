const sql = require('mssql');
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

        const request = pool.request();
        const conditions = [];

        if (status && status !== 'todos') {
            conditions.push('LOWER(o.status) = LOWER(@status)');
            request.input('status', sql.NVarChar, status);
        }

        if (responsavelId) {
            conditions.push(`EXISTS (SELECT 1 FROM ObjetivoResponsaveis ors WHERE ors.objetivo_id = o.Id AND ors.responsavel_id = @responsavelId)`);
            request.input('responsavelId', sql.Int, responsavelId);
        }

        if (dateStart) {
            conditions.push('CAST(o.data_inicio AS DATE) >= @dateStart');
            request.input('dateStart', sql.Date, dateStart);
        }

        if (dateEnd) {
            conditions.push('CAST(o.data_fim AS DATE) <= @dateEnd');
            request.input('dateEnd', sql.Date, dateEnd);
        }

        if (search) {
            const searchCondition = [
                'o.titulo LIKE @search',
                'CAST(o.descricao AS NVARCHAR(MAX)) LIKE @search',
                'c.NomeCompleto LIKE @search'
            ].join(' OR ');
            conditions.push(`(${searchCondition})`);
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        let query = `
            SELECT TOP 500
                o.Id,
                o.titulo,
                CAST(o.descricao AS NVARCHAR(MAX)) AS descricao,
                o.status,
                o.data_inicio,
                o.data_fim,
                o.progresso,
                o.created_at,
                o.updated_at,
                c.NomeCompleto AS criador_nome,
                ISNULL((
                    SELECT STRING_AGG(uInterno.NomeCompleto, '; ')
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
        `;

        const result = await request.query(query);
        res.json(result.recordset);
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

        const request = pool.request();
        const conditions = [];

        if (type && type !== 'todos') {
            conditions.push('LOWER(f.type) = LOWER(@type)');
            request.input('type', sql.NVarChar, type);
        }

        if (category && category !== 'todos') {
            conditions.push('LOWER(f.category) = LOWER(@category)');
            request.input('category', sql.NVarChar, category);
        }

        if (dateStart) {
            conditions.push('CAST(f.created_at AS DATE) >= @feedbackDateStart');
            request.input('feedbackDateStart', sql.Date, dateStart);
        }

        if (dateEnd) {
            conditions.push('CAST(f.created_at AS DATE) <= @feedbackDateEnd');
            request.input('feedbackDateEnd', sql.Date, dateEnd);
        }

        if (search) {
            conditions.push(`(
                f.message LIKE @feedbackSearch OR
                uFrom.NomeCompleto LIKE @feedbackSearch OR
                uTo.NomeCompleto LIKE @feedbackSearch
            )`);
            request.input('feedbackSearch', sql.NVarChar, `%${search}%`);
        }

        let query = `
            SELECT TOP 500
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

        query += ' ORDER BY f.created_at DESC';

        const result = await request.query(query);
        res.json(result.recordset);
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

        const result = await pool.request()
            .input('feedbackId', sql.Int, id)
            .query(`
                SELECT fr.Id, fr.user_id, fr.reply_text AS message, fr.created_at,
                       u.NomeCompleto AS user_name, u.Departamento AS department,
                       fr.reply_to_id, fr.reply_to_message, fr.reply_to_user
                FROM FeedbackReplies fr
                JOIN Users u ON u.Id = fr.user_id
                WHERE fr.feedback_id = @feedbackId
                ORDER BY fr.created_at ASC
            `);

        res.json(result.recordset);
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

        const request = pool.request();
        const conditions = [];

        if (badge && badge !== 'todos') {
            if (badge === 'Outros') {
                conditions.push(`r.badge NOT IN ('Inovador', 'Colaborativo', 'Dedicado', 'Criativo')`);
            } else {
                conditions.push('LOWER(r.badge) = LOWER(@badge)');
                request.input('badge', sql.NVarChar, badge);
            }
        }

        if (search) {
            conditions.push(`(
                r.message LIKE @recognitionSearch OR
                uFrom.NomeCompleto LIKE @recognitionSearch OR
                uTo.NomeCompleto LIKE @recognitionSearch
            )`);
            request.input('recognitionSearch', sql.NVarChar, `%${search}%`);
        }

        if (dateStart) {
            conditions.push('CAST(r.created_at AS DATE) >= @recognitionDateStart');
            request.input('recognitionDateStart', sql.Date, dateStart);
        }

        if (dateEnd) {
            conditions.push('CAST(r.created_at AS DATE) <= @recognitionDateEnd');
            request.input('recognitionDateEnd', sql.Date, dateEnd);
        }

        let query = `
            SELECT TOP 500
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

        query += ' ORDER BY r.created_at DESC';

        const result = await request.query(query);
        res.json(result.recordset);
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

        const request = pool.request();
        const conditions = [];

        if (department && department !== 'todos') {
            conditions.push('u.Departamento = @humorDepartamento');
            request.input('humorDepartamento', sql.NVarChar, department);
        }

        if (minScore) {
            conditions.push('CAST(dm.score AS INT) >= @minScore');
            request.input('minScore', sql.Int, parseInt(minScore, 10));
        }

        if (maxScore) {
            conditions.push('CAST(dm.score AS INT) <= @maxScore');
            request.input('maxScore', sql.Int, parseInt(maxScore, 10));
        }

        if (dateStart) {
            conditions.push('CAST(dm.created_at AS DATE) >= @humorDateStart');
            request.input('humorDateStart', sql.Date, dateStart);
        }

        if (dateEnd) {
            conditions.push('CAST(dm.created_at AS DATE) <= @humorDateEnd');
            request.input('humorDateEnd', sql.Date, dateEnd);
        }

        if (search) {
            conditions.push('(u.NomeCompleto LIKE @humorSearch OR dm.description LIKE @humorSearch)');
            request.input('humorSearch', sql.NVarChar, `%${search}%`);
        }

        let query = `
            SELECT TOP 500
                dm.Id,
                dm.score,
                dm.description,
                dm.created_at,
                u.NomeCompleto AS user_name,
                u.Departamento AS department
            FROM DailyMood dm
            JOIN Users u ON u.Id = dm.user_id
            WHERE u.IsActive = 1
        `;

        if (conditions.length) {
            query += ` AND ${conditions.join(' AND ')} `;
        }

        query += ' ORDER BY dm.created_at DESC';

        const result = await request.query(query);
        res.json(result.recordset);
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
        const colunaCheck = await pool.request().query(`
            SELECT COUNT(*) as existe
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
        `);
        const usarPrazoConclusao = colunaCheck.recordset[0].existe > 0;
        const colunaPrazoSelect = usarPrazoConclusao 
            ? 'p.PrazoConclusao AS prazo_revisao' 
            : 'p.PrazoRevisao AS prazo_revisao';

        const request = pool.request();
        const conditions = [];

        if (search) {
            conditions.push(`(
                CAST(p.Objetivos AS NVARCHAR(MAX)) LIKE @pdiSearch OR
                CAST(p.Acoes AS NVARCHAR(MAX)) LIKE @pdiSearch OR
                uColab.NomeCompleto LIKE @pdiSearch OR
                uGestor.NomeCompleto LIKE @pdiSearch
            )`);
            request.input('pdiSearch', sql.NVarChar, `%${search}%`);
        }

        if (dateStart) {
            conditions.push('CAST(p.DataCriacao AS DATE) >= @pdiDateStart');
            request.input('pdiDateStart', sql.Date, dateStart);
        }

        if (dateEnd) {
            conditions.push('CAST(p.DataCriacao AS DATE) <= @pdiDateEnd');
            request.input('pdiDateEnd', sql.Date, dateEnd);
        }

        let query = `
            SELECT TOP 500
                p.Id,
                p.UserId,
                p.GestorId,
                uColab.NomeCompleto AS colaborador_nome,
                uColab.Departamento AS colaborador_departamento,
                uGestor.NomeCompleto AS gestor_nome,
                CAST(p.Objetivos AS NVARCHAR(MAX)) AS objetivos,
                CAST(p.Acoes AS NVARCHAR(MAX)) AS acoes,
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

        query += ' ORDER BY p.DataCriacao DESC';

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar PDIs para histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar PDIs.' });
    }
};

