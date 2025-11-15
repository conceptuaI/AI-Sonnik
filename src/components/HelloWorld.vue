<template>
  <div class="hello-world">
    <div class="chat-container" ref="chatContainer">
      <div
          v-for="message in messages"
          :key="message.id"
          :class="[
          'message',
          message.type === 'user' ? 'user-message' : 'bot-message',
          { 'error-message': message.isError }
        ]"
      >
        <div class="message-content" v-html="formatMessage(message.content)"></div>
        <div class="message-timestamp">{{ formatTime(message.timestamp) }}</div>
      </div>

      <div v-if="loading" class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>Gigachat печатает...</span>
      </div>
    </div>

    <div class="input-section">
      <div class="input-container">
        <input
            v-model="userInput"
            @keyup.enter="handleSendMessage"
            placeholder="Введите ваше сообщение..."
            class="message-input"
            :disabled="loading"
        >
        <button
            @click="handleSendMessage"
            :disabled="!userInput.trim() || loading"
            class="send-button"
            :class="{ 'loading': loading }"
        >
          <span v-if="loading">⏳</span>
          <span v-else>📤</span>
          Отправить
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      userInput: ''
    }
  },
  methods: {
    handleSendMessage() {
      if (this.userInput.trim()) {
        this.$emit('send-message', this.userInput.trim());
        this.userInput = '';
      }
    },

    formatMessage(text) {
      if (!text) return '';
      return text
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>');
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  },
  watch: {
    messages: {
      handler() {

        this.$nextTick(() => {
          const container = this.$refs.chatContainer;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      },
      deep: true
    }
  }
}
</script>

<style scoped>
.hello-world {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.chat-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
  animation: fadeIn 0.3s ease-in;
}

.user-message {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.bot-message {
  background: white;
  color: #333;
  border: 1px solid #e0e0e0;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.message-content {
  line-height: 1.4;
}

.message-content :deep(strong) {
  font-weight: 600;
}

.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.user-message .message-content :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-timestamp {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 5px;
  text-align: right;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 18px;
  margin-right: auto;
  max-width: 150px;
  font-size: 14px;
  color: #666;
}

.typing-dots {
  display: flex;
  gap: 3px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #667eea;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

.input-section {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  background: white;
}

.input-container {
  display: flex;
  gap: 12px;
  align-items: center;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 25px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
}

.message-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.message-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.send-button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.send-button.loading {
  animation: pulse 1.5s infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Адаптивность */
@media (max-width: 768px) {
  .message {
    max-width: 85%;
  }

  .chat-container {
    padding: 15px;
  }

  .input-section {
    padding: 15px;
  }

  .input-container {
    flex-direction: column;
  }

  .send-button {
    width: 100%;
    justify-content: center;
  }
}
</style>