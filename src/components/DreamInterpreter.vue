<template>
  <div class="dream-interpreter">
    <!-- Форма ввода сна -->
    <section class="dream-section">
      <div class="section-header">
        <h2>📖 Опишите свой сон</h2>
        <p>Подробно опишите то, что вам приснилось, и ИИ расшифрует скрытый смысл</p>
      </div>

      <div class="input-group">
        <div class="textarea-container">
          <textarea
              v-model="localDreamInput"
              placeholder="Например: Мне приснилось, что я летаю над городом и вижу красивые разноцветные облака..."
              class="dream-textarea"
              :disabled="loading || isVoiceLoading"
              rows="6"
          ></textarea>
          <div class="textarea-footer">
            <span class="char-count">{{ dreamCharacterCount }}/5000</span>
          </div>
        </div>

        <!-- Кнопки голосового ввода -->
        <div class="voice-controls">
          <button
              @click="isRecording ? $emit('stopVoiceInput') : $emit('startVoiceInput')"
              :class="['voice-btn', { 'recording': isRecording, 'loading': isVoiceLoading }]"
              :disabled="isVoiceLoading"
          >
            <span v-if="isVoiceLoading" class="voice-loading"></span>
            <span v-else-if="isRecording">⏹️</span>
            <span v-else>🎤</span>
            {{ isRecording ? 'Остановить запись' : (isVoiceLoading ? 'Обработка...' : 'Голосовой ввод') }}
          </button>

          <div v-if="voiceInputText" class="voice-result">
            <strong>Распознано:</strong> {{ voiceInputText }}
          </div>
        </div>

        <div class="action-buttons">
          <button
              @click="$emit('interpretDream')"
              :disabled="!localDreamInput.trim() || loading || isVoiceLoading"
              class="interpret-btn"
          >
            <span v-if="loading">⏳</span>
            <span v-else>🔮</span>
            Расшифровать сон
          </button>
          <button @click="$emit('clearForm')" class="clear-btn">🗑️ Очистить</button>
        </div>
      </div>
    </section>

    <!-- Результат интерпретации -->
    <section v-if="lastResponse" class="result-section">
      <div class="section-header">
        <h2>✨ Толкование сна</h2>
        <div class="result-actions">
          <button @click="$emit('synthesizeFromInterpretation')" class="speech-btn">
            🔊 Озвучить
          </button>
          <button @click="$emit('copyToClipboard', lastResponse.interpretation)" class="copy-btn">
            📋 Копировать
          </button>
          <button @click="$emit('downloadText', lastResponse.interpretation, 'interpretation')" class="download-btn">
            💾 Скачать
          </button>
          <button @click="$emit('clearResponse')" class="clear-btn">🗑️ Очистить</button>
        </div>
      </div>

      <div class="interpretation-content">
        <div class="original-dream">
          <h4>Ваш сон:</h4>
          <p>{{ lastResponse.dream }}</p>
        </div>
        <div class="interpretation-text" v-html="formatResponse(lastResponse.interpretation)"></div>
        <div class="interpretation-meta">
          <small>Расшифровано: {{ formatTime(lastResponse.timestamp) }}</small>
        </div>
      </div>

      <!-- Аудио плеер -->
      <div v-if="audioUrl" class="audio-player">
        <h4>🔊 Аудио версия:</h4>
        <div class="player-controls">
          <button @click="$emit('playAudio')" class="play-btn">
            {{ isPlaying ? '⏸️' : '▶️' }} {{ isPlaying ? 'Пауза' : 'Воспроизвести' }}
          </button>
          <button @click="$emit('clearAudio')" class="clear-btn">🗑️</button>
        </div>
      </div>
    </section>

    <!-- История снов -->
    <section class="history-section">
      <div class="section-header">
        <h2>📚 История ваших снов</h2>
        <p>Ранее расшифрованные сны</p>
      </div>

      <div v-if="userDreams.length > 0" class="dreams-grid">
        <div
            v-for="dream in userDreams"
            :key="dream.id"
            class="dream-card"
            @click="$emit('loadFromHistory', dream)"
        >
          <div class="dream-preview">
            <h4>{{ truncateText(dream.dream, 100) }}</h4>
            <p class="interpretation-preview">{{ truncateText(dream.interpretation, 150) }}</p>
          </div>
          <div class="dream-meta">
            <small>{{ formatTime(new Date(dream.createdAt)) }}</small>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>У вас пока нет расшифрованных снов</p>
      </div>
    </section>

    <!-- История аудио -->
    <section class="audio-history-section">
      <div class="section-header">
        <h2>🎵 История аудио</h2>
        <p>Ранее созданные аудио версии</p>
      </div>

      <div v-if="audioHistory.length > 0" class="audio-grid">
        <div
            v-for="audio in audioHistory"
            :key="audio.id"
            class="audio-card"
        >
          <div class="audio-content">
            <p class="audio-text">{{ truncateText(audio.text, 100) }}</p>
            <button
                @click="$emit('playAudioFromHistory', audio.audioUrl)"
                class="play-audio-btn"
            >
              ▶️ Воспроизвести
            </button>
          </div>
          <div class="audio-meta">
            <small>{{ formatTime(new Date(audio.createdAt)) }}</small>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>У вас пока нет созданных аудио файлов</p>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'DreamInterpreter',
  props: {
    dreamInput: String,
    loading: Boolean,
    isRecording: Boolean,
    isVoiceLoading: Boolean,
    voiceInputText: String,
    lastResponse: Object,
    userDreams: Array,
    audioUrl: String,
    isPlaying: Boolean,
    audioHistory: Array
  },
  data() {
    return {
      localDreamInput: this.dreamInput
    }
  },
  computed: {
    dreamCharacterCount() {
      return this.localDreamInput.length
    }
  },
  watch: {
    dreamInput(newVal) {
      this.localDreamInput = newVal
    },
    localDreamInput(newVal) {
      this.$emit('update-dream-input', newVal)
    }
  },
  methods: {
    formatResponse(text) {
      if (!text) return ''
      return text
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/```([^`]+)```/g, '<pre>$1</pre>')
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    truncateText(text, length) {
      if (!text) return ''
      if (text.length <= length) return text
      return text.substring(0, length) + '...'
    }
  }
}
</script>

<style scoped>
.dream-interpreter {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Секции */
section {
  background: white;
  border-radius: 15px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.section-header {
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.section-header p {
  color: #666;
  font-size: 0.95rem;
}

/* Форма ввода сна */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.textarea-container {
  position: relative;
}

.dream-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
  transition: border-color 0.3s ease;
}

.dream-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dream-textarea:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.textarea-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.char-count {
  font-size: 0.8rem;
  color: #666;
}

/* Голосовое управление */
.voice-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.voice-btn {
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.voice-btn:not(.recording):not(.loading) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.voice-btn.recording {
  background: #ff4757;
  color: white;
  animation: pulse 1.5s infinite;
}

.voice-btn.loading {
  background: #ffa502;
  color: white;
}

.voice-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.voice-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.voice-loading {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.voice-result {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

/* Кнопки действий */
.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.interpret-btn, .clear-btn, .speech-btn, .copy-btn, .download-btn, .play-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.interpret-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.interpret-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.interpret-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-btn {
  background: #6c757d;
  color: white;
}

.clear-btn:hover {
  background: #5a6268;
}

.speech-btn {
  background: #20bf6b;
  color: white;
}

.copy-btn {
  background: #2d98da;
  color: white;
}

.download-btn {
  background: #8854d0;
  color: white;
}

.play-btn {
  background: #fd9644;
  color: white;
}

/* Результат интерпретации */
.result-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.interpretation-content {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
}

.original-dream {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.original-dream h4 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.interpretation-text {
  line-height: 1.6;
  font-size: 1.05rem;
}

.interpretation-text :deep(strong) {
  color: #2c3e50;
}

.interpretation-text :deep(em) {
  color: #666;
  font-style: italic;
}

.interpretation-text :deep(code) {
  background: #e9ecef;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.interpretation-meta {
  margin-top: 1rem;
  text-align: right;
  color: #666;
}

/* Аудио плеер */
.audio-player {
  margin-top: 1.5rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.player-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.5rem;
}

/* История снов и аудио */
.dreams-grid, .audio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.dream-card, .audio-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.dream-card:hover, .audio-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.dream-preview h4, .audio-content p {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.interpretation-preview {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.dream-meta, .audio-meta {
  margin-top: 0.5rem;
  text-align: right;
  color: #999;
  font-size: 0.8rem;
}

.play-audio-btn {
  background: #20bf6b;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

/* Анимации */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Адаптивность */
@media (max-width: 768px) {
  section {
    padding: 1.5rem;
  }

  .action-buttons, .result-actions {
    flex-direction: column;
  }

  .dreams-grid, .audio-grid {
    grid-template-columns: 1fr;
  }

  .voice-btn, .interpret-btn, .clear-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>