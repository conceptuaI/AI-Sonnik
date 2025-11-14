const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Создаем кастомный axios instance
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

// Конфигурация Gigachat API
const GIGACHAT_CONFIG = {
    tokenUrl: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    apiUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
    // ЗАМЕНИТЕ НА ВАШ AUTHORIZATION KEY ИЗ ЛИЧНОГО КАБИНЕТА
    authorizationKey: 'MDE5YTgxNGYtYWM3ZC03MzljLWFkZmUtNjZlMGE3YTA0ODZmOjBlMDdiMWMxLTE2OGEtNDAwMi1iNDFiLTU1ZjI4MDk0YTVmMg==', // <- ЗАМЕНИТЕ ЭТО!
    rqUID: '8ed4a69a-4a19-4d19-b4b8-31030eceb020'
};

let accessToken = null;
let tokenExpires = 0;

// Функция для получения access token
async function getAccessToken() {
    try {
        console.log('🔄 Получение токена Gigachat...');

        const response = await axiosInstance.post(
            GIGACHAT_CONFIG.tokenUrl,
            'scope=GIGACHAT_API_PERS',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${GIGACHAT_CONFIG.authorizationKey}`,
                    'RqUID': GIGACHAT_CONFIG.rqUID
                },
                timeout: 10000
            }
        );

        if (response.data.access_token) {
            accessToken = response.data.access_token;
            tokenExpires = Date.now() + (response.data.expires_in * 1000);
            console.log('✅ Токен успешно получен');
            console.log('⏰ Токен истекает через:', response.data.expires_in, 'секунд');
            return accessToken;
        }
    } catch (error) {
        console.error('❌ Ошибка при получении токена:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', JSON.stringify(error.response.data, null, 2));
        }

        throw new Error('Не удалось получить access token. Проверьте Authorization Key');
    }
}

// Middleware для проверки и обновления токена
async function ensureToken() {
    if (!accessToken || Date.now() >= tokenExpires) {
        await getAccessToken();
    }
    return accessToken;
}

// API endpoint для отправки сообщений в Gigachat
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }

        console.log('📨 Получено сообщение:', message.substring(0, 50) + '...');

        const token = await ensureToken();

        const response = await axiosInstance.post(
            `${GIGACHAT_CONFIG.apiUrl}/chat/completions`,
            {
                model: "GigaChat",
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log('✅ Ответ от Gigachat получен');

        res.json({
            success: true,
            response: response.data.choices[0].message.content
        });

    } catch (error) {
        console.error('❌ Ошибка при обращении к Gigachat API:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            if (error.response.status === 401) {
                console.error('Ошибка аутентификации');
            }
        }

        res.status(500).json({
            error: 'Ошибка при обработке запроса',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await ensureToken();
        res.json({
            status: 'healthy',
            token: accessToken ? 'available' : 'unavailable'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: 'Token unavailable'
        });
    }
});

// Обслуживание статических файлов
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 URL: http://localhost:${PORT}`);

    if (GIGACHAT_CONFIG.authorizationKey === 'YOUR_AUTHORIZATION_KEY_HERE') {
        console.log('❌ ВНИМАНИЕ: Установите правильный Authorization Key в файле server.js');
        console.log('📝 Как получить Authorization Key:');
        console.log('1. Перейдите на https://developers.sber.ru/studio/products/gigachatapi');
        console.log('2. Создайте приложение или выберите существующее');
        console.log('3. Скопируйте Authorization Key из настроек приложения');
        console.log('4. Замените YOUR_AUTHORIZATION_KEY_HERE в server.js');
    } else {
        try {
            await getAccessToken();
            console.log('✅ Gigachat токен инициализирован');
        } catch (error) {
            console.log('⚠️ Токен будет получен при первом запросе');
        }
    }
});