const nodemailer = require('nodemailer');

let transporter;

try {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });
} catch (error) {
    console.error('⚠️ Erro ao criar transporter de email:', error);
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Envia email de recuperação de senha (Esqueci minha senha - tela de login)
 */
exports.sendForgotPasswordEmail = async (email, token, userName) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔑 Recuperação de Senha - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#f59e0b;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">🔑 Recuperação de Senha</div>
                            </div>
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                                Você solicitou a recuperação de senha da sua conta no LumiGente. Use o token abaixo para criar uma nova senha:
                            </p>
                            
                            <!-- Token Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="background-color: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; padding: 20px; text-align: center;">
                                        <p style="color: #92400e; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Seu Token de Recuperação</p>
                                        <p style="color: #0d556d; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 4px; font-family: 'Courier New', monospace;">${token}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                                Copie o token acima e use-o na tela de login para criar sua nova senha.
                            </p>
                            
                            <div style="background:#e0f2fe;border-left:4px solid #0284c7;padding:16px;margin:24px 0;border-radius:4px;">
                                <p style="color:#075985;font-size:14px;font-weight:600;margin:0 0 8px 0;">💡 Não solicitou?</p>
                                <p style="color:#0c4a6e;font-size:14px;line-height:1.5;margin:0;">Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.</p>
                            </div>
                            
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Este token expira em <strong>15 minutos</strong>.<br>
                                Não compartilhe este token com ninguém.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de recuperação de senha enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        throw error;
    }
};

/**
 * Envia email de redefinição de senha (quando LOGADO - sistema antigo)
 */
exports.sendPasswordResetEmail = async (email, token, userName) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Alteração de Senha - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                                Você solicitou a alteração de senha da sua conta no LumiGente. Use o token abaixo para confirmar a alteração:
                            </p>
                            
                            <!-- Token Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center;">
                                        <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Seu Token de Verificação</p>
                                        <p id="token-text" style="color: #0d556d; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 4px; font-family: 'Courier New', monospace;">${token}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                                Selecione e copie o token acima, depois acesse o sistema para alterar sua senha.
                            </p>
                            
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Este token expira em 2 minutos.<br>
                                Se você não solicitou esta alteração, ignore este email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de redefinição de senha enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        throw error;
    }
};

exports.sendEmailVerification = async (email, token, userName) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verificação de Email - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                                Para confirmar o cadastro do seu email no LumiGente, use o token abaixo:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center;">
                                        <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Seu Token de Verificação</p>
                                        <p style="color: #0d556d; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 4px; font-family: 'Courier New', monospace;">${token}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                                Copie o token acima e cole no sistema para confirmar seu email.
                            </p>
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Este token expira em 2 minutos.<br>
                                Se você não solicitou esta verificação, ignore este email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de verificação enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        throw error;
    }
};

exports.sendEmailChangeAlert = async (currentEmail, cancelToken, userName, newEmail) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const cancelUrl = `${process.env.APP_BASE_URL || ''}/api/usuario/cancel-email-change?token=${encodeURIComponent(cancelToken)}`;
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: currentEmail,
        subject: 'Alerta de tentativa de alteração de email - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 30px 0;text-align:center;"><img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;"></td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá, <strong>${userName}</strong>!</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">Recebemos uma solicitação para alterar o email da sua conta para <strong>${newEmail}</strong>.</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px 0;">Se <strong>não foi você</strong>, clique no botão abaixo para cancelar essa alteração e manter seu email atual.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Cancelar alteração de email</a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">Se foi você quem solicitou, ignore este email. Este link expira em 2 minutos.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente</p>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
        attachments: [{ filename: 'logo.png', path: __dirname + '/../assets/logo.png', cid: 'logo' }]
    };

    try {
        console.log('📧 Preparando para enviar alerta de alteração de email:', {
            to: currentEmail,
            hasToken: !!cancelToken,
            tokenLength: cancelToken ? cancelToken.length : 0,
            userName: userName,
            newEmail: newEmail,
            cancelUrl: cancelUrl
        });
        
        await transporter.sendMail(mailOptions);
        console.log('✅ Alerta de alteração de email enviado com sucesso para:', currentEmail);
    } catch (error) {
        console.error('❌ Erro ao enviar alerta de alteração de email:', {
            error: error.message,
            stack: error.stack,
            to: currentEmail,
            hasToken: !!cancelToken
        });
        throw error;
    }
};

exports.sendPasswordChangeAlert = async (email, cancelToken, userName) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const cancelUrl = `${process.env.APP_BASE_URL || ''}/api/usuario/cancel-password-change?token=${encodeURIComponent(cancelToken)}`;
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Alerta de alteração de senha - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 30px 0;text-align:center;"><img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;"></td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá, <strong>${userName}</strong>!</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">Identificamos uma solicitação de alteração da senha da sua conta.</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px 0;">Se <strong>não foi você</strong>, clique no botão abaixo para cancelar essa alteração e manter sua senha atual.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Cancelar alteração de senha</a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">Se foi você quem solicitou, ignore este email. Este link expira em 2 minutos.</p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:8px 0 0 0;text-align:center;">Por segurança, após a confirmação da alteração, todas as suas sessões serão encerradas e você precisará fazer login novamente.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente</p>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
        attachments: [{ filename: 'logo.png', path: __dirname + '/../assets/logo.png', cid: 'logo' }]
    };

    try {
        console.log('📧 Preparando para enviar alerta de alteração de senha:', {
            to: email,
            hasToken: !!cancelToken,
            tokenLength: cancelToken ? cancelToken.length : 0,
            userName: userName,
            cancelUrl: cancelUrl
        });

        await transporter.sendMail(mailOptions);
        console.log('✅ Alerta de alteração de senha enviado com sucesso para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar alerta de alteração de senha:', {
            error: error.message,
            stack: error.stack,
            to: email,
            hasToken: !!cancelToken
        });
        throw error;
    }
};

/**
 * Envia email de confirmação de alteração de senha (após a senha já ter sido alterada)
 * Oferece opção de reverter para a senha anterior
 */
exports.sendPasswordChangeConfirmationAlert = async (email, revertToken, userName) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    const revertUrl = `${process.env.APP_BASE_URL || ''}/api/usuario/revert-password-change?token=${encodeURIComponent(revertToken)}`;
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔒 Senha alterada com sucesso - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 30px 0;text-align:center;"><img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;"></td></tr>
        <tr><td style="padding:40px 30px;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;background:#10b981;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">✓ Senha Alterada</div>
          </div>
          <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá, <strong>${userName}</strong>!</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">A senha da sua conta no LumiGente foi <strong>alterada com sucesso</strong>.</p>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">Por segurança, todas as suas sessões foram encerradas e você precisará fazer login com a nova senha.</p>
          
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin:24px 0;border-radius:4px;">
            <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px 0;">⚠️ Não foi você?</p>
            <p style="color:#78350f;font-size:14px;line-height:1.5;margin:0;">Se você não solicitou esta alteração, clique no botão abaixo para <strong>reverter para sua senha anterior</strong>.</p>
          </div>
          
          <div style="text-align:center;margin:28px 0;">
            <a href="${revertUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Reverter para senha anterior</a>
          </div>
          
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">Este link de reversão estará disponível por <strong>7 dias</strong>.</p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:8px 0 0 0;text-align:center;">Se foi você quem alterou, ignore este email e continue usando sua nova senha.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente</p>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
        attachments: [{ filename: 'logo.png', path: __dirname + '/../assets/logo.png', cid: 'logo' }]
    };

    try {
        console.log('📧 Preparando para enviar confirmação de alteração de senha:', {
            to: email,
            hasToken: !!revertToken,
            userName: userName,
            revertUrl: revertUrl
        });

        await transporter.sendMail(mailOptions);
        console.log('✅ Email de confirmação de alteração de senha enviado com sucesso para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar confirmação de alteração de senha:', {
            error: error.message,
            stack: error.stack,
            to: email,
            hasToken: !!revertToken
        });
        throw error;
    }
};

/**
 * Envia email quando usuário RECEBE um feedback
 */
exports.sendFeedbackNotificationEmail = async (email, userName, fromName, feedbackType, feedbackCategory) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Novo Feedback Recebido - LumiGente`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#10b981;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Novo Feedback</div>
                            </div>
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                <strong>${fromName}</strong> enviou um novo feedback para você no LumiGente.
                            </p>
                            <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <p style="color: #075985; font-size: 14px; margin: 0 0 8px 0;"><strong>Tipo:</strong> ${feedbackType}</p>
                                <p style="color: #075985; font-size: 14px; margin: 0;"><strong>Categoria:</strong> ${feedbackCategory}</p>
                            </div>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#0d556d;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Ver Feedback</a>
                            </div>
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Acesse o sistema para ler o feedback completo e responder.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de notificação de feedback enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email de feedback:', error.message);
        throw error;
    }
};

/**
 * Envia email quando usuário RECEBE um reconhecimento
 */
exports.sendRecognitionNotificationEmail = async (email, userName, fromName, badge) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Você Recebeu um Reconhecimento! - LumiGente`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#f59e0b;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Reconhecimento Recebido</div>
                            </div>
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                Parabéns! <strong>${fromName}</strong> reconheceu seu trabalho no LumiGente.
                            </p>
                            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; text-align: center;">
                                <p style="color: #92400e; font-size: 18px; font-weight: 700; margin: 0;">
                                    ${badge}
                                </p>
                            </div>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Ver Reconhecimento</a>
                            </div>
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Continue com o excelente trabalho!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de notificação de reconhecimento enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email de reconhecimento:', error.message);
        throw error;
    }
};

/**
 * Envia email quando usuário é adicionado como responsável em um novo objetivo
 */
exports.sendObjetivoNotificationEmail = async (email, userName, creatorName, objetivoTitulo, dataInicio, dataFim) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }
    
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    
    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Novo Objetivo Atribuído - LumiGente`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px 0px; text-align: center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#3b82f6;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Novo Objetivo</div>
                            </div>
                            <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Olá, <strong>${userName}</strong>!
                            </p>
                            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                <strong>${creatorName}</strong> atribuiu um novo objetivo para você no LumiGente.
                            </p>
                            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <p style="color: #1e40af; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">${objetivoTitulo}</p>
                                <p style="color: #1e3a8a; font-size: 14px; margin: 0 0 4px 0;"><strong>Início:</strong> ${dataInicio}</p>
                                <p style="color: #1e3a8a; font-size: 14px; margin: 0;"><strong>Prazo:</strong> ${dataFim}</p>
                            </div>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Ver Objetivo</a>
                            </div>
                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                Acesse o sistema para visualizar os detalhes e acompanhar o progresso.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                © ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Este é um email automático, por favor não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de notificação de objetivo enviado para:', email);
    } catch (error) {
        console.error('❌ Erro ao enviar email de objetivo:', error.message);
        throw error;
    }
};

exports.sendObjetivoApprovalRequestEmail = async (email, gestorName, solicitanteName, objetivoTitulo) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }

    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    const safeGestor = escapeHtml(gestorName);
    const safeSolicitante = escapeHtml(solicitanteName);
    const safeObjetivo = escapeHtml(objetivoTitulo);

    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Solicitação de Aprovação de Objetivo - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 30px 0;text-align:center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#f59e0b;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Aprovação de Objetivo</div>
                            </div>
                            <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                                Olá, <strong>${safeGestor}</strong>!
                            </p>
                            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
                                <strong>${safeSolicitante}</strong> registrou 100% no objetivo <strong>${safeObjetivo}</strong> e aguarda a sua aprovação de conclusão.
                            </p>
                            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin:24px 0;border-radius:4px;color:#92400e;font-size:14px;line-height:1.6;">
                                Acesse o LumiGente para revisar os detalhes do objetivo e concluir a aprovação.
                            </div>
                            <div style="text-align:center;margin:28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Abrir objetivo</a>
                            </div>
                            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">
                                Esta é uma solicitação automática. Caso já tenha aprovado ou rejeitado, desconsidere este aviso.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas</p>
                            <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    await transporter.sendMail(mailOptions);
};

exports.sendObjetivoConclusionApprovedEmail = async (email, userName, gestorName, objetivoTitulo) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }

    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    const safeUser = escapeHtml(userName);
    const safeGestor = escapeHtml(gestorName);
    const safeObjetivo = escapeHtml(objetivoTitulo);

    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Objetivo Concluído - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 30px 0;text-align:center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#10b981;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Objetivo Concluído</div>
                            </div>
                            <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                                Olá, <strong>${safeUser}</strong>!
                            </p>
                            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
                                <strong>${safeGestor}</strong> aprovou a conclusão do objetivo <strong>${safeObjetivo}</strong>.
                            </p>
                            <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;margin:24px 0;border-radius:4px;color:#047857;font-size:14px;line-height:1.6;">
                                Parabéns pelo resultado! Continue acompanhando os próximos passos dentro da plataforma.
                            </div>
                            <div style="text-align:center;margin:28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Abrir objetivo</a>
                            </div>
                            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">
                                Acesse o LumiGente para visualizar os detalhes e celebrar com a sua equipe.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas</p>
                            <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    await transporter.sendMail(mailOptions);
};

exports.sendObjetivoConclusionRejectedEmail = async (email, userName, gestorName, objetivoTitulo, motivo, progressoAnterior) => {
    if (!transporter) {
        throw new Error('Serviço de email não configurado');
    }

    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3057';
    const safeUser = escapeHtml(userName);
    const safeGestor = escapeHtml(gestorName);
    const safeObjetivo = escapeHtml(objetivoTitulo);
    const safeMotivo = escapeHtml(motivo);
    const safeProgresso = escapeHtml(`${progressoAnterior}%`);

    const mailOptions = {
        from: `"LumiGente" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Conclusão de Objetivo Rejeitada - LumiGente',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 30px 0;text-align:center;">
                            <img src="cid:logo" alt="LumiGente" style="max-width:180px;height:auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px 30px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                <div style="display:inline-block;background:#ef4444;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;">Revisão Necessária</div>
                            </div>
                            <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                                Olá, <strong>${safeUser}</strong>.
                            </p>
                            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
                                <strong>${safeGestor}</strong> rejeitou a conclusão do objetivo <strong>${safeObjetivo}</strong>.
                            </p>
                            <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:24px 0;border-radius:4px;color:#b91c1c;font-size:14px;line-height:1.6;">
                                <p style="margin:0 0 8px 0;"><strong>Motivo informado:</strong></p>
                                <p style="margin:0;">${safeMotivo}</p>
                                <p style="margin:12px 0 0 0;"><strong>Progresso restaurado:</strong> ${safeProgresso}</p>
                            </div>
                            <div style="text-align:center;margin:28px 0;">
                                <a href="${appUrl}/pages/index.html" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Rever objetivo</a>
                            </div>
                            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;">
                                Ajuste o objetivo conforme necessário e registre um novo check-in quando estiver pronto.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f9fafb;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="color:#6b7280;font-size:13px;margin:0 0 10px 0;">© ${new Date().getFullYear()} LumiGente - Sistema de Gestão de Pessoas</p>
                            <p style="color:#9ca3af;font-size:12px;margin:0;">Este é um email automático, por favor não responda.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/../assets/logo.png',
            cid: 'logo'
        }]
    };

    await transporter.sendMail(mailOptions);
};
