const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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
    authorizationKey: 'MDE5YTgxNGYtYWM3ZC03MzljLWFkZmUtNjZlMGE3YTA0ODZmOmFhZmMwNDlkLTQ1MGItNDEyZi1hNDhjLTAxNGY2YTljNzJjOQ==',
    rqUID: '019a814f-ac7d-739c-adfe-66e0a7a0486f'
};

// Конфигурация SaluteSpeech API
const SALUTE_SPEECH_CONFIG = {
    tokenUrl: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    apiUrl: 'https://smartspeech.sber.ru/rest/v1/text:synthesize',
    recognitionApiUrl: 'https://smartspeech.sber.ru/rest/v1/speech:recognize',
    authorizationKey: 'MDE5YTgxZDYtNjQ5Yi03NzFlLTk3YzAtNzM0ODFiYzQ4NzdmOjZjY2U2NGQ1LWU3MDgtNGI0NC1iNTVmLTQ1Y2EyZDIzODQzMA==',
    rqUID: '019a81d6-649b-771e-97c0-73481bc4877f'
};

let gigachatAccessToken = null;
let gigachatTokenExpires = 0;
let saluteSpeechAccessToken = null;
let saluteSpeechTokenExpires = 0;

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
                                                 phone TEXT UNIQUE NOT NULL,
                                                 password TEXT NOT NULL,
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

    // Таблица аудио файлов
    db.run(`CREATE TABLE IF NOT EXISTS audio_files (
                                                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                       user_id INTEGER NOT NULL,
                                                       dream_id INTEGER,
                                                       text_content TEXT NOT NULL,
                                                       audio_filename TEXT NOT NULL,
                                                       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                       FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (dream_id) REFERENCES dreams (id)
        )`);

    // Таблица чатов
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
                                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                         user_id INTEGER NOT NULL,
                                                         message_text TEXT NOT NULL,
                                                         response_text TEXT NOT NULL,
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

// Функция для валидации номера телефона
function validatePhone(phone) {
    const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Функция для нормализации номера телефона
function normalizePhone(phone) {
    // Удаляем все нецифровые символы
    let normalized = phone.replace(/\D/g, '');

    // Если номер начинается с 8, заменяем на +7
    if (normalized.startsWith('8') && normalized.length === 11) {
        normalized = '7' + normalized.slice(1);
    }

    // Если номер начинается с 7 и имеет 11 цифр, добавляем +
    if (normalized.startsWith('7') && normalized.length === 11) {
        normalized = '+' + normalized;
    }

    return normalized;
}

// Функция для получения access token Gigachat
async function getGigachatAccessToken() {
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
            gigachatAccessToken = response.data.access_token;
            gigachatTokenExpires = Date.now() + (response.data.expires_in * 1000);
            console.log('✅ Токен Gigachat успешно получен');
            return gigachatAccessToken;
        }
    } catch (error) {
        console.error('❌ Ошибка при получении токена Gigachat:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', JSON.stringify(error.response.data, null, 2));
        }

        throw new Error('Не удалось получить access token Gigachat');
    }
}

// Функция для получения access token SaluteSpeech
async function getSaluteSpeechAccessToken() {
    try {
        console.log('🔄 Получение токена SaluteSpeech...');

        const response = await axiosInstance.post(
            SALUTE_SPEECH_CONFIG.tokenUrl,
            'scope=SALUTE_SPEECH_PERS',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${SALUTE_SPEECH_CONFIG.authorizationKey}`,
                    'RqUID': SALUTE_SPEECH_CONFIG.rqUID
                },
                timeout: 10000
            }
        );

        if (response.data.access_token) {
            saluteSpeechAccessToken = response.data.access_token;
            saluteSpeechTokenExpires = Date.now() + (response.data.expires_in * 1000);
            console.log('✅ Токен SaluteSpeech успешно получен');
            return saluteSpeechAccessToken;
        }
    } catch (error) {
        console.error('❌ Ошибка при получении токена SaluteSpeech:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', JSON.stringify(error.response.data, null, 2));
        }

        throw new Error('Не удалось получить access token SaluteSpeech');
    }
}

// Middleware для проверки и обновления токена Gigachat
async function ensureGigachatToken() {
    if (!gigachatAccessToken || Date.now() >= gigachatTokenExpires) {
        await getGigachatAccessToken();
    }
    return gigachatAccessToken;
}

// Middleware для проверки и обновления токена SaluteSpeech
async function ensureSaluteSpeechToken() {
    if (!saluteSpeechAccessToken || Date.now() >= saluteSpeechTokenExpires) {
        await getSaluteSpeechAccessToken();
    }
    return saluteSpeechAccessToken;
}

// Промт для ИИ-Сонника
const DREAM_INTERPRETER_PROMPT = `# Ты — ИИ-Сонник

## Задача
Интерпретируй сны пользователей мягко и доброжелательно, используя легкий мистический тон. Обращайся к пользователям по имени, применяй метафоры и ассоциации. Если сюжет сна вызывает тревогу, успокой человека, предложив положительное символическое объяснение. Избегай использования научных терминов.

## Правила
- Всегда запрашивай текст сна перед началом интерпретации.
- Если описание сна отсутствует, выводи только сообщение "Вы неправильно ввели сон" и ничего больше!!!.
- При наличии тревожных элементов давай спокойные, поддерживающие комментарии.`;

// Промт для общего чата
const CHAT_PROMPT = `Ты — дружелюбный AI помощник от Сбербанка. Отвечай на вопросы вежливо и информативно. 
Если не знаешь ответа, честно скажи об этом. Будь полезным и внимательным собеседником.`;

// Функция для интерпретации снов
async function interpretDream(dreamDescription, userName = 'дорогой друг') {
    const token = await ensureGigachatToken();

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

// Функция для общего чата
async function chatWithAI(message, userName = 'пользователь') {
    const token = await ensureGigachatToken();

    const response = await axiosInstance.post(
        `${GIGACHAT_CONFIG.apiUrl}/chat/completions`,
        {
            model: "GigaChat",
            messages: [
                {
                    role: "system",
                    content: CHAT_PROMPT
                },
                {
                    role: "user",
                    content: `${userName !== 'пользователь' ? `Пользователь ${userName} спрашивает: ` : ''}${message}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
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

// Функция для синтеза речи
async function synthesizeSpeech(text, voice = 'Nec_24000') {
    try {
        const token = await ensureSaluteSpeechToken();

        console.log('🔊 Синтез речи для текста:', text.substring(0, 100) + '...');
        console.log('🎵 Выбранный голос:', voice);

        // Проверяем и очищаем текст
        if (!text || text.trim().length === 0) {
            throw new Error('Текст для синтеза не может быть пустым');
        }

        // Обрезаем текст до максимальной длины
        const maxLength = 5000;
        if (text.length > maxLength) {
            console.warn('⚠️ Текст слишком длинный, обрезаем до', maxLength, 'символов');
            text = text.substring(0, maxLength);
        }

        // Очищаем текст
        text = text.replace(/[^\w\sА-Яа-я.,!?;:()-]/gu, ' ').replace(/\s+/g, ' ').trim();

        // Доступные голоса
        const availableVoices = {
            'Nec_24000': 'Nec_24000',
            'May_24000': 'May_24000',
            'Turbo_24000': 'Turbo_24000',
            'Bys_24000': 'Bys_24000',
            'Kho_24000': 'Kho_24000'
        };

        const selectedVoice = availableVoices[voice] || 'Nec_24000';

        console.log('🔧 Параметры синтеза:', {
            text_length: text.length,
            voice: selectedVoice,
            format: 'opus'
        });

        // Создаем URL с параметрами
        const url = new URL(SALUTE_SPEECH_CONFIG.apiUrl);
        url.searchParams.append('voice', selectedVoice);
        url.searchParams.append('format', 'opus');
        url.searchParams.append('speed', '1.0');
        url.searchParams.append('emotion', 'neutral');

        console.log('📤 URL запроса:', url.toString());

        const response = await axiosInstance.post(
            url.toString(),
            text, // Отправляем только текст
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'text/plain',
                    'Accept': 'audio/ogg'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        console.log('✅ Ответ получен, статус:', response.status);
        console.log('📊 Размер аудио данных:', response.data.length, 'байт');

        if (!response.data || response.data.length === 0) {
            throw new Error('Получен пустой аудио ответ');
        }

        const filename = `audio_${uuidv4()}.opus`;
        const filepath = path.join(__dirname, 'public', 'audio', filename);

        fs.writeFileSync(filepath, response.data);
        console.log('💾 Аудио файл сохранен:', filename);

        return filename;

    } catch (error) {
        console.error('❌ Ошибка при синтезе речи:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Заголовки:', JSON.stringify(error.response.headers, null, 2));

            if (error.response.data) {
                const errorData = error.response.data.toString();
                console.error('Данные ошибки:', errorData.substring(0, 500));
            }
        }

        throw new Error(`Не удалось синтезировать речь: ${error.message}`);
    }
}

// Сохранение информации об аудио файле в БД
function saveAudioToDatabase(userId, dreamId, text, audioFilename) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO audio_files (user_id, dream_id, text_content, audio_filename) VALUES (?, ?, ?, ?)`,
            [userId, dreamId, text, audioFilename],
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

// Сохранение сообщения чата в БД
function saveChatMessage(userId, message, response) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO chat_messages (user_id, message_text, response_text) VALUES (?, ?, ?)`,
            [userId, message, response],
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

// Получение истории чата
function getChatHistory(userId, limit = 50) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, message_text, response_text, created_at
             FROM chat_messages
             WHERE user_id = ?
             ORDER BY created_at DESC
                 LIMIT ?`,
            [userId, limit],
            (err, messages) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(messages.reverse()); // Возвращаем в хронологическом порядке
                }
            }
        );
    });
}

// Регистрация пользователя по номеру телефона
app.post('/api/register', async (req, res) => {
    try {
        const { username, phone, password } = req.body;

        // Валидация
        if (!username || !phone || !password) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверка номера телефона
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'Некорректный номер телефона. Используйте российский формат (+7 XXX XXX XX XX)' });
        }

        // Нормализация номера телефона
        const normalizedPhone = normalizePhone(phone);

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Сохранение пользователя в БД
        db.run(
            `INSERT INTO users (username, phone, password) VALUES (?, ?, ?)`,
            [username, normalizedPhone, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        if (err.message.includes('phone')) {
                            return res.status(400).json({ error: 'Пользователь с таким номером телефона уже существует' });
                        } else if (err.message.includes('username')) {
                            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
                        }
                        return res.status(400).json({ error: 'Пользователь с такими данными уже существует' });
                    }
                    return res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
                }

                // Генерация JWT токена
                const token = jwt.sign(
                    { userId: this.lastID, username, phone: normalizedPhone },
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
                        phone: normalizedPhone
                    }
                });
            }
        );

    } catch (error) {
        console.error('❌ Ошибка при регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Авторизация пользователя по номеру телефона
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Номер телефона и пароль обязательны' });
        }

        // Проверка номера телефона
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'Некорректный номер телефона' });
        }

        // Нормализация номера телефона
        const normalizedPhone = normalizePhone(phone);

        // Поиск пользователя в БД
        db.get(
            `SELECT * FROM users WHERE phone = ?`,
            [normalizedPhone],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }

                if (!user) {
                    return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
                }

                // Проверка пароля
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
                }

                // Генерация JWT токена
                const token = jwt.sign(
                    { userId: user.id, username: user.username, phone: user.phone },
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
                        phone: user.phone
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
        `SELECT id, username, phone, created_at FROM users WHERE id = ?`,
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
                    phone: user.phone,
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

        // Проверяем, является ли ответ сообщением об ошибке ввода
        const isErrorMessage = interpretation.includes('Вы неправильно ввели сон');

        let dreamId = null;

        // Сохранение сна и интерпретации в базу данных только если это не сообщение об ошибке
        if (!isErrorMessage) {
            try {
                dreamId = await saveDreamToDatabase(req.user.userId, dream, interpretation);
                console.log('💾 Сон сохранен в базу данных, ID:', dreamId);
            } catch (dbError) {
                console.error('❌ Ошибка при сохранении в БД:', dbError);
            }
        } else {
            console.log('⚠️ Сон не сохранен в БД - получено сообщение об ошибке ввода');
        }

        res.json({
            success: true,
            interpretation: interpretation,
            dreamId: dreamId
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

// API endpoint для общего чата
app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }

        console.log('💬 Чат от пользователя', req.user.userId, ':', message.substring(0, 50) + '...');

        const response = await chatWithAI(message, req.user.username);

        // Сохраняем сообщение в историю чата
        try {
            await saveChatMessage(req.user.userId, message, response);
            console.log('💾 Сообщение чата сохранено в базу данных');
        } catch (dbError) {
            console.error('❌ Ошибка при сохранении сообщения чата:', dbError);
        }

        res.json({
            success: true,
            response: response
        });

    } catch (error) {
        console.error('❌ Ошибка в чате:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
        }

        res.status(500).json({
            error: 'Ошибка при обработке сообщения',
            details: error.message
        });
    }
});

// Получение истории чата
app.get('/api/chat/history', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const messages = await getChatHistory(req.user.userId, limit);

        res.json({
            success: true,
            messages: messages.map(m => ({
                id: m.id,
                message: m.message_text,
                response: m.response_text,
                createdAt: m.created_at
            }))
        });

    } catch (error) {
        console.error('❌ Ошибка при получении истории чата:');
        console.error('Сообщение:', error.message);

        res.status(500).json({
            error: 'Ошибка при получении истории чата',
            details: error.message
        });
    }
});



// Альтернативная функция синтеза с формой данных
// Функция для синтеза речи
async function synthesizeSpeech(text, voice = 'Nec_24000') {
    try {
        const token = await ensureSaluteSpeechToken();

        console.log('🔊 Синтез речи для текста:', text.substring(0, 100) + '...');
        console.log('🎵 Выбранный голос:', voice);

        // Проверяем и очищаем текст
        if (!text || text.trim().length === 0) {
            throw new Error('Текст для синтеза не может быть пустым');
        }

        // Обрезаем текст до максимальной длины
        const maxLength = 5000;
        if (text.length > maxLength) {
            console.warn('⚠️ Текст слишком длинный, обрезаем до', maxLength, 'символов');
            text = text.substring(0, maxLength);
        }

        // Очищаем текст
        text = text.replace(/[^\w\sА-Яа-я.,!?;:()-]/gu, ' ').replace(/\s+/g, ' ').trim();

        // Доступные голоса
        const availableVoices = {
            'Nec_24000': 'Nec_24000',
            'May_24000': 'May_24000',
            'Turbo_24000': 'Turbo_24000',
            'Bys_24000': 'Bys_24000',
            'Kho_24000': 'Kho_24000'
        };

        const selectedVoice = availableVoices[voice] || 'Nec_24000';

        console.log('🔧 Параметры синтеза:', {
            text_length: text.length,
            voice: selectedVoice,
            format: 'opus'
        });

        // Создаем URL с параметрами
        const url = new URL(SALUTE_SPEECH_CONFIG.apiUrl);
        url.searchParams.append('voice', selectedVoice);
        url.searchParams.append('format', 'opus');
        url.searchParams.append('speed', '1.0');
        url.searchParams.append('emotion', 'neutral');

        console.log('📤 URL запроса:', url.toString());
        console.log('📝 Content-Type: application/text');

        const response = await axiosInstance.post(
            url.toString(),
            text, // Отправляем только текст
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/text', // ПРАВИЛЬНЫЙ Content-Type!
                    'Accept': 'audio/ogg'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        console.log('✅ Ответ получен, статус:', response.status);
        console.log('📊 Размер аудио данных:', response.data.length, 'байт');

        if (!response.data || response.data.length === 0) {
            throw new Error('Получен пустой аудио ответ');
        }

        const filename = `audio_${uuidv4()}.opus`;
        const filepath = path.join(__dirname, 'public', 'audio', filename);

        fs.writeFileSync(filepath, response.data);
        console.log('💾 Аудио файл сохранен:', filename);

        return filename;

    } catch (error) {
        console.error('❌ Ошибка при синтезе речи:');
        console.error('Сообщение:', error.message);

        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Заголовки:', JSON.stringify(error.response.headers, null, 2));

            if (error.response.data) {
                const errorData = error.response.data.toString();
                console.error('Данные ошибки:', errorData);
            }
        }

        throw new Error(`Не удалось синтезировать речь: ${error.message}`);
    }
}


// Функция синтеза с SSML
async function synthesizeSpeechSSML(text, voice = 'Nec_24000') {
    try {
        const token = await ensureSaluteSpeechToken();

        console.log('🔊 Синтез речи (SSML) для текста:', text.substring(0, 100) + '...');

        // Подготовка текста
        if (!text || text.trim().length === 0) {
            throw new Error('Текст для синтеза не может быть пустым');
        }

        const maxLength = 5000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
        }

        text = text.replace(/[^\w\sА-Яа-я.,!?;:()-]/gu, ' ').replace(/\s+/g, ' ').trim();

        const selectedVoice = voice || 'Nec_24000';

        // Создаем SSML разметку
        const ssmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<speak>
    <voice name="${selectedVoice}">
        ${text}
    </voice>
</speak>`;

        console.log('🔧 SSML контент:', ssmlContent.substring(0, 200) + '...');
        console.log('📝 Content-Type: application/ssml');

        const response = await axiosInstance.post(
            SALUTE_SPEECH_CONFIG.apiUrl,
            ssmlContent,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/ssml', // SSML Content-Type
                    'Accept': 'audio/ogg'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        console.log('✅ Ответ получен, статус:', response.status);
        console.log('📊 Размер аудио данных:', response.data.length, 'байт');

        if (!response.data || response.data.length === 0) {
            throw new Error('Получен пустой аудио ответ');
        }

        const filename = `audio_${uuidv4()}.opus`;
        const filepath = path.join(__dirname, 'public', 'audio', filename);

        fs.writeFileSync(filepath, response.data);
        console.log('💾 Аудио файл сохранен:', filename);

        return filename;

    } catch (error) {
        console.error('❌ Ошибка при синтезе речи (SSML):', error.message);
        throw error;
    }
}


// Альтернативная функция синтеза с формой данных
async function synthesizeSpeechFormData(text, voice = 'Nec_24000') {
    try {
        const token = await ensureSaluteSpeechToken();

        console.log('🔊 Синтез речи (FormData) для текста:', text.substring(0, 100) + '...');

        // Подготовка текста
        if (!text || text.trim().length === 0) {
            throw new Error('Текст для синтеза не может быть пустым');
        }

        const maxLength = 5000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
        }

        text = text.replace(/[^\w\sА-Яа-я.,!?;:()-]/gu, ' ').replace(/\s+/g, ' ').trim();

        const selectedVoice = voice || 'Nec_24000';

        // Создаем FormData
        const formData = new URLSearchParams();
        formData.append('text', text);
        formData.append('voice', selectedVoice);
        formData.append('format', 'opus');
        formData.append('speed', '1.0');
        formData.append('emotion', 'neutral');

        console.log('🔧 FormData параметры:', {
            text_length: text.length,
            voice: selectedVoice
        });

        const response = await axiosInstance.post(
            SALUTE_SPEECH_CONFIG.apiUrl,
            formData.toString(), // Отправляем как строку формы
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'audio/ogg'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        console.log('✅ Ответ получен, статус:', response.status);
        console.log('📊 Размер аудио данных:', response.data.length, 'байт');

        if (!response.data || response.data.length === 0) {
            throw new Error('Получен пустой аудио ответ');
        }

        const filename = `audio_${uuidv4()}.opus`;
        const filepath = path.join(__dirname, 'public', 'audio', filename);

        fs.writeFileSync(filepath, response.data);
        console.log('💾 Аудио файл сохранен:', filename);

        return filename;

    } catch (error) {
        console.error('❌ Ошибка при синтезе речи (FormData):', error.message);
        throw error;
    }
}


// API endpoint для синтеза речи
// API endpoint для синтеза речи
// API endpoint для синтеза речи
app.post('/api/synthesize-speech', authenticateToken, async (req, res) => {
    try {
        const { text, dreamId, voice } = req.body;

        console.log('🔊 Запрос на синтез речи от пользователя', req.user.userId);

        if (!text) {
            return res.status(400).json({ error: 'Текст для синтеза обязателен' });
        }

        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Текст должен быть строкой' });
        }

        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Текст не может быть пустым' });
        }

        let audioFilename;
        let methodUsed = 'unknown';

        // Пробуем разные методы по порядку
        const methods = [
            { name: 'form_data', func: synthesizeSpeechFormData },
            { name: 'url_params', func: synthesizeSpeech }
        ];

        for (const method of methods) {
            try {
                console.log(`🔊 Пробуем метод: ${method.name}`);
                audioFilename = await method.func(text, voice || 'Nec_24000');
                methodUsed = method.name;
                console.log(`✅ Метод ${method.name} сработал`);
                break;
            } catch (error) {
                console.error(`❌ Метод ${method.name} не сработал:`, error.message);
                // Продолжаем пробовать следующий метод
            }
        }

        if (!audioFilename) {
            throw new Error('Все методы синтеза речи не сработали');
        }

        // Сохраняем информацию об аудио файле в БД
        try {
            await saveAudioToDatabase(req.user.userId, dreamId || null, text, audioFilename);
            console.log('💾 Информация об аудио файле сохранена в БД');
        } catch (dbError) {
            console.error('❌ Ошибка при сохранении информации об аудио файле:', dbError);
        }

        res.json({
            success: true,
            audioUrl: `/audio/${audioFilename}`,
            filename: audioFilename,
            method: methodUsed
        });

    } catch (error) {
        console.error('❌ Ошибка при синтезе речи:');
        console.error('Сообщение:', error.message);

        res.status(500).json({
            error: 'Ошибка при синтезе речи',
            details: error.message
        });
    }
});

// Получение истории аудио файлов пользователя
app.get('/api/audio-history', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(
        `SELECT af.*, d.dream_text
         FROM audio_files af
                  LEFT JOIN dreams d ON af.dream_id = d.id
         WHERE af.user_id = ?
         ORDER BY af.created_at DESC
             LIMIT ? OFFSET ?`,
        [req.user.userId, limit, offset],
        (err, audioFiles) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            // Получение общего количества аудио файлов
            db.get(
                `SELECT COUNT(*) as total FROM audio_files WHERE user_id = ?`,
                [req.user.userId],
                (err, countResult) => {
                    if (err) {
                        return res.status(500).json({ error: 'Ошибка базы данных' });
                    }

                    res.json({
                        success: true,
                        audioFiles: audioFiles.map(af => ({
                            id: af.id,
                            text: af.text_content,
                            audioUrl: `/audio/${af.audio_filename}`,
                            dreamText: af.dream_text,
                            createdAt: af.created_at
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
        await ensureGigachatToken();
        await ensureSaluteSpeechToken();
        res.json({
            status: 'healthy',
            gigachatToken: gigachatAccessToken ? 'available' : 'unavailable',
            saluteSpeechToken: saluteSpeechAccessToken ? 'available' : 'unavailable'
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
    // Создаем папку для аудио файлов если её нет
    const audioDir = path.join(__dirname, 'public', 'audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
        console.log('📁 Создана папка для аудио файлов');
    }

    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🌙 ИИ-Сонник активирован`);
    console.log(`💬 Чат с AI подключен`);
    console.log(`🔊 SaluteSpeech API подключен`);
    console.log(`📞 Регистрация по номеру телефона включена`);

    try {
        await getGigachatAccessToken();
        console.log('✅ Gigachat токен инициализирован');
    } catch (error) {
        console.log('⚠️ Gigachat токен будет получен при первом запросе');
    }

    try {
        await getSaluteSpeechAccessToken();
        console.log('✅ SaluteSpeech токен инициализирован');
    } catch (error) {
        console.log('⚠️ SaluteSpeech токен будет получен при первом запросе');
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