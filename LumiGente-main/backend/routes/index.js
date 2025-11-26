const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { requireAuth, requireManagerAccess } = require('../middleware/authMiddleware');
const { getDatabasePool } = require('../config/db');

// Importação de todos os arquivos de rota
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const recognitionRoutes = require('./recognitionRoutes');
const humorRoutes = require('./humorRoutes');
const objetivoRoutes = require('./objetivoRoutes');
const avaliacaoRoutes = require('./avaliacaoRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const pesquisaRoutes = require('./pesquisaRoutes');
const chatRoutes = require('./chatRoutes');
const notificationRoutes = require('./notificationRoutes');
const teamRoutes = require('./teamRoutes');
const externalUserRoutes = require('./externalUserRoutes');
const healthRoutes = require('./healthRoutes');

// Definição dos prefixos para cada conjunto de rotas
router.use('/', authRoutes); // Rotas como /login, /logout, /register
router.use('/users', userRoutes);
router.use('/usuario', userRoutes); // Mantendo para compatibilidade
router.use('/feedbacks', feedbackRoutes);
router.use('/recognitions', recognitionRoutes);
router.use('/humor', humorRoutes);
router.use('/objetivos', objetivoRoutes);
router.use('/avaliacoes', avaliacaoRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/manager', analyticsRoutes); // Rotas de manager em analytics
router.use('/team', teamRoutes);
router.use('/pesquisas', pesquisaRoutes);
router.use('/surveys', pesquisaRoutes); // Alias para compatibilidade com frontend
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/external-users', externalUserRoutes);
router.use('/api', healthRoutes);

// Rotas de histórico (usando analytics como base)
router.use('/historico', analyticsRoutes);

// Rotas adicionais que estão sendo chamadas pelo frontend
router.use('/metrics', feedbackRoutes); // Métricas de feedback
router.use('/filters', feedbackRoutes); // Filtros de feedback
router.use('/gamification', recognitionRoutes); // Gamificação

// Rota para listar departamentos (usada pelo frontend)
router.get('/departments', requireAuth, requireManagerAccess, async (req, res) => {
    try {
        const pool = await getDatabasePool();
        
        // Buscar departamentos únicos dos usuários
        const result = await pool.request().query(`
            SELECT DISTINCT Departamento
            FROM Users 
            WHERE Departamento IS NOT NULL 
                AND Departamento != ''
            ORDER BY Departamento
        `);
        
        const departments = result.recordset.map(row => row.Departamento);
        res.json(departments);
    } catch (error) {
        console.error('Erro ao buscar departamentos:', error);
        res.status(500).json({ error: 'Erro ao buscar departamentos' });
    }
});

// Rota de debug para verificar permissões
router.get('/debug-permissions/:matricula', requireAuth, async (req, res) => {
    try {
        const { matricula } = req.params;
        const pool = await getDatabasePool();
        
        // Buscar dados do usuário
        const userResult = await pool.request()
            .input('matricula', sql.VarChar, matricula)
            .query(`
                SELECT u.Id, u.NomeCompleto, u.Matricula, u.Departamento, u.HierarchyPath, u.RoleId, r.Name as RoleName
                FROM Users u
                LEFT JOIN Roles r ON u.RoleId = r.Id
                WHERE u.Matricula = @matricula
            `);
        
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const user = userResult.recordset[0];
        
        // Simular cálculo de hierarchyLevel
        let hierarchyLevel = 1;
        
        // Verificar RoleId
        if (user.RoleId === 1 || user.RoleId === 2) {
            hierarchyLevel = 3;
        }
        
        // Verificar responsabilidade
        const responsavelResult = await pool.request()
            .input('matricula', sql.VarChar, user.Matricula)
            .query(`
                SELECT COUNT(*) as Total
                FROM HIERARQUIA_CC 
                WHERE RESPONSAVEL_ATUAL = @matricula
            `);
        
        const isResponsavel = responsavelResult.recordset[0].Total > 0;
        
        res.json({
            user: {
                nome: user.NomeCompleto,
                matricula: user.Matricula,
                departamento: user.Departamento,
                hierarchyPath: user.HierarchyPath,
                roleId: user.RoleId,
                roleName: user.RoleName
            },
            permissions: {
                hierarchyLevel,
                isResponsavel,
                hasTeamAccess: hierarchyLevel >= 3
            },
            debug: {
                roleCheck: user.RoleId === 1 || user.RoleId === 2,
                responsibilityCheck: isResponsavel,
                finalLevel: hierarchyLevel
            }
        });
        
    } catch (error) {
        console.error('Erro no debug de permissões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para forçar atualização de permissões
router.post('/refresh-permissions', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const pool = await getDatabasePool();
        
        // Buscar dados atualizados do usuário
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT u.Id, u.NomeCompleto, u.Matricula, u.Departamento, u.HierarchyPath, u.RoleId, r.Name as RoleName
                FROM Users u
                LEFT JOIN Roles r ON u.RoleId = r.Id
                WHERE u.Id = @userId
            `);
        
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const user = userResult.recordset[0];
        
        // Recalcular hierarchyLevel
        let hierarchyLevel = 1;
        
        // Verificar se é responsável na HIERARQUIA_CC
        const responsavelResult = await pool.request()
            .input('matricula', sql.VarChar, user.Matricula)
            .query(`SELECT COUNT(*) as Total FROM HIERARQUIA_CC WHERE RESPONSAVEL_ATUAL = @matricula`);
        
        const isResponsavel = responsavelResult.recordset[0].Total > 0;
        
        if (isResponsavel && user.HierarchyPath) {
            const departments = user.HierarchyPath.split('>').map(d => d.trim()).filter(d => d.length > 0);
            if (departments.length >= 4) {
                hierarchyLevel = 3;
            } else if (departments.length === 3) {
                hierarchyLevel = 2;
            } else if (departments.length === 2) {
                hierarchyLevel = 4;
            } else if (departments.length === 1) {
                hierarchyLevel = 4;
            }
        } else if (user.RoleId === 1) {
            hierarchyLevel = 4;
        }
        
        // Atualizar dados na sessão
        req.session.user = {
            ...req.session.user,
            hierarchyLevel,
            role: hierarchyLevel >= 4 ? 'Diretor' : hierarchyLevel >= 3 ? 'Gerente' : hierarchyLevel >= 2 ? 'Coordenador' : 'Funcionário'
        };
        
        // Calcular permissões
        const permissions = {
            dashboard: true,
            feedbacks: true,
            recognitions: true,
            humor: true,
            objetivos: true,
            pesquisas: true,
            avaliacoes: hierarchyLevel >= 3,
            team: hierarchyLevel >= 3,
            analytics: hierarchyLevel >= 4,
            historico: hierarchyLevel >= 4,
            isManager: hierarchyLevel >= 3,
            isFullAccess: hierarchyLevel >= 4
        };
        
        res.json({
            success: true,
            message: 'Permissões atualizadas',
            user: req.session.user,
            permissions
        });
        
    } catch (error) {
        console.error('Erro ao atualizar permissões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;