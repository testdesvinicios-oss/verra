const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÕES
const TARGET_URL = 'https://newsametoday-prod.web.app/'; // Coloque aqui a URL final permitida
const IPQS_API_KEY = 'CcxLyG6R8RZfOmaVG5koV2ayTwaJeSSA'; // Sua API Key do IPQS

// Habilita a leitura correta do IP real no Render
app.set('trust proxy', true);

app.use(async (req, res) => {
    // Captura o IP real enviado pelos cabeçalhos do proxy do Render
    let userIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    // Normaliza o IP IPv6 local
    if (userIP && userIP.includes('::ffff:')) {
        userIP = userIP.replace('::ffff:', '');
    }

    // Permite testes locais sem gastar créditos da API
    if (userIP === '127.0.0.1' || userIP === '::1') {
        return res.redirect(TARGET_URL);
    }

    try {
        const url = `https://www.ipqualityscore.com/api/json/ip/${IPQS_API_KEY}/${userIP}?strictness=1&allow_public_access_points=true`;
        
        const response = await axios.get(url, { timeout: 3000 });
        const data = response.data;

        if (data && data.success) {
            const isProxyOrVPN = data.proxy || data.vpn || data.tor;
            const isHighRisk = data.fraud_score >= 75; // Limite de 75%
            const isBot = data.active_bot === true;

            // Se for VPN, Proxy, Bot ou Alto Risco: BLOQUEIA
            if (isProxyOrVPN || isHighRisk || isBot) {
                console.log(`[BLOQUEADO] IP: ${userIP} | Risk Score: ${data.fraud_score}`);
                return res.status(403).send(`
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Acesso Negado</title>
                        <style>
                            body { font-family: Arial, sans-serif; background-color: #f4f4f9; text-align: center; padding: 50px; }
                            .card { background: white; padding: 30px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                            h1 { color: #d9534f; }
                            p { color: #555; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h1>Acesso Negado</h1>
                            <p>Detectamos que você está utilizando uma conexão mascarada (VPN, Proxy ou Bot).</p>
                            <p>Por razões de segurança, desative a VPN para prosseguir para o site.</p>
                        </div>
                    </body>
                    </html>
                `);
            }
        }

        // Se passar em todas as checagens: REDIRECIONA PARA O SEU SITE
        console.log(`[PERMITIDO] IP: ${userIP} | Redirecionando...`);
        return res.redirect(TARGET_URL);

    } catch (error) {
        // Fallback: Se o IPQS der timeout/erro, permite a passagem para não derrubar seu tráfego
        console.error('Erro na consulta do IPQS:', error.message);
        return res.redirect(TARGET_URL);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
