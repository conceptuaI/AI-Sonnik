const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // Состояние приложения
        const dreamInput = ref('');
        const loading = ref(false);
        const error = ref('');
        const statusMessage = ref('Готов к работе');
        const lastResponse = ref(null);
        const userDreams = ref([]);

        // Состояние аутентификации
        const currentUser = ref(null);
        const isAuthenticated = ref(false);
        const showLoginForm = ref(false);
        const showRegisterForm = ref(false);

        // Данные форм
        const loginData = ref({ email: '', password: '' });
        const registerData = ref({
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            birthDate: ''
        });

        // Вычисляемые свойства
        const hasResponse = computed(() => lastResponse.value !== null);
        const dreamCharacterCount = computed(() => dreamInput.value.length);

        // Проверка аутентификации при загрузке
        const checkAuth = () => {
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('userData');

            if (token && userData) {
                currentUser.value = JSON.parse(userData);
                isAuthenticated.value = true;
                loadUserDreams();
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

        // Регистрация
        const register = async () => {
            try {
                if (registerData.value.password !== registerData.value.confirmPassword) {
                    error.value = 'Пароли не совпадают';
                    return;
                }

                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: registerData.value.username,
                        email: registerData.value.email,
                        password: registerData.value.password,
                        birthDate: registerData.value.birthDate
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

                    // Очистка формы
                    registerData.value = {
                        username: '',
                        email: '',
                        password: '',
                        confirmPassword: '',
                        birthDate: ''
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
                        email: loginData.value.email,
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

                    // Очистка формы
                    loginData.value = { email: '', password: '' };
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
            lastResponse.value = null;
            dreamInput.value = '';
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
                        dream: dream
                    };

                    // Обновляем список снов
                    await loadUserDreams();

                    statusMessage.value = '✨ Сон расшифрован';

                    // Прокрутка к ответу
                    setTimeout(() => {
                        const responseSection = document.querySelector('.response-section');
                        if (responseSection) {
                            responseSection.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }, 100);

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

        // Очистка формы
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

        // Форматирование времени
        const formatTime = (timestamp) => {
            return new Date(timestamp).toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
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
        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(lastResponse.value.interpretation);
                statusMessage.value = 'Толкование скопировано в буфер обмена';

                const originalText = error.value;
                error.value = '✅ Толкование скопировано!';
                setTimeout(() => {
                    error.value = originalText;
                }, 2000);
            } catch (err) {
                error.value = 'Ошибка при копировании';
            }
        };

        // Скачивание ответа
        const downloadResponse = () => {
            if (!lastResponse.value) return;

            const blob = new Blob([lastResponse.value.interpretation], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sonnik-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusMessage.value = 'Толкование скачано';
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

        // Проверка статуса сервера при загрузке
        onMounted(async () => {
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

            // Вычисляемые свойства
            hasResponse,
            dreamCharacterCount,

            // Методы
            register,
            login,
            logout,
            interpretDream,
            clearForm,
            clearResponse,
            loadUserDreams,
            loadFromHistory,
            formatResponse,
            formatTime,
            truncateText,
            copyToClipboard,
            downloadResponse
        };
    }
}).mount('#app');