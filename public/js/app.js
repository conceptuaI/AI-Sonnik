const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const userInput = ref('');
        const loading = ref(false);
        const error = ref('');
        const statusMessage = ref('Готов к работе');
        const lastResponse = ref(null);
        const history = ref([]);

        // Вычисляемые свойства
        const hasResponse = computed(() => lastResponse.value !== null);
        const characterCount = computed(() => userInput.value.length);

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
            if (text.length <= length) return text;
            return text.substring(0, length) + '...';
        };

        // Отправка запроса
        const sendQuery = async () => {
            const query = userInput.value.trim();
            if (!query || loading.value) return;

            loading.value = true;
            error.value = '';
            statusMessage.value = 'Отправка запроса...';

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: query })
                });

                const data = await response.json();

                if (data.success) {
                    // Сохраняем ответ
                    lastResponse.value = {
                        id: Date.now(),
                        content: data.response,
                        timestamp: new Date()
                    };

                    // Добавляем в историю
                    history.value.unshift({
                        id: lastResponse.value.id,
                        query: query,
                        response: data.response,
                        timestamp: new Date()
                    });

                    // Ограничиваем историю 10 последними запросами
                    if (history.value.length > 10) {
                        history.value = history.value.slice(0, 10);
                    }

                    statusMessage.value = 'Ответ получен';

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

        // Очистка формы
        const clearForm = () => {
            userInput.value = '';
            error.value = '';
            statusMessage.value = 'Форма очищена';
        };

        // Очистка ответа
        const clearResponse = () => {
            lastResponse.value = null;
            statusMessage.value = 'Ответ очищен';
        };

        // Очистка истории
        const clearHistory = () => {
            history.value = [];
            statusMessage.value = 'История очищена';
        };

        // Загрузка из истории
        const loadFromHistory = (index) => {
            const historyItem = history.value[index];
            userInput.value = historyItem.query;
            lastResponse.value = {
                id: historyItem.id,
                content: historyItem.response,
                timestamp: historyItem.timestamp
            };
            statusMessage.value = 'Запрос загружен из истории';
        };

        // Копирование в буфер обмена
        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(lastResponse.value.content);
                statusMessage.value = 'Ответ скопирован в буфер обмена';

                // Временное подтверждение
                const originalText = error.value;
                error.value = '✅ Ответ скопирован!';
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
        });

        return {
            userInput,
            loading,
            error,
            statusMessage,
            lastResponse,
            history,
            hasResponse,
            characterCount,
            sendQuery,
            clearForm,
            clearResponse,
            clearHistory,
            loadFromHistory,
            copyToClipboard,
            downloadResponse,
            formatResponse,
            formatTime,
            truncateText
        };
    }
}).mount('#app');