<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ type === 'login' ? 'Вход в систему' : 'Регистрация' }}</h3>
        <button @click="$emit('close')" class="close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group" v-if="type === 'register'">
          <label>Имя пользователя:</label>
          <input
              type="text"
              v-model="localFormData.username"
              placeholder="Придумайте имя пользователя"
          >
        </div>
        <div class="form-group">
          <label>Номер телефона:</label>
          <input
              type="tel"
              v-model="localFormData.phone"
              @input="formatPhoneInput"
              placeholder="+7 (XXX) XXX-XX-XX"
              :id="`${type}-phone`"
          >
        </div>
        <div class="form-group">
          <label>Пароль:</label>
          <input
              type="password"
              v-model="localFormData.password"
              :placeholder="type === 'login' ? 'Введите ваш пароль' : 'Не менее 6 символов'"
          >
        </div>
        <div class="form-group" v-if="type === 'register'">
          <label>Подтверждение пароля:</label>
          <input
              type="password"
              v-model="localFormData.confirmPassword"
              placeholder="Повторите пароль"
          >
        </div>
        <button @click="$emit('submit')" class="submit-btn">
          {{ type === 'login' ? 'Войти' : 'Зарегистрироваться' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuthModal',
  props: {
    type: {
      type: String,
      default: 'login'
    },
    formData: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      localFormData: { ...this.formData }
    }
  },
  watch: {
    formData: {
      handler(newVal) {
        this.localFormData = { ...newVal }
      },
      deep: true
    },
    localFormData: {
      handler(newVal) {
        this.$emit('update-form-data', newVal)
      },
      deep: true
    }
  },
  methods: {
    formatPhoneInput(event) {
      let input = event.target.value.replace(/\D/g, '')

      if (input.startsWith('7') || input.startsWith('8')) {
        input = input.substring(1)
      }

      if (input.length > 0) {
        let formatted = '+7 ('

        if (input.length > 0) {
          formatted += input.substring(0, 3)
        }
        if (input.length > 3) {
          formatted += ') ' + input.substring(3, 6)
        }
        if (input.length > 6) {
          formatted += '-' + input.substring(6, 8)
        }
        if (input.length > 8) {
          formatted += '-' + input.substring(8, 10)
        }

        this.localFormData.phone = formatted
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal {
  background: white;
  border-radius: 15px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  font-weight: 600;
  color: #2c3e50;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }
}
</style>