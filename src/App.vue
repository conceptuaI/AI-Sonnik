<template>
  <div id="app">
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <h1>🌙 Интерпретатор снов</h1>
          <p>Расшифруйте свои сны с помощью AI</p>
        </div>

        <!-- Навигация и аутентификация -->
        <div class="auth-section">
          <div v-if="!isAuthenticated" class="auth-buttons">
            <button @click="showLoginForm = true" class="auth-btn login-btn">Войти</button>
            <button @click="showRegisterForm = true" class="auth-btn register-btn">Регистрация</button>
          </div>
          <div v-else class="user-info">
            <span>Привет, {{ currentUser?.username }}!</span>
            <button @click="logout" class="logout-btn">Выйти</button>
          </div>
        </div>
      </header>

      <main class="app-main">
        <!-- Статус бар -->
        <div class="status-bar">
          <span v-if="loading" class="loading-spinner"></span>
          <span>{{ statusMessage }}</span>
        </div>

        <!-- Сообщения об ошибках -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <!-- Формы аутентификации -->
        <div v-if="showLoginForm" class="auth-modal">
          <div class="modal-content">
            <h3>Вход в систему</h3>
            <form @submit.prevent="login">
              <input
                  v-model="loginData.phone"
                  @input="formatPhoneInput"
                  id="login-phone"
                  placeholder="Телефон"
                  required
                  class="form-input"
              >
              <input
                  v-model="loginData.password"
                  type="password"
                  placeholder="Пароль"
                  required
                  class="form-input"
              >
              <div class="modal-buttons">
                <button type="submit" class="btn-primary">Войти</button>
                <button type="button" @click="showLoginForm = false" class="btn-secondary">Отмена</button>
              </div>
            </form>
          </div>
        </div>

        <div v-if="showRegisterForm" class="auth-modal">
          <div class="modal-content">
            <h3>Регистрация</h3>
            <form @submit.prevent="register">
              <input
                  v-model="registerData.username"
                  placeholder="Имя пользователя"
                  required
                  class="form-input"
              >
              <input
                  v-model="registerData.phone"
                  @input="formatPhoneInput"
                  id="register-phone"
                  placeholder="Телефон"
                  required
                  class="form-input"
              >
              <input
                  v-model="registerData.password"
                  type="password"
                  placeholder="Пароль"
                  required
                  class="form-input"
              >
              <input
                  v-model="registerData.confirmPassword"
                  type="password"
                  placeholder="Подтверждение пароля"
                  required
                  class="form-input"
              >
              <div class="modal-buttons">
                <button type="submit" class="btn-primary">Зарегистрироваться</button>
                <button type="button" @click="showRegisterForm = false" class="btn-secondary">Отмена</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Основной контент -->
        <div v-if="isAuthenticated" class="main-content">
          <!-- Вкладки -->
          <div class="tabs">
            <button
                @click="activeTab = 'dreams'"
                :class="['tab-btn', { active: activeTab === 'dreams' }]"
            >
              Интерпретация снов
            </button>
            <button
                @click="activeTab = 'history'"
                :class="['tab-btn', { active: activeTab === 'history' }]"
            >
              История снов
            </button>
            <button
                @click="activeTab = 'audio'"
                :class="['tab-btn', { active: activeTab === 'audio' }]"
            >
              Аудио история
            </button>
          </div>

          <!-- Контент вкладок -->
          <div class="tab-content">
            <!-- Интерпретация снов -->
            <div v-if="activeTab === 'dreams'" class="dream-interpretation">
              <div class="input-section">
                <textarea
                    v-model="dreamInput"
                    placeholder="Опишите ваш сон здесь..."
                    class="dream-textarea"
                    :maxlength="2000"
                ></textarea>
                <div class="textarea-footer">
                  <span class="char-count">{{ dreamCharacterCount }}/2000</span>
                  <button @click="clearForm" class="clear-btn">Очистить</button>
                </div>
                <button
                    @click="interpretDream"
                    :disabled="!dreamInput.trim() || loading"
                    class="interpret-btn"
                >
                  {{ loading ? '🔮 Расшифровываю...' : '🔮 Расшифровать сон' }}
                </button>
              </div>

              <!-- Результат интерпретации -->
              <div v-if="hasResponse" class="interpretation-result">
                <div class="result-header">
                  <h3>Толкование сна</h3>
                  <div class="result-actions">
                    <button @click="copyToClipboard(lastResponse.interpretation)" class="action-btn">
                      📋 Копировать
                    </button>
                    <button @click="downloadText(lastResponse.interpretation, 'interpretation')" class="action-btn">
                      💾 Скачать
                    </button>
                    <button @click="clearResponse" class="action-btn">
                      🗑️ Очистить
                    </button>
                  </div>
                </div>
                <div class="interpretation-text" v-html="formatResponse(lastResponse.interpretation)"></div>

                <!-- Синтез речи -->
                <div class="speech-section">
                  <h4>Синтез речи</h4>
                  <div class="speech-input-group">
                    <textarea
                        v-model="textToSpeech"
                        placeholder="Текст для синтеза речи..."
                        class="speech-textarea"
                    ></textarea>
                    <div class="speech-buttons">
                      <button
                          @click="synthesizeFromInterpretation"
                          :disabled="!lastResponse.interpretation || speechLoading"
                          class="speech-btn"
                      >
                        🎵 Использовать толкование
                      </button>
                      <button
                          @click="synthesizeSpeech"
                          :disabled="!textToSpeech.trim() || speechLoading"
                          class="speech-btn primary"
                      >
                        {{ speechLoading ? '🔊 Синтезирую...' : '🔊 Синтезировать речь' }}
                      </button>
                    </div>
                  </div>

                  <!-- Аудио плеер -->
                  <div v-if="hasAudio" class="audio-player">
                    <button @click="playAudio" class="play-btn">
                      {{ isPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести' }}
                    </button>
                    <button @click="clearAudio" class="clear-audio-btn">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- История снов -->
            <div v-if="activeTab === 'history'" class="dream-history">
              <div v-if="userDreams.length === 0" class="empty-state">
                <p>У вас пока нет сохраненных снов</p>
              </div>
              <div v-else class="dreams-list">
                <div
                    v-for="dream in userDreams"
                    :key="dream.id"
                    class="dream-item"
                >
                  <div class="dream-header">
                    <span class="dream-date">{{ formatTime(dream.createdAt) }}</span>
                    <button @click="loadFromHistory(dream)" class="load-btn">
                      📥 Загрузить
                    </button>
                  </div>
                  <p class="dream-text">{{ truncateText(dream.dream, 150) }}</p>
                </div>
              </div>
            </div>

            <!-- Аудио история -->
            <div v-if="activeTab === 'audio'" class="audio-history">
              <div v-if="audioHistory.length === 0" class="empty-state">
                <p>У вас пока нет аудио записей</p>
              </div>
              <div v-else class="audio-list">
                <div
                    v-for="audio in audioHistory"
                    :key="audio.id"
                    class="audio-item"
                >
                  <div class="audio-info">
                    <span class="audio-date">{{ formatTime(audio.createdAt) }}</span>
                    <p class="audio-text">{{ truncateText(audio.text, 100) }}</p>
                  </div>
                  <button
                      @click="playAudioFromHistory(audio.audioUrl)"
                      class="play-history-btn"
                  >
                    ▶️ Воспроизвести
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Приветственный экран для неавторизованных пользователей -->
        <div v-else class="welcome-screen">
          <div class="welcome-content">
            <h2>Добро пожаловать в интерпретатор снов</h2>
            <p>Войдите или зарегистрируйтесь, чтобы начать расшифровывать свои сны</p>
            <div class="welcome-buttons">
              <button @click="showLoginForm = true" class="welcome-btn">Войти</button>
              <button @click="showRegisterForm = true" class="welcome-btn primary">Регистрироваться</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      // Данные из app.js будут внедрены через Vue 3 Composition API
    }
  },
  methods: {
    // Методы будут внедрены через Vue 3 Composition API
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
  max-width: 1000px;
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
  padding: 20px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  font-size: 2em;
  margin-bottom: 5px;
}

.header-content p {
  opacity: 0.9;
  font-size: 1em;
}

.auth-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.auth-buttons {
  display: flex;
  gap: 10px;
}

.auth-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.login-btn {
  background: transparent;
  border: 1px solid white;
  color: white;
}

.register-btn {
  background: white;
  color: #2c3e50;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logout-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}

.app-main {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.status-bar {
  display: flex;
  align-items: center;
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

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 10px 20px;
  text-align: center;
  border-bottom: 1px solid #ffcdd2;
}

.auth-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  width: 400px;
  max-width: 90%;
}

.modal-content h3 {
  margin-bottom: 20px;
  text-align: center;
}

.form-input {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.modal-buttons {
  display: flex;
  gap: 10px;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 5px;
  cursor: pointer;
  flex: 1;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 5px;
  cursor: pointer;
  flex: 1;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.tab-btn {
  flex: 1;
  padding: 15px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tab-btn.active {
  border-bottom-color: #667eea;
  background: white;
  color: #667eea;
}

.tab-content {
  flex: 1;
  padding: 20px;
}

.dream-interpretation {
  max-width: 800px;
  margin: 0 auto;
}

.dream-textarea {
  width: 100%;
  height: 150px;
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 10px;
}

.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.char-count {
  font-size: 12px;
  color: #666;
}

.clear-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 15px;
  cursor: pointer;
  font-size: 12px;
}

.interpret-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 15px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
}

.interpret-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.interpretation-result {
  margin-top: 30px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 20px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.result-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}

.interpretation-text {
  line-height: 1.6;
  margin-bottom: 20px;
}

.speech-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 20px;
}

.speech-section h4 {
  margin-bottom: 15px;
}

.speech-input-group {
  margin-bottom: 15px;
}

.speech-textarea {
  width: 100%;
  height: 100px;
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 10px;
}

.speech-buttons {
  display: flex;
  gap: 10px;
}

.speech-btn {
  flex: 1;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
}

.speech-btn.primary {
  background: #28a745;
  color: white;
  border: none;
}

.speech-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.audio-player {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
}

.clear-audio-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
}

.dream-history,
.audio-history {
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.dreams-list,
.audio-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.dream-item,
.audio-item {
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 15px;
}

.dream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.dream-date,
.audio-date {
  font-size: 12px;
  color: #666;
}

.load-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}

.dream-text {
  line-height: 1.4;
}

.audio-info {
  margin-bottom: 10px;
}

.audio-text {
  line-height: 1.4;
  color: #666;
}

.play-history-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}

.welcome-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  padding: 40px;
}

.welcome-content {
  text-align: center;
}

.welcome-content h2 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.welcome-content p {
  margin-bottom: 30px;
  color: #666;
  font-size: 16px;
}

.welcome-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.welcome-btn {
  padding: 12px 30px;
  border: 2px solid #667eea;
  background: transparent;
  color: #667eea;
  border-radius: 25px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
}

.welcome-btn.primary {
  background: #667eea;
  color: white;
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
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .tabs {
    flex-direction: column;
  }

  .speech-buttons {
    flex-direction: column;
  }

  .welcome-buttons {
    flex-direction: column;
  }

  .result-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .result-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>