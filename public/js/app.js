const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // Состояние приложения
        const userInput = ref('');
        const loading = ref(false);
        const error = ref('');
        const statusMessage = ref('Готов к работе');
        const lastResponse = ref(null);
        const userQueries = ref([]);

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
        const characterCount = computed(() => userInput.value.length);

        // Проверка аутентификации при загрузке
        const checkAuth = () => {
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('userData');

            if (token && userData) {
                currentUser.value = JSON.parse(userData);
                isAuthenticated.value = true;
                loadUserQueries();
            }
        };

        // Загрузка запросов пользователя
        const loadUserQueries = async () => {
            if (!isAuthenticated.value) return;

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/queries?limit=50', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    userQueries.value = data.queries;
                }
            } catch (err) {
                console.error('Ошибка при загрузке запросов:', err);
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
                    loadUserQueries();
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
                    loadUserQueries();
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
            userQueries.value = [];
            lastResponse.value = null;
            statusMessage.value = 'Вы вышли из системы';
        };

        // Отправка запроса к Gigachat
        const sendQuery = async () => {
            if (!isAuthenticated.value) {
                error.value = 'Для отправки запросов необходимо авторизоваться';
                return;
            }

            const query = userInput.value.trim();
            if (!query || loading.value) return;

            loading.value = true;
            error.value = '';
            statusMessage.value = 'Отправка запроса...';

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: query })
                });

                const data = await response.json();

                if (data.success) {
                    lastResponse.value = {
                        id: Date.now(),
                        content: data.response,
                        timestamp: new Date(),
                        query: query
                    };

                    // Обновляем список запросов
                    await loadUserQueries();

                    statusMessage.value = 'Ответ получен и сохранен';

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
                statusMessage.value = 'Ошибка при отправке';
            } finally {
                loading.value = false;
            }
        };

        // Остальные функции (clearForm, clearResponse, formatResponse и т.д.)
        // ... (остаются без изменений из предыдущего кода)

        const clearForm = () => {
            userInput.value = '';
            error.value = '';
            statusMessage.value = 'Форма очищена';
        };

        const clearResponse = () => {
            lastResponse.value = null;
            statusMessage.value = 'Ответ очищен';
        };

        const formatResponse = (text) => {
            if (!text) return '';
            return text
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/```([^`]+)```/g, '<pre>$1</pre>');
        };

        const formatTime = (timestamp) => {
            return new Date(timestamp).toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const truncateText = (text, length) => {
            if (text.length <= length) return text;
            return text.substring(0, length) + '...';
        };

        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(lastResponse.value.content);
                statusMessage.value = 'Ответ скопирован в буфер обмена';

                const originalText = error.value;
                error.value = '✅ Ответ скопирован!';
                setTimeout(() => {
                    error.value = originalText;
                }, 2000);
            } catch (err) {
                error.value = 'Ошибка при копировании';
            }
        };

        const downloadResponse = () => {
            if (!lastResponse.value) return;

            const blob = new Blob([lastResponse.value.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gigachat-response-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusMessage.value = 'Ответ скачан';
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
            userInput,
            loading,
            error,
            statusMessage,
            lastResponse,
            userQueries,
            currentUser,
            isAuthenticated,
            showLoginForm,
            showRegisterForm,
            loginData,
            registerData,
            hasResponse,
            characterCount,
            register,
            login,
            logout,
            sendQuery,
            clearForm,
            clearResponse,
            formatResponse,
            formatTime,
            truncateText,
            copyToClipboard,
            downloadResponse
        };
    }
}).mount('#app');