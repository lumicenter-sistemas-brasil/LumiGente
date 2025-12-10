/**
 * Script de Setup COMPLETO do Banco de Dados MySQL
 * 
 * Baseado na estrutura real extraída do SQL Server em 10/12/2024
 * 
 * Este script cria TODAS as 43 tabelas necessárias para o sistema LumiGente no MySQL.
 * Execute antes de iniciar a aplicação pela primeira vez.
 * 
 * Uso: node scripts/setup-mysql-database-complete.js
 * 
 * NOTA: As tabelas TAB_HIST_SRA e HIERARQUIA_CC serão populadas via Airflow
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    console.log('🚀 Iniciando setup COMPLETO do banco de dados MySQL...\n');

    try {
        // =====================================================================
        // TABELAS BASE (sem dependências)
        // =====================================================================
        
        // 1. Roles
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Roles (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL,
                Description VARCHAR(255) NULL,
                created_at DATETIME DEFAULT NOW(),
                UNIQUE KEY UQ_Roles_Name (Name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 1/43 - Tabela Roles criada');

        // 2. Users
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Users (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserName VARCHAR(255) NOT NULL,
                PasswordHash VARCHAR(255) NULL,
                RoleId INT NULL DEFAULT 2,
                nome VARCHAR(255) NOT NULL,
                NomeCompleto VARCHAR(255) NULL,
                Departamento VARCHAR(100) NULL,
                Filial VARCHAR(100) NULL,
                DescricaoDepartamento VARCHAR(100) NULL,
                is_admin TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT NOW(),
                updated_at DATETIME DEFAULT NOW(),
                CPF VARCHAR(14) NULL,
                IsActive TINYINT(1) DEFAULT 1,
                LastLogin DATETIME NULL,
                Matricula VARCHAR(20) NULL,
                HierarchyPath VARCHAR(100) NULL,
                FirstLogin TINYINT(1) DEFAULT 0,
                Email VARCHAR(255) NULL,
                PasswordResetToken VARCHAR(500) NULL,
                PasswordResetExpires DATETIME NULL,
                EmailVerificationToken VARCHAR(500) NULL,
                EmailVerificationExpires DATETIME NULL,
                PendingEmail VARCHAR(255) NULL,
                EmailVerified TINYINT(1) DEFAULT 0,
                PreviousEmail VARCHAR(255) NULL,
                EmailChangeCancelToken VARCHAR(512) NULL,
                EmailChangeCancelExpires DATETIME NULL,
                PendingPasswordHash TEXT NULL,
                PasswordChangeToken TEXT NULL,
                PasswordChangeExpires DATETIME NULL,
                PreviousPasswordHash TEXT NULL,
                PasswordChangeCancelToken TEXT NULL,
                PasswordChangeCancelExpires DATETIME NULL,
                PasswordRevertToken VARCHAR(500) NULL,
                PasswordRevertExpires DATETIME NULL,
                LastPasswordChange DATETIME NULL,
                Unidade VARCHAR(100) NULL,
                IsExternal TINYINT(1) NOT NULL DEFAULT 0,
                DepartamentoUnico VARCHAR(203) NULL,
                UNIQUE KEY UQ_Users_UserName (UserName),
                UNIQUE KEY UQ_Users_CPF (CPF),
                KEY idx_users_departamento (Departamento),
                KEY idx_users_filial (Filial),
                KEY idx_users_filial_departamento (Filial, Departamento),
                KEY IX_Users_HierarchyPath (HierarchyPath),
                KEY IX_Users_IsActive_Departamento (IsActive, Departamento),
                KEY IX_Users_IsActive_Filial (IsActive, Filial),
                KEY IX_Users_IsAdmin (is_admin),
                KEY IX_Users_IsExternal (IsExternal),
                KEY IX_Users_IsExternal_IsActive (IsExternal, IsActive),
                KEY IX_Users_Matricula (Matricula),
                CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 2/43 - Tabela Users criada');

        // 3. TAB_HIST_SRA (populada via Airflow)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS TAB_HIST_SRA (
                UNIDADE VARCHAR(6) NULL,
                MATRICULA VARCHAR(6) NULL,
                EMAIL VARCHAR(50) NULL,
                NOME VARCHAR(30) NULL,
                DTA_ADMISSAO DATETIME NULL,
                FILIAL VARCHAR(6) NULL,
                CENTRO_CUSTO VARCHAR(9) NULL,
                CPF VARCHAR(11) NULL,
                DEPARTAMENTO VARCHAR(9) NULL,
                SITUACAO_FOLHA VARCHAR(1) NULL,
                STATUS_GERAL VARCHAR(7) NULL,
                KEY idx_TAB_HIST_SRA_CPF (CPF),
                KEY idx_TAB_HIST_SRA_MATRICULA (MATRICULA),
                KEY idx_TAB_HIST_SRA_STATUS (STATUS_GERAL)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 3/43 - Tabela TAB_HIST_SRA criada');

        // 4. HIERARQUIA_CC (populada via Airflow - anteriormente era VIEW do Oracle)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS HIERARQUIA_CC (
                UNIDADE VARCHAR(10) NULL,
                NIVEL_1_DIRETORIA VARCHAR(20) NULL,
                NIVEL_1_DIRETORIA_DESC VARCHAR(200) NULL,
                NIVEL_1_MATRICULA_RESP VARCHAR(20) NULL,
                NIVEL_2_GERENCIA VARCHAR(20) NULL,
                NIVEL_2_GERENCIA_DESC VARCHAR(200) NULL,
                NIVEL_2_MATRICULA_RESP VARCHAR(20) NULL,
                NIVEL_3_COORDENACAO VARCHAR(20) NULL,
                NIVEL_3_COORDENACAO_DESC VARCHAR(200) NULL,
                NIVEL_3_MATRICULA_RESP VARCHAR(20) NULL,
                NIVEL_4_DEPARTAMENTO VARCHAR(20) NULL,
                NIVEL_4_DEPARTAMENTO_DESC VARCHAR(200) NULL,
                NIVEL_4_MATRICULA_RESP VARCHAR(20) NULL,
                DEPTO_ATUAL VARCHAR(20) NULL,
                DESCRICAO_ATUAL VARCHAR(200) NULL,
                RESPONSAVEL_ATUAL VARCHAR(20) NULL,
                FILIAL VARCHAR(20) NULL,
                CPF_RESPONSAVEL VARCHAR(20) NULL,
                HIERARQUIA_COMPLETA VARCHAR(200) NULL,
                KEY idx_HIERARQUIA_CC_DEPTO (DEPTO_ATUAL),
                KEY idx_HIERARQUIA_CC_RESPONSAVEL (RESPONSAVEL_ATUAL),
                KEY idx_HIERARQUIA_CC_CPF (CPF_RESPONSAVEL)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 4/43 - Tabela HIERARQUIA_CC criada');

        // 5. TiposAvaliacao
        await connection.query(`
            CREATE TABLE IF NOT EXISTS TiposAvaliacao (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Nome VARCHAR(50) NOT NULL,
                DiasMinimos INT NOT NULL,
                DiasMaximos INT NOT NULL,
                Descricao VARCHAR(500) NULL,
                Ativo TINYINT(1) DEFAULT 1,
                CriadoEm DATETIME DEFAULT NOW(),
                AtualizadoEm DATETIME DEFAULT NOW(),
                UNIQUE KEY UQ_TiposAvaliacao_Nome (Nome)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 5/43 - Tabela TiposAvaliacao criada');

        // =====================================================================
        // TABELAS COM DEPENDÊNCIA DE Users
        // =====================================================================

        // 6. AuditLog_Users_External
        await connection.query(`
            CREATE TABLE IF NOT EXISTS AuditLog_Users_External (
                AuditId INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NULL,
                NomeCompleto VARCHAR(255) NULL,
                CPF VARCHAR(20) NULL,
                Acao VARCHAR(50) NULL,
                CampoAlterado VARCHAR(100) NULL,
                ValorAnterior TEXT NULL,
                ValorNovo TEXT NULL,
                IsExternalAnterior TINYINT(1) NULL,
                IsExternalNovo TINYINT(1) NULL,
                IsActiveAnterior TINYINT(1) NULL,
                IsActiveNovo TINYINT(1) NULL,
                DataHora DATETIME DEFAULT NOW(),
                Usuario VARCHAR(255) NULL,
                Aplicacao VARCHAR(255) NULL,
                HostName VARCHAR(255) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 6/43 - Tabela AuditLog_Users_External criada');

        // 7. Avaliacoes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Avaliacoes (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                TipoAvaliacaoId INT NOT NULL,
                Matricula VARCHAR(50) NOT NULL,
                DataAdmissao DATE NOT NULL,
                DataCriacao DATETIME DEFAULT NOW(),
                DataLimiteResposta DATETIME NULL,
                StatusAvaliacao VARCHAR(20) DEFAULT 'Pendente',
                RespostaColaboradorConcluida TINYINT(1) DEFAULT 0,
                RespostaGestorConcluida TINYINT(1) DEFAULT 0,
                DataRespostaColaborador DATETIME NULL,
                DataRespostaGestor DATETIME NULL,
                Observacoes VARCHAR(2000) NULL,
                CriadoEm DATETIME DEFAULT NOW(),
                AtualizadoEm DATETIME DEFAULT NOW(),
                GestorId INT NULL,
                NovaDataLimiteResposta DATE NULL,
                KEY IDX_Avaliacoes_GestorId (GestorId),
                KEY IDX_Avaliacoes_Matricula (Matricula),
                KEY IDX_Avaliacoes_Status (StatusAvaliacao),
                KEY IDX_Avaliacoes_TipoAvaliacao (TipoAvaliacaoId),
                KEY IDX_Avaliacoes_UserId (UserId),
                KEY IX_Avaliacoes_Status_DataAdmissao (StatusAvaliacao, DataAdmissao, TipoAvaliacaoId),
                CONSTRAINT FK_Avaliacoes_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
                CONSTRAINT FK_Avaliacoes_TiposAvaliacao FOREIGN KEY (TipoAvaliacaoId) REFERENCES TiposAvaliacao(Id),
                CONSTRAINT FK_Avaliacoes_Gestor FOREIGN KEY (GestorId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 7/43 - Tabela Avaliacoes criada');

        // 8. AvaliacoesDesempenho
        await connection.query(`
            CREATE TABLE IF NOT EXISTS AvaliacoesDesempenho (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                GestorId INT NULL,
                Titulo VARCHAR(200) NULL,
                DataLimiteAutoAvaliacao DATETIME NULL,
                DataLimiteGestor DATETIME NULL,
                CriadoPor INT NULL,
                Status VARCHAR(50) DEFAULT 'Criada',
                ResultadoCalibrado TEXT NULL,
                ObservacoesCalibragem TEXT NULL,
                PDI TEXT NULL,
                DataCriacao DATETIME DEFAULT NOW(),
                CONSTRAINT FK_AvaliacoesDesempenho_User FOREIGN KEY (UserId) REFERENCES Users(Id),
                CONSTRAINT FK_AvaliacoesDesempenho_Gestor FOREIGN KEY (GestorId) REFERENCES Users(Id),
                CONSTRAINT FK_AvaliacoesDesempenho_CriadoPor FOREIGN KEY (CriadoPor) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 8/43 - Tabela AvaliacoesDesempenho criada');

        // 9. CalibragemConsideracoes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS CalibragemConsideracoes (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                ConsideracoesFinais TEXT NULL,
                CriadoPor INT NULL,
                DataCriacao DATETIME DEFAULT NOW(),
                DataAtualizacao DATETIME DEFAULT NOW(),
                CONSTRAINT FK_CalibragemConsideracoes_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id),
                CONSTRAINT FK_CalibragemConsideracoes_CriadoPor FOREIGN KEY (CriadoPor) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 9/43 - Tabela CalibragemConsideracoes criada');

        // 10. Calibragens
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Calibragens (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                ResultadoCalibrado TEXT NULL,
                ObservacoesCalibragem TEXT NULL,
                CriadoPor INT NULL,
                DataCriacao DATETIME DEFAULT NOW(),
                DataAtualizacao DATETIME DEFAULT NOW(),
                CONSTRAINT FK_Calibragens_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id),
                CONSTRAINT FK_Calibragens_CriadoPor FOREIGN KEY (CriadoPor) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 10/43 - Tabela Calibragens criada');

        // 11. DailyMood
        await connection.query(`
            CREATE TABLE IF NOT EXISTS DailyMood (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                score INT NOT NULL,
                description TEXT NULL,
                created_at DATETIME DEFAULT NOW(),
                updated_at DATETIME DEFAULT NOW(),
                KEY IX_DailyMood_CreatedAt (created_at),
                KEY IX_DailyMood_User_Date (user_id, created_at),
                KEY IX_DailyMood_UserId (user_id),
                CONSTRAINT FK_DailyMood_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 11/43 - Tabela DailyMood criada');

        // 12. Feedbacks
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Feedbacks (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                from_user_id INT NOT NULL,
                to_user_id INT NOT NULL,
                type VARCHAR(100) NOT NULL,
                category VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                rating INT DEFAULT 5,
                created_at DATETIME DEFAULT NOW(),
                updated_at DATETIME DEFAULT NOW(),
                KEY IX_Feedbacks_CreatedAt (created_at),
                KEY IX_Feedbacks_FromUser (from_user_id),
                KEY IX_Feedbacks_ToUser (to_user_id),
                KEY IX_Feedbacks_Type (type),
                CONSTRAINT FK_Feedbacks_FromUser FOREIGN KEY (from_user_id) REFERENCES Users(Id),
                CONSTRAINT FK_Feedbacks_ToUser FOREIGN KEY (to_user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 12/43 - Tabela Feedbacks criada');

        // 13. FeedbackReactions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS FeedbackReactions (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                feedback_id INT NOT NULL,
                user_id INT NOT NULL,
                reaction_type VARCHAR(50) NOT NULL,
                created_at DATETIME DEFAULT NOW(),
                KEY IX_FeedbackReactions_Feedback (feedback_id),
                KEY IX_FeedbackReactions_Type (reaction_type),
                KEY IX_FeedbackReactions_User (user_id),
                CONSTRAINT FK_FeedbackReactions_Feedback FOREIGN KEY (feedback_id) REFERENCES Feedbacks(Id),
                CONSTRAINT FK_FeedbackReactions_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 13/43 - Tabela FeedbackReactions criada');

        // 14. FeedbackReplies
        await connection.query(`
            CREATE TABLE IF NOT EXISTS FeedbackReplies (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                feedback_id INT NOT NULL,
                user_id INT NOT NULL,
                reply_text TEXT NOT NULL,
                created_at DATETIME DEFAULT NOW(),
                reply_to_id INT NULL,
                reply_to_message TEXT NULL,
                reply_to_user VARCHAR(255) NULL,
                KEY IX_FeedbackReplies_feedback_id (feedback_id),
                CONSTRAINT FK_FeedbackReplies_Feedback FOREIGN KEY (feedback_id) REFERENCES Feedbacks(Id),
                CONSTRAINT FK_FeedbackReplies_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 14/43 - Tabela FeedbackReplies criada');

        // 15. FeedbackReplyReactions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS FeedbackReplyReactions (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                reply_id INT NOT NULL,
                user_id INT NOT NULL,
                emoji VARCHAR(10) NOT NULL,
                created_at DATETIME DEFAULT NOW(),
                KEY IX_FeedbackReplyReactions_reply_id (reply_id),
                KEY IX_FeedbackReplyReactions_user_id (user_id),
                CONSTRAINT FK_FeedbackReplyReactions_Reply FOREIGN KEY (reply_id) REFERENCES FeedbackReplies(Id),
                CONSTRAINT FK_FeedbackReplyReactions_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 15/43 - Tabela FeedbackReplyReactions criada');

        // 16. FeedbacksAvaliacaoDesempenho
        await connection.query(`
            CREATE TABLE IF NOT EXISTS FeedbacksAvaliacaoDesempenho (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                FeedbackGestor TEXT NOT NULL,
                GestorId INT NULL,
                DataCriacao DATETIME DEFAULT NOW(),
                DataAtualizacao DATETIME DEFAULT NOW(),
                CONSTRAINT FK_FeedbacksAvaliacaoDesempenho_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id),
                CONSTRAINT FK_FeedbacksAvaliacaoDesempenho_Gestor FOREIGN KEY (GestorId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 16/43 - Tabela FeedbacksAvaliacaoDesempenho criada');

        // 17. Gamification
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Gamification (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                Action VARCHAR(100) NOT NULL,
                Points INT NOT NULL,
                CreatedAt DATETIME DEFAULT NOW(),
                KEY IX_Gamification_CreatedAt (CreatedAt),
                KEY IX_Gamification_UserId (UserId),
                CONSTRAINT FK_Gamification_User FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 17/43 - Tabela Gamification criada');

        // 18. Notifications
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Notifications (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                Type VARCHAR(50) NOT NULL,
                Message VARCHAR(500) NOT NULL,
                RelatedId INT NULL,
                IsRead TINYINT(1) DEFAULT 0,
                CreatedAt DATETIME DEFAULT NOW(),
                KEY IX_Notifications_CreatedAt (CreatedAt),
                KEY IX_Notifications_UserId_IsRead (UserId, IsRead),
                CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 18/43 - Tabela Notifications criada');

        // 19. Objetivos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Objetivos (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT NULL,
                data_inicio DATE NOT NULL,
                data_fim DATE NOT NULL,
                status VARCHAR(50) DEFAULT 'Ativo',
                progresso DECIMAL(5,2) DEFAULT 0,
                criado_por INT NOT NULL,
                created_at DATETIME DEFAULT NOW(),
                updated_at DATETIME DEFAULT NOW(),
                KEY IX_Objetivos_DataFim (data_fim),
                KEY IX_Objetivos_Status (status),
                CONSTRAINT FK_Objetivos_CriadoPor FOREIGN KEY (criado_por) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 19/43 - Tabela Objetivos criada');

        // 20. ObjetivoCheckins
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ObjetivoCheckins (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                objetivo_id INT NOT NULL,
                user_id INT NOT NULL,
                progresso DECIMAL(5,2) NOT NULL,
                observacoes TEXT NULL,
                created_at DATETIME DEFAULT NOW(),
                KEY IX_ObjetivoCheckins_ObjetivoId (objetivo_id),
                KEY IX_ObjetivoCheckins_UserId (user_id),
                CONSTRAINT FK_ObjetivoCheckins_Objetivo FOREIGN KEY (objetivo_id) REFERENCES Objetivos(Id),
                CONSTRAINT FK_ObjetivoCheckins_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 20/43 - Tabela ObjetivoCheckins criada');

        // 21. ObjetivoResponsaveis
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ObjetivoResponsaveis (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                objetivo_id INT NOT NULL,
                responsavel_id INT NOT NULL,
                created_at DATETIME DEFAULT NOW(),
                KEY IX_ObjetivoResponsaveis_objetivo_id (objetivo_id),
                KEY IX_ObjetivoResponsaveis_responsavel_id (responsavel_id),
                UNIQUE KEY UQ_ObjetivoResponsaveis (objetivo_id, responsavel_id),
                CONSTRAINT FK_ObjetivoResponsaveis_Objetivo FOREIGN KEY (objetivo_id) REFERENCES Objetivos(Id),
                CONSTRAINT FK_ObjetivoResponsaveis_Responsavel FOREIGN KEY (responsavel_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 21/43 - Tabela ObjetivoResponsaveis criada');

        // 22. PDIs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS PDIs (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                GestorId INT NULL,
                AvaliacaoId INT NULL,
                Titulo VARCHAR(255) NOT NULL,
                Objetivos TEXT NOT NULL,
                Acoes TEXT NOT NULL,
                PrazoConclusao DATE NOT NULL,
                Status VARCHAR(50) DEFAULT 'Ativo',
                Progresso DECIMAL(5,2) DEFAULT 0,
                DataCriacao DATETIME DEFAULT NOW(),
                DataAtualizacao DATETIME DEFAULT NOW(),
                KEY IX_PDIs_GestorId (GestorId),
                KEY IX_PDIs_Status (Status),
                KEY IX_PDIs_UserId (UserId),
                CONSTRAINT FK_PDIs_User FOREIGN KEY (UserId) REFERENCES Users(Id),
                CONSTRAINT FK_PDIs_Gestor FOREIGN KEY (GestorId) REFERENCES Users(Id),
                CONSTRAINT FK_PDIs_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 22/43 - Tabela PDIs criada');

        // 23. PDICheckins
        await connection.query(`
            CREATE TABLE IF NOT EXISTS PDICheckins (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                PDIId INT NOT NULL,
                UserId INT NOT NULL,
                Progresso DECIMAL(5,2) NOT NULL,
                Observacoes TEXT NULL,
                DataCheckin DATETIME DEFAULT NOW(),
                KEY IX_PDICheckins_PDIId (PDIId),
                CONSTRAINT FK_PDICheckins_PDI FOREIGN KEY (PDIId) REFERENCES PDIs(Id),
                CONSTRAINT FK_PDICheckins_User FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 23/43 - Tabela PDICheckins criada');

        // 24. PerguntasAvaliacao
        await connection.query(`
            CREATE TABLE IF NOT EXISTS PerguntasAvaliacao (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                Ordem INT NOT NULL,
                Pergunta TEXT NOT NULL,
                TipoPergunta VARCHAR(50) NOT NULL,
                Obrigatoria TINYINT(1) NOT NULL DEFAULT 1,
                EscalaMinima INT NULL,
                EscalaMaxima INT NULL,
                EscalaLabelMinima VARCHAR(100) NULL,
                EscalaLabelMaxima VARCHAR(100) NULL,
                CriadoEm DATETIME NOT NULL DEFAULT NOW(),
                KEY IX_PerguntasAvaliacao_AvaliacaoId (AvaliacaoId),
                KEY IX_PerguntasAvaliacao_Ordem (AvaliacaoId, Ordem),
                CONSTRAINT FK_PerguntasAvaliacao_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 24/43 - Tabela PerguntasAvaliacao criada');

        // 25. OpcoesPerguntasAvaliacao
        await connection.query(`
            CREATE TABLE IF NOT EXISTS OpcoesPerguntasAvaliacao (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                PerguntaAvaliacaoId INT NOT NULL,
                TextoOpcao VARCHAR(500) NOT NULL,
                Ordem INT NOT NULL,
                KEY IX_OpcoesPerguntasAvaliacao_PerguntaId (PerguntaAvaliacaoId),
                CONSTRAINT FK_OpcoesPerguntasAvaliacao_Pergunta FOREIGN KEY (PerguntaAvaliacaoId) REFERENCES PerguntasAvaliacao(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 25/43 - Tabela OpcoesPerguntasAvaliacao criada');

        // 26. PerguntasAvaliacaoDesempenho
        await connection.query(`
            CREATE TABLE IF NOT EXISTS PerguntasAvaliacaoDesempenho (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NULL,
                Texto TEXT NOT NULL,
                Tipo VARCHAR(50) NOT NULL,
                Obrigatoria TINYINT(1) NOT NULL DEFAULT 1,
                Ordem INT NOT NULL DEFAULT 0,
                EscalaMinima INT NULL,
                EscalaMaxima INT NULL,
                EscalaLabelMinima VARCHAR(100) NULL,
                EscalaLabelMaxima VARCHAR(100) NULL,
                Ativo TINYINT(1) NOT NULL DEFAULT 1,
                DataCriacao DATETIME DEFAULT NOW(),
                CONSTRAINT FK_PerguntasAvaliacaoDesempenho_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 26/43 - Tabela PerguntasAvaliacaoDesempenho criada');

        // 27. OpcoesPerguntasAvaliacaoDesempenho
        await connection.query(`
            CREATE TABLE IF NOT EXISTS OpcoesPerguntasAvaliacaoDesempenho (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                PerguntaId INT NOT NULL,
                TextoOpcao VARCHAR(255) NOT NULL,
                Ordem INT NOT NULL DEFAULT 0,
                CONSTRAINT FK_OpcoesPerguntasAvaliacaoDesempenho_Pergunta FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacaoDesempenho(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 27/43 - Tabela OpcoesPerguntasAvaliacaoDesempenho criada');

        // 28. QuestionarioPadrao45
        await connection.query(`
            CREATE TABLE IF NOT EXISTS QuestionarioPadrao45 (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Ordem INT NOT NULL,
                TipoPergunta VARCHAR(20) NOT NULL,
                Pergunta VARCHAR(1000) NOT NULL,
                Obrigatoria TINYINT(1) DEFAULT 1,
                Ativo TINYINT(1) DEFAULT 1,
                CriadoEm DATETIME DEFAULT NOW(),
                AtualizadoEm DATETIME DEFAULT NOW(),
                EscalaMinima INT DEFAULT 1,
                EscalaMaxima INT DEFAULT 5,
                EscalaLabelMinima VARCHAR(100) NULL,
                EscalaLabelMaxima VARCHAR(100) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 28/43 - Tabela QuestionarioPadrao45 criada');

        // 29. OpcoesQuestionario45
        await connection.query(`
            CREATE TABLE IF NOT EXISTS OpcoesQuestionario45 (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                PerguntaId INT NOT NULL,
                TextoOpcao VARCHAR(500) NOT NULL,
                Ordem INT NOT NULL,
                CriadoEm DATETIME DEFAULT NOW(),
                CONSTRAINT FK_OpcoesQuestionario45_Pergunta FOREIGN KEY (PerguntaId) REFERENCES QuestionarioPadrao45(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 29/43 - Tabela OpcoesQuestionario45 criada');

        // 30. QuestionarioPadrao90
        await connection.query(`
            CREATE TABLE IF NOT EXISTS QuestionarioPadrao90 (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Ordem INT NOT NULL,
                TipoPergunta VARCHAR(20) NOT NULL,
                Pergunta VARCHAR(1000) NOT NULL,
                Obrigatoria TINYINT(1) DEFAULT 1,
                Ativo TINYINT(1) DEFAULT 1,
                CriadoEm DATETIME DEFAULT NOW(),
                AtualizadoEm DATETIME DEFAULT NOW(),
                EscalaMinima INT DEFAULT 1,
                EscalaMaxima INT DEFAULT 5,
                EscalaLabelMinima VARCHAR(100) NULL,
                EscalaLabelMaxima VARCHAR(100) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 30/43 - Tabela QuestionarioPadrao90 criada');

        // 31. OpcoesQuestionario90
        await connection.query(`
            CREATE TABLE IF NOT EXISTS OpcoesQuestionario90 (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                PerguntaId INT NOT NULL,
                TextoOpcao VARCHAR(500) NOT NULL,
                Ordem INT NOT NULL,
                CriadoEm DATETIME DEFAULT NOW(),
                CONSTRAINT FK_OpcoesQuestionario90_Pergunta FOREIGN KEY (PerguntaId) REFERENCES QuestionarioPadrao90(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 31/43 - Tabela OpcoesQuestionario90 criada');

        // 32. Recognitions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Recognitions (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                from_user_id INT NOT NULL,
                to_user_id INT NOT NULL,
                badge VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                points INT DEFAULT 10,
                created_at DATETIME DEFAULT NOW(),
                KEY IX_Recognitions_CreatedAt (created_at),
                KEY IX_Recognitions_FromUser (from_user_id),
                KEY IX_Recognitions_ToUser (to_user_id),
                CONSTRAINT FK_Recognitions_FromUser FOREIGN KEY (from_user_id) REFERENCES Users(Id),
                CONSTRAINT FK_Recognitions_ToUser FOREIGN KEY (to_user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 32/43 - Tabela Recognitions criada');

        // 33. RespostasAvaliacoes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS RespostasAvaliacoes (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                PerguntaId INT NOT NULL,
                TipoQuestionario VARCHAR(10) NOT NULL,
                Pergunta VARCHAR(1000) NOT NULL,
                TipoPergunta VARCHAR(20) NOT NULL,
                Resposta TEXT NULL,
                RespondidoPor INT NOT NULL,
                TipoRespondente VARCHAR(20) NOT NULL,
                DataResposta DATETIME DEFAULT NOW(),
                OpcaoSelecionadaId INT NULL,
                KEY IDX_Respostas_AvaliacaoId (AvaliacaoId),
                KEY IDX_Respostas_OpcaoSelecionada (OpcaoSelecionadaId),
                KEY IDX_Respostas_RespondidoPor (RespondidoPor),
                KEY IDX_Respostas_TipoRespondente (TipoRespondente),
                CONSTRAINT FK_RespostasAvaliacoes_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id),
                CONSTRAINT FK_RespostasAvaliacoes_RespondidoPor FOREIGN KEY (RespondidoPor) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 33/43 - Tabela RespostasAvaliacoes criada');

        // 34. RespostasDesempenho
        await connection.query(`
            CREATE TABLE IF NOT EXISTS RespostasDesempenho (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                AvaliacaoId INT NOT NULL,
                PerguntaId INT NOT NULL,
                RespostaColaborador TEXT NULL,
                RespostaGestor TEXT NULL,
                DataRespostaColaborador DATETIME NULL,
                DataRespostaGestor DATETIME NULL,
                RespostaCalibrada TEXT NULL,
                DataRespostaCalibrada DATETIME NULL,
                JustificativaCalibrada TEXT NULL,
                CONSTRAINT FK_RespostasDesempenho_Avaliacao FOREIGN KEY (AvaliacaoId) REFERENCES AvaliacoesDesempenho(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 34/43 - Tabela RespostasDesempenho criada');

        // 35. Surveys
        await connection.query(`
            CREATE TABLE IF NOT EXISTS Surveys (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                descricao TEXT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Ativa',
                anonima TINYINT(1) NOT NULL DEFAULT 0,
                data_inicio DATETIME NULL,
                data_encerramento DATETIME NULL,
                criado_por INT NOT NULL,
                data_criacao DATETIME NOT NULL DEFAULT NOW(),
                data_atualizacao DATETIME NOT NULL DEFAULT NOW(),
                KEY IX_Surveys_CriadoPor_Data (Id, status, criado_por, data_criacao),
                KEY IX_Surveys_DataEncerramento (data_encerramento),
                KEY IX_Surveys_DataInicio (data_inicio),
                KEY IX_Surveys_Status (status),
                CONSTRAINT FK_Surveys_CriadoPor FOREIGN KEY (criado_por) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 35/43 - Tabela Surveys criada');

        // 36. SurveyQuestions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyQuestions (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                pergunta TEXT NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                obrigatoria TINYINT(1) NOT NULL DEFAULT 0,
                ordem INT NOT NULL,
                escala_min INT NULL,
                escala_max INT NULL,
                KEY IX_SurveyQuestions_SurveyId (survey_id),
                CONSTRAINT FK_SurveyQuestions_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 36/43 - Tabela SurveyQuestions criada');

        // 37. SurveyQuestionOptions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyQuestionOptions (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                question_id INT NOT NULL,
                opcao VARCHAR(500) NOT NULL,
                ordem INT NOT NULL,
                CONSTRAINT FK_SurveyQuestionOptions_Question FOREIGN KEY (question_id) REFERENCES SurveyQuestions(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 37/43 - Tabela SurveyQuestionOptions criada');

        // 38. SurveyEligibleUsers
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyEligibleUsers (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                user_id INT NOT NULL,
                data_calculo DATETIME NOT NULL DEFAULT NOW(),
                motivo_inclusao VARCHAR(100) NULL,
                KEY idx_survey_eligible_users_survey_id (survey_id),
                KEY idx_survey_eligible_users_user_id (user_id),
                UNIQUE KEY UQ_SurveyEligibleUsers_SurveyUser (survey_id, user_id),
                CONSTRAINT FK_SurveyEligibleUsers_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id),
                CONSTRAINT FK_SurveyEligibleUsers_User FOREIGN KEY (user_id) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 38/43 - Tabela SurveyEligibleUsers criada');

        // 39. SurveyResponses
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyResponses (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                question_id INT NOT NULL,
                user_id INT NOT NULL,
                resposta_texto TEXT NULL,
                resposta_numerica INT NULL,
                option_id INT NULL,
                data_resposta DATETIME NOT NULL DEFAULT NOW(),
                KEY IX_SurveyResponses_SurveyUser (survey_id, user_id),
                CONSTRAINT FK_SurveyResponses_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id),
                CONSTRAINT FK_SurveyResponses_Question FOREIGN KEY (question_id) REFERENCES SurveyQuestions(Id),
                CONSTRAINT FK_SurveyResponses_User FOREIGN KEY (user_id) REFERENCES Users(Id),
                CONSTRAINT FK_SurveyResponses_Option FOREIGN KEY (option_id) REFERENCES SurveyQuestionOptions(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 39/43 - Tabela SurveyResponses criada');

        // 40. SurveyFilialFilters
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyFilialFilters (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                filial_codigo VARCHAR(10) NOT NULL,
                filial_nome VARCHAR(100) NOT NULL,
                Unidade VARCHAR(100) NULL,
                NomeUnidade VARCHAR(255) NULL,
                UnidadeDescricao VARCHAR(255) NULL,
                KEY idx_survey_filial_filters_survey_id (survey_id),
                CONSTRAINT FK_SurveyFilialFilters_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 40/43 - Tabela SurveyFilialFilters criada');

        // 41. SurveyDepartamentoFilters
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyDepartamentoFilters (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                departamento_codigo VARCHAR(200) NULL,
                departamento_nome VARCHAR(200) NOT NULL,
                Departamento VARCHAR(200) NULL,
                NomeDepartamento VARCHAR(255) NULL,
                DescricaoDepartamento VARCHAR(255) NULL,
                KEY idx_survey_dept_filters_survey_id (survey_id),
                CONSTRAINT FK_SurveyDepartamentoFilters_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 41/43 - Tabela SurveyDepartamentoFilters criada');

        // 42. SurveyNotificationLog
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SurveyNotificationLog (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                survey_id INT NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                sent_at DATETIME DEFAULT NOW(),
                CONSTRAINT FK_SurveyNotificationLog_Survey FOREIGN KEY (survey_id) REFERENCES Surveys(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 42/43 - Tabela SurveyNotificationLog criada');

        // 43. UserPoints e UserRankings
        await connection.query(`
            CREATE TABLE IF NOT EXISTS UserPoints (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                TotalPoints INT DEFAULT 0,
                LastUpdated DATETIME DEFAULT NOW(),
                CONSTRAINT FK_UserPoints_User FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS UserRankings (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT NOT NULL,
                Month INT NOT NULL,
                Year INT NOT NULL,
                TotalPoints INT DEFAULT 0,
                LumicoinEarned INT DEFAULT 0,
                \`Rank\` INT NULL,
                CreatedAt DATETIME DEFAULT NOW(),
                KEY IX_UserRankings_MonthYear (Month, Year),
                KEY IX_UserRankings_Rank (\`Rank\`),
                UNIQUE KEY UQ_UserRankings_UserMonthYear (UserId, Month, Year),
                CONSTRAINT FK_UserRankings_User FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 43/43 - Tabelas UserPoints e UserRankings criadas');

        // =====================================================================
        // VIEWS
        // =====================================================================
        console.log('\n📋 Criando VIEWs...');

        // VIEW vw_SurveysSummary
        await connection.query(`
            CREATE OR REPLACE VIEW vw_SurveysSummary AS
            SELECT
                s.Id,
                s.titulo,
                s.descricao,
                s.status,
                s.anonima,
                s.data_inicio,
                s.data_encerramento,
                s.data_criacao,
                s.criado_por,
                u.NomeCompleto as criador_nome,
                (SELECT COUNT(*) FROM SurveyQuestions WHERE survey_id = s.Id) as total_perguntas,
                (SELECT COUNT(*) FROM SurveyEligibleUsers WHERE survey_id = s.Id) as total_usuarios_elegiveis,
                (SELECT COUNT(DISTINCT user_id) FROM SurveyResponses WHERE survey_id = s.Id) as total_respostas,
                CASE
                    WHEN s.status = 'Ativa' AND
                         (s.data_inicio IS NULL OR s.data_inicio <= NOW()) AND
                         (s.data_encerramento IS NULL OR s.data_encerramento > NOW())
                    THEN 'Ativa'
                    WHEN s.status = 'Ativa' AND s.data_inicio IS NOT NULL AND s.data_inicio > NOW()
                    THEN 'Agendada'
                    WHEN s.status = 'Ativa' AND s.data_encerramento IS NOT NULL AND s.data_encerramento <= NOW()
                    THEN 'Encerrada'
                    ELSE s.status
                END as status_calculado,
                CASE
                    WHEN (SELECT COUNT(*) FROM SurveyEligibleUsers WHERE survey_id = s.Id) > 0
                    THEN CAST(ROUND(
                        ((SELECT COUNT(DISTINCT user_id) FROM SurveyResponses WHERE survey_id = s.Id) /
                         (SELECT COUNT(*) FROM SurveyEligibleUsers WHERE survey_id = s.Id)) * 100, 2
                    ) AS DECIMAL(5,2))
                    ELSE 0.00
                END as taxa_resposta,
                'Colaboradores elegíveis' as publico_alvo
            FROM Surveys s
            LEFT JOIN Users u ON s.criado_por = u.Id
        `);
        console.log('✅ VIEW vw_SurveysSummary criada');

        // VIEW vw_UserHierarchy
        await connection.query(`
            CREATE OR REPLACE VIEW vw_UserHierarchy AS
            SELECT
                u.Id,
                u.NomeCompleto,
                u.CPF,
                u.Matricula,
                u.Departamento,
                u.HierarchyPath,
                u.IsActive,
                u.LastLogin,
                h_dept.NIVEL_1_DIRETORIA,
                h_dept.NIVEL_1_DIRETORIA_DESC,
                h_dept.NIVEL_1_MATRICULA_RESP,
                h_dept.NIVEL_2_GERENCIA,
                h_dept.NIVEL_2_GERENCIA_DESC,
                h_dept.NIVEL_2_MATRICULA_RESP,
                h_dept.NIVEL_3_COORDENACAO,
                h_dept.NIVEL_3_COORDENACAO_DESC,
                h_dept.NIVEL_3_MATRICULA_RESP,
                h_dept.NIVEL_4_DEPARTAMENTO,
                h_dept.NIVEL_4_DEPARTAMENTO_DESC,
                h_dept.NIVEL_4_MATRICULA_RESP,
                h_dept.DEPTO_ATUAL,
                h_dept.DESCRICAO_ATUAL,
                h_dept.RESPONSAVEL_ATUAL,
                h_dept.FILIAL,
                h_dept.HIERARQUIA_COMPLETA
            FROM Users u
            LEFT JOIN TAB_HIST_SRA sra ON u.Matricula = sra.MATRICULA AND sra.STATUS_GERAL = 'ATIVO'
            LEFT JOIN HIERARQUIA_CC h_dept ON sra.CENTRO_CUSTO = h_dept.DEPTO_ATUAL
            WHERE u.IsActive = 1
        `);
        console.log('✅ VIEW vw_UserHierarchy criada');

        // =====================================================================
        // DADOS INICIAIS
        // =====================================================================
        console.log('\n📋 Inserindo dados iniciais...');

        // Inserir roles padrão
        await connection.query(`
            INSERT IGNORE INTO Roles (Name, Description) VALUES
            ('admin', 'Administrador do sistema'),
            ('public', 'Usuário comum'),
            ('manager', 'Gestor')
        `);
        console.log('✅ Roles padrão inseridos');

        // Inserir tipos de avaliação padrão
        await connection.query(`
            INSERT IGNORE INTO TiposAvaliacao (Nome, DiasMinimos, DiasMaximos, Descricao) VALUES
            ('Avaliação de 45 dias', 45, 45, 'Avaliação de experiência após 45 dias de admissão'),
            ('Avaliação de 90 dias', 90, 90, 'Avaliação de experiência após 90 dias de admissão')
        `);
        console.log('✅ Tipos de avaliação padrão inseridos');

        console.log('\n🎉 Setup COMPLETO do banco de dados concluído com sucesso!');
        console.log('\n⚠️  IMPORTANTE:');
        console.log('   - As tabelas TAB_HIST_SRA e HIERARQUIA_CC devem ser populadas via Airflow');
        console.log('   - A VIEW ULTIMOS_5_PEDIDOS não foi criada (era específica do Oracle)');
        console.log('   - Total: 43 tabelas + 2 views criadas\n');

    } catch (error) {
        console.error('❌ Erro durante o setup:', error.message);
        console.error(error);
        throw error;
    } finally {
        await connection.end();
    }
}

setupDatabase().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});

