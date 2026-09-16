const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da sua API Key do IPQS
const IPQS_API_KEY = 'CcxLyG6R8RZfOmaVG5koV2aYTwaJeSSA';

// Confia em cabeçalhos de proxy (Cloudflare, Heroku, Nginx, Vercel)
app.set('trust proxy', true);

// Middleware para verificação e filtragem de IP
const verifyTraffic = async (req, res, next) => {
    // Permite testar um IP específico passando na URL (ex: http://localhost:3000/?ip=8.8.8.8)
    let userIP = req.query.ip || 
                 req.headers['cf-connecting-ip'] || 
                 req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                 req.socket.remoteAddress;

    // Remove a notação IPv6 local (::ffff:) se existir
    if (userIP && userIP.includes('::ffff:')) {
        userIP = userIP.replace('::ffff:', '');
    }

    // Se estiver rodando no computador local sem passar um IP de teste, libera o acesso
    if (userIP === '127.0.0.1' || userIP === '::1' || userIP === 'localhost') {
        console.log('Navegação Local Detectada (localhost). Acesso liberado sem consulta.');
        return next();
    }

    try {
        // Monta a URL da API do IPQS
        const url = `https://www.ipqualityscore.com/api/json/ip/${IPQS_API_KEY}/${userIP}?strictness=1&allow_public_access_points=true`;
        
        // Faz a requisição à API
        const response = await axios.get(url, { timeout: 3000 });
        const data = response.data;

        if (data && data.success) {
            // Regras de bloqueio
            const isProxyOrVPN = data.proxy || data.vpn || data.tor;
            const isHighRisk = data.fraud_score >= 75; // Bloqueia fraude acima de 75%
            const isBot = data.active_bot === true;

            // Se for VPN, Proxy, Bot ou tiver score alto de fraude: Bloqueia
            if (isProxyOrVPN || isHighRisk || isBot) {
                console.log(`[BLOQUEADO] IP: ${userIP} | Score: ${data.fraud_score} | VPN/Proxy: ${isProxyOrVPN}`);
                
                return res.status(403).send(`
                    <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h1 style="color: #d9534f;">Acesso Negado</h1>
                        <p>Detectamos o uso de conexões mascaradas (VPN/Proxy) ou tráfego não verificado.</p>
                        <p>Por favor, desative sua VPN ou Proxy para acessar o site.</p>
                    </div>
                `);
            }
        }

        console.log(`[LIBERADO] IP: ${userIP} | Score: ${data.fraud_score}`);
        next();

    } catch (error) {
        // Caso a API demore a responder ou falhe, permite a passagem para não derrubar o site
        console.error('Erro na verificação do IPQS:', error.message);
        next();
    }
};

// Aplica o verificador em todas as rotas
app.use(verifyTraffic);

// Rota principal
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #5cb85c;">Acesso Permitido!</h1>
            <p>Seu tráfego foi verificado e você está navegando com um IP real e seguro.</p>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});