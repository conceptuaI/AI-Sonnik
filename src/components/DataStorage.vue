<template>
  <div class="container">
    <h2>Сохранение данных в Cookies и JSON файл</h2>

    <div class="input-group">
      <div class="input-row">
        <label>Имя:</label>
        <input
            v-model="userData.name"
            type="text"
            placeholder="Введите имя"
            class="input-field"
        />
      </div>

      <div class="input-row">
        <label>Email:</label>
        <input
            v-model="userData.email"
            type="email"
            placeholder="Введите email"
            class="input-field"
        />
      </div>

      <div class="input-row">
        <label>Телефон:</label>
        <input
            v-model="userData.phone"
            type="tel"
            placeholder="Введите телефон"
            class="input-field"
        />
      </div>

      <div class="input-row">
        <label>Комментарий:</label>
        <textarea
            v-model="userData.comment"
            placeholder="Введите комментарий"
            class="input-field textarea"
            rows="3"
        ></textarea>
      </div>
    </div>

    <div class="button-group">
      <button @click="saveAllData" class="btn btn-primary">
        💾 Сохранить в Cookies и Файл
      </button>
      <button @click="loadFromCookies" class="btn btn-secondary">
        📥 Загрузить из Cookies
      </button>
      <button @click="exportData" class="btn btn-export">
        📤 Экспорт в JSON
      </button>
      <button @click="clearAll" class="btn btn-danger">
        🗑️ Очистить всё
      </button>
    </div>

    <div class="data-display">
      <div class="data-section">
        <h3>📝 Текущие данные:</h3>
        <div class="data-content">
          <div v-for="(value, key) in userData" :key="key" class="data-item">
            <strong>{{ key }}:</strong> {{ value || 'Не заполнено' }}
          </div>
        </div>
      </div>

      <div class="data-section">
        <h3>🍪 Данные из Cookies:</h3>
        <div class="data-content">
          <div v-for="(value, key) in cookiesData" :key="key" class="data-item">
            <strong>{{ key }}:</strong> {{ value || 'Не найдено' }}
          </div>
        </div>
      </div>

      <div class="data-section">
        <h3>📁 Данные из файла:</h3>
        <div class="file-data-content">
          <div
              v-for="item in fileData"
              :key="item.id"
              class="file-data-item"
              @click="loadFileItem(item)"
          >
            <div class="file-item-header">
              <strong>{{ item.name || 'Без имени' }}</strong>
              <span class="timestamp">{{ formatDate(item.timestamp) }}</span>
            </div>
            <div class="file-item-details">
              <span v-if="item.email">📧 {{ item.email }}</span>
              <span v-if="item.phone">📞 {{ item.phone }}</span>
            </div>
          </div>
          <div v-if="fileData.length === 0" class="no-data">
            Нет сохраненных данных
          </div>
        </div>
      </div>
    </div>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script>
import Cookies from 'js-cookie'
import { saveDataToFile, readDataFromFile, exportDataToFile } from '@/utils/fileStorage'

export default {
  name: 'DataStorageApp',
  data() {
    return {
      userData: {
        name: '',
        email: '',
        phone: '',
        comment: ''
      },
      cookiesData: {},
      fileData: [],
      message: '',
      messageType: 'success'
    }
  },
  async mounted() {
    this.loadFromCookies()
    await this.loadFromFile()
  },
  methods: {
    async saveAllData() {
      try {
        // Проверка обязательных полей
        if (!this.userData.name.trim()) {
          this.showMessage('Пожалуйста, введите имя', 'error')
          return
        }

        // Сохранение в Cookies
        this.saveToCookies()

        // Сохранение в файл
        await this.saveToFile()

        this.showMessage('Данные успешно сохранены в cookies и файл!', 'success')

      } catch (error) {
        console.error('Ошибка сохранения:', error)
        this.showMessage('Ошибка при сохранении данных', 'error')
      }
    },

    saveToCookies() {
      try {
        // Сохраняем каждое поле отдельно
        Object.keys(this.userData).forEach(key => {
          if (this.userData[key]) {
            Cookies.set(`user_${key}`, this.userData[key], { expires: 30 })
          }
        })

        // Сохраняем весь объект как JSON
        Cookies.set('user_data_full', JSON.stringify(this.userData), { expires: 30 })

        this.loadFromCookies()
      } catch (error) {
        console.error('Ошибка сохранения в cookies:', error)
        throw error
      }
    },

    loadFromCookies() {
      try {
        const loadedData = {}

        // Загружаем отдельные поля
        Object.keys(this.userData).forEach(key => {
          loadedData[key] = Cookies.get(`user_${key}`) || 'Не найдено'
        })

        // Загружаем полный объект
        const fullDataJson = Cookies.get('user_data_full')
        if (fullDataJson) {
          loadedData.full = JSON.parse(fullDataJson)
        }

        this.cookiesData = loadedData
      } catch (error) {
        console.error('Ошибка загрузки из cookies:', error)
        this.cookiesData = { error: 'Ошибка загрузки' }
      }
    },

    async saveToFile() {
      try {
        await saveDataToFile(this.userData)
        await this.loadFromFile() // Обновляем список
      } catch (error) {
        console.error('Ошибка сохранения в файл:', error)
        throw error
      }
    },

    async loadFromFile() {
      try {
        this.fileData = await readDataFromFile()
      } catch (error) {
        console.error('Ошибка загрузки из файла:', error)
        this.fileData = []
      }
    },

    loadFileItem(item) {
      // Загружаем данные из выбранной записи файла в форму
      this.userData = { ...this.userData, ...item }
      this.showMessage(`Данные "${item.name}" загружены в форму`, 'success')
    },

    exportData() {
      if (this.fileData.length === 0) {
        this.showMessage('Нет данных для экспорта', 'error')
        return
      }

      exportDataToFile(this.fileData, `user-data-export-${new Date().getTime()}.json`)
      this.showMessage('Данные экспортированы в JSON файл', 'success')
    },

    clearAll() {
      // Очищаем поля ввода
      this.userData = {
        name: '',
        email: '',
        phone: '',
        comment: ''
      }

      // Удаляем cookies
      Object.keys(this.userData).forEach(key => {
        Cookies.remove(`user_${key}`)
      })
      Cookies.remove('user_data_full')

      // Очищаем отображение
      this.cookiesData = {}

      this.showMessage('Все данные очищены', 'success')
    },

    showMessage(text, type) {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
      }, 4000)
    },

    formatDate(timestamp) {
      if (!timestamp) return ''
      return new Date(timestamp).toLocaleString('ru-RU')
    }
  }
}
</script>

<style>

</style>