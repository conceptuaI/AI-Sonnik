<template>
  <div id="app">
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <h1>🤖 Gigachat Client</h1>
          <p>Общайтесь с AI от Сбербанка</p>
        </div>
      </header>

      <main class="app-main">
        <div class="status-bar">
          <span v-if="loading" class="loading-spinner"></span>
          <span>{{ statusMessage }}</span>
          <button v-if="messages.length > 0" @click="clearChat" class="clear-btn">
            🗑️ Очистить чат
          </button>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <HelloWorld
            :messages="messages"
            :loading="loading"
            @send-message="sendMessage"
            @clear-chat="clearChat"
        />
      </main>
    </div>
  </div>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'

export default {
  name: 'App',
  components: {
    HelloWorld
  },
  data() {
    return {
      messages: [],
      loading: false,
      error: '',
      statusMessage: 'Готов к работе'
    }
  },
  methods: {
    async sendMessage(message) {
      if (!message.trim() || this.loading) return;

      // Добавляем сообщение пользователя
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: message,
        timestamp: new Date()
      };
      this.messages.push(userMessage);
      this.loading = true;
      this.error = '';
      this.statusMessage = 'Отправка запроса...';

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
          this.messages.push(botMessage);
          this.statusMessage = 'Ответ получен';
        } else {
          throw new Error(data.error || 'Неизвестная ошибка');
        }
      } catch (err) {
        this.error = `Ошибка: ${err.message}`;
        this.statusMessage = 'Ошибка при отправке';

        // Добавляем сообщение об ошибке в чат
        const errorMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: `Извините, произошла ошибка: ${err.message}`,
          timestamp: new Date(),
          isError: true
        };
        this.messages.push(errorMessage);
      } finally {
        this.loading = false;
      }
    },

    clearChat() {
      this.messages = [];
      this.error = '';
      this.statusMessage = 'Чат очищен';
      this.addWelcomeMessage();
    },

    addWelcomeMessage() {
      const welcomeMessage = {
        id: Date.now(),
        type: 'bot',
        content: 'Привет! Я Gigachat AI помощник. Чем могу вам помочь?',
        timestamp: new Date()
      };
      this.messages.push(welcomeMessage);
    },

    async checkHealth() {
      try {
        this.statusMessage = 'Проверка подключения...';
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.status === 'healthy') {
          this.statusMessage = 'Подключение установлено';
          if (this.messages.length === 0) {
            this.addWelcomeMessage();
          }
        } else {
          this.statusMessage = 'Проблемы с подключением';
        }
      } catch (err) {
        this.statusMessage = 'Сервер недоступен';
        this.error = 'Не удалось подключиться к серверу';
      }
    }
  },
  mounted() {
    this.checkHealth();
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.app-container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  overflow: hidden;
  min-height: 600px;
}

.app-header {
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: white;
  padding: 30px;
  text-align: center;
}

.header-content h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

.header-content p {
  opacity: 0.9;
  font-size: 1.1em;
}

.app-main {
  display: flex;
  flex-direction: column;
  height: 500px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
  color: #666;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

.clear-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 15px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.3s;
}

.clear-btn:hover {
  background: #c82333;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 10px 20px;
  text-align: center;
  border-bottom: 1px solid #ffcdd2;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Адаптивность */
@media (max-width: 768px) {
  #app {
    padding: 10px;
  }

  .app-header {
    padding: 20px;
  }

  .header-content h1 {
    font-size: 2em;
  }

  .status-bar {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}
</style>