const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÕES
const TARGET_URL = 'https://newsametoday-prod.web.app/';
const ABSTRACT_API_KEY = '4ac60ba115d84da6a0971fff4abad5ff'; // Insira a chave do Abstract API

app.set('trust proxy', true);

app.use(async (req, res) => {
    let userIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    if (userIP && userIP.includes('::ffff:')) {
        userIP = userIP.replace('::ffff:', '');
    }

    if (userIP === '127.0.0.1' || userIP === '::1') {
        return res.redirect(TARGET_URL);
    }

    try {
        const url = `https://ipgeolocation.abstractapi.com/v1/?api_key=${ABSTRACT_API_KEY}&ip_address=${userIP}`;
        const response = await axios.get(url, { timeout: 4000 });
        const data = response.data;

        // O Abstract API retorna objetos de segurança com status de VPN e Proxy
        const isVPN = data.security?.is_vpn === true;
        const isProxy = data.security?.is_proxy === true;
        const isTor = data.security?.is_tor === true;

        if (isVPN || isProxy || isTor) {
            console.log(`[BLOQUEADO] IP: ${userIP} | VPN: ${isVPN} | Proxy: ${isProxy}`);
            return res.status(403).send(`
                <div style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: #d9534f;">Acesso Negado</h1>
                    <p>Conexão via VPN ou Proxy detectada. Desative a VPN para acessar o site.</p>
                </div>
            `);
        }

        console.log(`[PERMITIDO] IP: ${userIP}`);
        return res.redirect(TARGET_URL);

    } catch (error) {
        console.error('Erro na API:', error.message);
        return res.redirect(TARGET_URL);
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
