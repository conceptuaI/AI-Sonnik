const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

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
    authorizationKey: 'MDE5YTgxNGYtYWM3ZC03MzljLWFkZmUtNjZlMGE3YTA0ODZmOjBlMDdiMWMxLTE2OGEtNDAwMi1iNDFiLTU1ZjI4MDk0YTVmMg==',
    rqUID: '8ed4a69a-4a19-4d19-b4b8-31030eceb020'
};

let accessToken = null;
let tokenExpires = 0;

// Инициализация базы данных
const db = new sqlite3.Database('./gigachat.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключение к SQLite базе данных установлено');
        initDatabase();
    }
});

// Инициализация таблиц
function initDatabase() {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 username TEXT UNIQUE NOT NULL,
                                                 email TEXT UNIQUE NOT NULL,
                                                 password TEXT NOT NULL,
                                                 birth_date TEXT NOT NULL,
                                                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

    // Таблица снов
    db.run(`CREATE TABLE IF NOT EXISTS dreams (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  user_id INTEGER NOT NULL,
                                                  dream_text TEXT NOT NULL,
                                                  interpretation_text TEXT NOT NULL,
                                                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                  FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
}

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа отсутствует' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
}

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

// Промт для ИИ-Сонника
const DREAM_INTERPRETER_PROMPT = `Ты — ИИ-Сонник. Твоя задача — интерпретировать сны пользователей в доброжелательном, немного мистическом стиле. 
Ты можешь обращаться по имени, использовать мягкие метафоры и ассоциации. 
Если сон содержит тревожные образы, ты утешай и предлагай символическое толкование. 
Не используй медицинские или психологические термины.`;

// Функция для интерпретации снов
async function interpretDream(dreamDescription, userName = 'дорогой друг') {
    const token = await ensureToken();

    const response = await axiosInstance.post(
        `${GIGACHAT_CONFIG.apiUrl}/chat/completions`,
        {
            model: "GigaChat",
            messages: [
                {
                    role: "system",
                    content: DREAM_INTERPRETER_PROMPT
                },
                {
                    role: "user",
                    content: `Пожалуйста, интерпретируй этот сон: "${dreamDescription}". ${userName !== 'дорогой друг' ? `Имя пользователя: ${userName}` : ''}`
                }
            ],
            temperature: 0.8,
            max_tokens: 1500,
            top_p: 0.9
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

    return response.data.choices[0].message.content;
}

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, birthDate } = req.body;

        // Валидация
        if (!username || !email || !password || !birthDate) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверка email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }

        // Проверка даты рождения
        const birthDateObj = new Date(birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDateObj.getFullYear();

        if (age < 13) {
            return res.status(400).json({ error: 'Вы должны быть старше 13 лет' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Сохранение пользователя в БД
        db.run(
            `INSERT INTO users (username, email, password, birth_date) VALUES (?, ?, ?, ?)`,
            [username, email, hashedPassword, birthDate],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Пользователь с таким email или именем уже существует' });
                    }
                    return res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
                }

                // Генерация JWT токена
                const token = jwt.sign(
                    { userId: this.lastID, username, email },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({
                    success: true,
                    message: 'Пользователь успешно зарегистрирован',
                    token,
                    user: {
                        id: this.lastID,
                        username,
                        email,
                        birthDate
                    }
                });
            }
        );

    } catch (error) {
        console.error('❌ Ошибка при регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Авторизация пользователя
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        // Поиск пользователя в БД
        db.get(
            `SELECT * FROM users WHERE email = ?`,
            [email],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }

                if (!user) {
                    return res.status(401).json({ error: 'Неверный email или пароль' });
                }

                // Проверка пароля
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Неверный email или пароль' });
                }

                // Генерация JWT токена
                const token = jwt.sign(
                    { userId: user.id, username: user.username, email: user.email },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({
                    success: true,
                    message: 'Авторизация успешна',
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        birthDate: user.birth_date
                    }
                });
            }
        );

    } catch (error) {
        console.error('❌ Ошибка при авторизации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение профиля пользователя
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get(
        `SELECT id, username, email, birth_date, created_at FROM users WHERE id = ?`,
        [req.user.userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    birthDate: user.birth_date,
                    createdAt: user.created_at
                }
            });
        }
    );
});

// Сохранение сна в базу данных
function saveDreamToDatabase(userId, dream, interpretation) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO dreams (user_id, dream_text, interpretation_text) VALUES (?, ?, ?)`,
            [userId, dream, interpretation],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

// Получение истории снов пользователя
app.get('/api/dreams', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(
        `SELECT id, dream_text, interpretation_text, created_at 
     FROM dreams 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
        [req.user.userId, limit, offset],
        (err, dreams) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            // Получение общего количества снов
            db.get(
                `SELECT COUNT(*) as total FROM dreams WHERE user_id = ?`,
                [req.user.userId],
                (err, countResult) => {
                    if (err) {
                        return res.status(500).json({ error: 'Ошибка базы данных' });
                    }

                    res.json({
                        success: true,
                        dreams: dreams.map(d => ({
                            id: d.id,
                            dream: d.dream_text,
                            interpretation: d.interpretation_text,
                            createdAt: d.created_at
                        })),
                        pagination: {
                            page,
                            limit,
                            total: countResult.total,
                            totalPages: Math.ceil(countResult.total / limit)
                        }
                    });
                }
            );
        }
    );
});

// API endpoint для интерпретации снов
app.post('/api/interpret-dream', authenticateToken, async (req, res) => {
    try {
        const { dream } = req.body;

        if (!dream) {
            return res.status(400).json({ error: 'Описание сна обязательно' });
        }

        console.log('🌙 Интерпретация сна от пользователя', req.user.userId, ':', dream.substring(0, 50) + '...');

        const interpretation = await interpretDream(dream, req.user.username);

        // Сохранение сна и интерпретации в базу данных
        try {
            await saveDreamToDatabase(req.user.userId, dream, interpretation);
            console.log('💾 Сон сохранен в базу данных');
        } catch (dbError) {
            console.error('❌ Ошибка при сохранении в БД:', dbError);
        }

        res.json({
            success: true,
            interpretation: interpretation
        });

    } catch (error) {
        console.error('❌ Ошибка при интерпретации сна:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
        }

        res.status(500).json({
            error: 'Ошибка при интерпретации сна',
            details: error.message
        });
    }
});

// Получение статистики пользователя
app.get('/api/stats', authenticateToken, (req, res) => {
    db.get(
        `SELECT COUNT(*) as total_dreams FROM dreams WHERE user_id = ?`,
        [req.user.userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            res.json({
                success: true,
                stats: {
                    totalDreams: result.total_dreams
                }
            });
        }
    );
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
    console.log(`🌙 ИИ-Сонник активирован`);

    if (GIGACHAT_CONFIG.authorizationKey === 'YOUR_AUTHORIZATION_KEY_HERE') {
        console.log('❌ ВНИМАНИЕ: Установите правильный Authorization Key в файле server.js');
    } else {
        try {
            await getAccessToken();
            console.log('✅ Gigachat токен инициализирован');
        } catch (error) {
            console.log('⚠️ Токен будет получен при первом запросе');
        }
    }
});

// Закрытие соединения с БД при завершении
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('✅ Соединение с БД закрыто');
        process.exit(0);
    });
});

module.exports = app;