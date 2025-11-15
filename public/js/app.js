const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // Состояние приложения
        const dreamInput = ref('');
        const loading = ref(false);
        const error = ref('');
        const statusMessage = ref('Готов к работе');
        const lastResponse = ref(null);
        const userDreams = ref([]);
        const activeTab = ref('dreams');

        // Состояние аутентификации
        const currentUser = ref(null);
        const isAuthenticated = ref(false);
        const showLoginForm = ref(false);
        const showRegisterForm = ref(false);

        // Состояние для чата
        const chatInput = ref('');
        const chatLoading = ref(false);
        const chatMessages = ref([]);
        const chatContainer = ref(null);

        // Состояние для синтеза речи
        const textToSpeech = ref('');
        const speechLoading = ref(false);
        const audioUrl = ref('');
        const isPlaying = ref(false);
        const audioPlayer = ref(null);
        const audioHistory = ref([]);

        // Данные форм
        const loginData = ref({ phone: '', password: '' });
        const registerData = ref({
            username: '',
            phone: '',
            password: '',
            confirmPassword: ''
        });

        // Вычисляемые свойства
        const hasResponse = computed(() => lastResponse.value !== null);
        const dreamCharacterCount = computed(() => dreamInput.value.length);
        const hasAudio = computed(() => audioUrl.value !== '');

        // Проверка аутентификации при загрузке
        const checkAuth = () => {
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('userData');

            if (token && userData) {
                currentUser.value = JSON.parse(userData);
                isAuthenticated.value = true;
                loadUserDreams();
                loadChatHistory();
                loadAudioHistory();
            }
        };

        // Загрузка снов пользователя
        const loadUserDreams = async () => {
            if (!isAuthenticated.value) return;

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/dreams?limit=50', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    userDreams.value = data.dreams;
                }
            } catch (err) {
                console.error('Ошибка при загрузке снов:', err);
            }
        };

        // Загрузка истории чата
        const loadChatHistory = async () => {
            if (!isAuthenticated.value) return;

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/chat/history?limit=50', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    // Преобразуем историю в формат сообщений
                    chatMessages.value = data.messages.flatMap(msg => [
                        {
                            id: msg.id * 2,
                            type: 'user',
                            content: msg.message,
                            timestamp: new Date(msg.createdAt)
                        },
                        {
                            id: msg.id * 2 + 1,
                            type: 'bot',
                            content: msg.response,
                            timestamp: new Date(msg.createdAt)
                        }
                    ]);

                    // Если нет истории, добавляем приветственное сообщение
                    if (chatMessages.value.length === 0) {
                        addWelcomeMessage();
                    }
                }
            } catch (err) {
                console.error('Ошибка при загрузке истории чата:', err);
                addWelcomeMessage();
            }
        };

        // Загрузка истории аудио
        const loadAudioHistory = async () => {
            if (!isAuthenticated.value) return;

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/audio-history?limit=20', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    audioHistory.value = data.audioFiles;
                }
            } catch (err) {
                console.error('Ошибка при загрузке истории аудио:', err);
            }
        };

        // Добавление приветственного сообщения в чат
        const addWelcomeMessage = () => {
            const welcomeMessage = {
                id: Date.now(),
                type: 'bot',
                content: 'Привет! Я AI помощник. Чем могу вам помочь?',
                timestamp: new Date()
            };
            chatMessages.value.push(welcomeMessage);
        };

        // Форматирование номера телефона для отображения
        const formatPhoneDisplay = (phone) => {
            if (!phone) return '';
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 11 && cleaned.startsWith('7')) {
                return `+7 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7, 9)}-${cleaned.substring(9)}`;
            }
            return phone;
        };

        // Регистрация
        const register = async () => {
            try {
                if (registerData.value.password !== registerData.value.confirmPassword) {
                    error.value = 'Пароли не совпадают';
                    return;
                }

                if (registerData.value.password.length < 6) {
                    error.value = 'Пароль должен содержать минимум 6 символов';
                    return;
                }

                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: registerData.value.username,
                        phone: registerData.value.phone,
                        password: registerData.value.password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    currentUser.value = data.user;
                    isAuthenticated.value = true;
                    showRegisterForm.value = false;
                    error.value = '';
                    statusMessage.value = 'Регистрация успешна!';
                    loadUserDreams();
                    loadChatHistory();
                    loadAudioHistory();

                    // Очистка формы
                    registerData.value = {
                        username: '',
                        phone: '',
                        password: '',
                        confirmPassword: ''
                    };
                } else {
                    error.value = data.error;
                }
            } catch (err) {
                error.value = 'Ошибка при регистрации';
            }
        };

        // Авторизация
        const login = async () => {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        phone: loginData.value.phone,
                        password: loginData.value.password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    currentUser.value = data.user;
                    isAuthenticated.value = true;
                    showLoginForm.value = false;
                    error.value = '';
                    statusMessage.value = 'Авторизация успешна!';
                    loadUserDreams();
                    loadChatHistory();
                    loadAudioHistory();

                    // Очистка формы
                    loginData.value = { phone: '', password: '' };
                } else {
                    error.value = data.error;
                }
            } catch (err) {
                error.value = 'Ошибка при авторизации';
            }
        };

        // Выход
        const logout = () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            currentUser.value = null;
            isAuthenticated.value = false;
            userDreams.value = [];
            chatMessages.value = [];
            lastResponse.value = null;
            dreamInput.value = '';
            chatInput.value = '';
            audioUrl.value = '';
            statusMessage.value = 'Вы вышли из системы';
        };

        // Интерпретация сна
        const interpretDream = async () => {
            if (!isAuthenticated.value) {
                error.value = 'Для интерпретации снов необходимо авторизоваться';
                return;
            }

            const dream = dreamInput.value.trim();
            if (!dream || loading.value) return;

            loading.value = true;
            error.value = '';
            statusMessage.value = '🌙 Расшифровываю сон...';

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/interpret-dream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ dream })
                });

                const data = await response.json();

                if (data.success) {
                    lastResponse.value = {
                        id: Date.now(),
                        interpretation: data.interpretation,
                        timestamp: new Date(),
                        dream: dream,
                        dreamId: data.dreamId
                    };

                    // Обновляем список снов
                    await loadUserDreams();

                    statusMessage.value = '✨ Сон расшифрован';
                } else {
                    throw new Error(data.error || 'Неизвестная ошибка');
                }
            } catch (err) {
                error.value = `Ошибка: ${err.message}`;
                statusMessage.value = 'Ошибка при интерпретации сна';
            } finally {
                loading.value = false;
            }
        };

        // Отправка сообщения в чат
        const sendChatMessage = async () => {
            if (!isAuthenticated.value) {
                error.value = 'Для общения в чате необходимо авторизоваться';
                return;
            }

            const message = chatInput.value.trim();
            if (!message || chatLoading.value) return;

            // Добавляем сообщение пользователя
            const userMessage = {
                id: Date.now(),
                type: 'user',
                content: message,
                timestamp: new Date()
            };
            chatMessages.value.push(userMessage);
            chatInput.value = '';

            chatLoading.value = true;
            error.value = '';
            statusMessage.value = '💬 Отправка сообщения...';

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message })
                });

                const data = await response.json();

                if (data.success) {
                    // Добавляем ответ бота
                    const botMessage = {
                        id: Date.now() + 1,
                        type: 'bot',
                        content: data.response,
                        timestamp: new Date()
                    };
                    chatMessages.value.push(botMessage);
                    statusMessage.value = '✅ Ответ получен';

                    // Прокрутка к последнему сообщению
                    scrollToBottom();
                } else {
                    throw new Error(data.error || 'Неизвестная ошибка');
                }
            } catch (err) {
                error.value = `Ошибка: ${err.message}`;
                statusMessage.value = 'Ошибка при отправке сообщения';

                const errorMessage = {
                    id: Date.now() + 1,
                    type: 'bot',
                    content: `Извините, произошла ошибка: ${err.message}`,
                    timestamp: new Date(),
                    isError: true
                };
                chatMessages.value.push(errorMessage);
                scrollToBottom();
            } finally {
                chatLoading.value = false;
            }
        };

        // Прокрутка чата к низу
        const scrollToBottom = () => {
            nextTick(() => {
                if (chatContainer.value) {
                    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
                }
            });
        };

        // Синтез речи
        const synthesizeSpeech = async () => {
            if (!isAuthenticated.value) {
                error.value = 'Для синтеза речи необходимо авторизоваться';
                return;
            }

            const text = textToSpeech.value.trim();
            if (!text || speechLoading.value) return;

            speechLoading.value = true;
            error.value = '';
            statusMessage.value = '🔊 Синтезирую речь...';

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/synthesize-speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        text: text,
                        dreamId: lastResponse.value?.dreamId || null
                    })
                });

                const data = await response.json();

                if (data.success) {
                    audioUrl.value = data.audioUrl;
                    statusMessage.value = '✅ Речь синтезирована';

                    // Обновляем историю аудио
                    await loadAudioHistory();

                    // Автоматическое воспроизведение
                    setTimeout(() => {
                        playAudio();
                    }, 500);
                } else {
                    throw new Error(data.error || 'Неизвестная ошибка');
                }
            } catch (err) {
                error.value = `Ошибка при синтезе речи: ${err.message}`;
                statusMessage.value = 'Ошибка при синтезе речи';
            } finally {
                speechLoading.value = false;
            }
        };

        // Синтез речи из толкования сна
        const synthesizeFromInterpretation = () => {
            if (lastResponse.value && lastResponse.value.interpretation) {
                textToSpeech.value = lastResponse.value.interpretation;
                synthesizeSpeech();
            }
        };

        // Воспроизведение аудио
        const playAudio = () => {
            if (!audioUrl.value) return;

            if (!audioPlayer.value) {
                audioPlayer.value = new Audio(audioUrl.value);
                audioPlayer.value.addEventListener('ended', () => {
                    isPlaying.value = false;
                });
                audioPlayer.value.addEventListener('pause', () => {
                    isPlaying.value = false;
                });
            }

            if (isPlaying.value) {
                audioPlayer.value.pause();
                isPlaying.value = false;
            } else {
                audioPlayer.value.play();
                isPlaying.value = true;
            }
        };

        // Воспроизведение аудио из истории
        const playAudioFromHistory = (audioUrl) => {
            const audio = new Audio(audioUrl);
            audio.play();
        };

        // Очистка чата
        const clearChat = () => {
            chatMessages.value = [];
            addWelcomeMessage();
            statusMessage.value = 'Чат очищен';
        };

        // Очистка формы сна
        const clearForm = () => {
            dreamInput.value = '';
            error.value = '';
            statusMessage.value = 'Форма очищена';
        };

        // Очистка ответа
        const clearResponse = () => {
            lastResponse.value = null;
            statusMessage.value = 'Толкование очищено';
        };

        // Очистка аудио
        const clearAudio = () => {
            audioUrl.value = '';
            isPlaying.value = false;
            textToSpeech.value = '';
            if (audioPlayer.value) {
                audioPlayer.value.pause();
                audioPlayer.value = null;
            }
            statusMessage.value = 'Аудио очищено';
        };

        // Форматирование ответа
        const formatResponse = (text) => {
            if (!text) return '';
            return text
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/```([^`]+)```/g, '<pre>$1</pre>');
        };

        // Форматирование сообщения чата
        const formatMessage = (text) => {
            return formatResponse(text);
        };

        // Форматирование времени
        const formatTime = (timestamp) => {
            return new Date(timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // Обрезка текста для истории
        const truncateText = (text, length) => {
            if (!text) return '';
            if (text.length <= length) return text;
            return text.substring(0, length) + '...';
        };

        // Копирование в буфер обмена
        const copyToClipboard = async (text) => {
            try {
                await navigator.clipboard.writeText(text);
                statusMessage.value = 'Текст скопирован в буфер обмена';

                const originalText = error.value;
                error.value = '✅ Текст скопирован!';
                setTimeout(() => {
                    error.value = originalText;
                }, 2000);
            } catch (err) {
                error.value = 'Ошибка при копировании';
            }
        };

        // Скачивание текста
        const downloadText = (text, prefix) => {
            if (!text) return;

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusMessage.value = 'Текст скачан';
        };

        // Загрузка сна из истории
        const loadFromHistory = (dream) => {
            dreamInput.value = dream.dream;
            lastResponse.value = {
                id: dream.id,
                interpretation: dream.interpretation,
                timestamp: new Date(dream.createdAt),
                dream: dream.dream
            };
            statusMessage.value = 'Сон загружен из истории';
        };

        // Маска для телефона
        const formatPhoneInput = (event) => {
            let input = event.target.value.replace(/\D/g, '');

            if (input.startsWith('7') || input.startsWith('8')) {
                input = input.substring(1);
            }

            if (input.length > 0) {
                let formatted = '+7 (';

                if (input.length > 0) {
                    formatted += input.substring(0, 3);
                }
                if (input.length > 3) {
                    formatted += ') ' + input.substring(3, 6);
                }
                if (input.length > 6) {
                    formatted += '-' + input.substring(6, 8);
                }
                if (input.length > 8) {
                    formatted += '-' + input.substring(8, 10);
                }

                if (event.target.id === 'login-phone') {
                    loginData.value.phone = formatted;
                } else if (event.target.id === 'register-phone') {
                    registerData.value.phone = formatted;
                }
            }
        };

        // Проверка статуса сервера при загрузке
        const checkHealth = async () => {
            try {
                statusMessage.value = 'Проверка подключения...';
                const response = await fetch('/api/health');
                const data = await response.json();

                if (data.status === 'healthy') {
                    statusMessage.value = 'Подключение установлено';
                } else {
                    statusMessage.value = 'Проблемы с подключением';
                }
            } catch (err) {
                statusMessage.value = 'Сервер недоступен';
                error.value = 'Не удалось подключиться к серверу';
            }
        };

        // Наблюдатель за сообщениями чата для авто-прокрутки
        const watchChatMessages = () => {
            nextTick(() => {
                scrollToBottom();
            });
        };

        onMounted(async () => {
            await checkHealth();
            checkAuth();
        });

        return {
            // Данные
            dreamInput,
            loading,
            error,
            statusMessage,
            lastResponse,
            userDreams,
            currentUser,
            isAuthenticated,
            showLoginForm,
            showRegisterForm,
            loginData,
            registerData,
            activeTab,
            chatInput,
            chatLoading,
            chatMessages,
            chatContainer,
            textToSpeech,
            speechLoading,
            audioUrl,
            isPlaying,
            audioHistory,

            // Вычисляемые свойства
            hasResponse,
            dreamCharacterCount,
            hasAudio,

            // Методы
            register,
            login,
            logout,
            interpretDream,
            sendChatMessage,
            synthesizeSpeech,
            playAudio,
            synthesizeFromInterpretation,
            clearChat,
            clearForm,
            clearResponse,
            clearAudio,
            loadUserDreams,
            loadFromHistory,
            formatResponse,
            formatMessage,
            formatTime,
            truncateText,
            copyToClipboard,
            downloadText,
            formatPhoneDisplay,
            formatPhoneInput,
            playAudioFromHistory,
            scrollToBottom,
            watchChatMessages
        };
    }
}).mount('#app');