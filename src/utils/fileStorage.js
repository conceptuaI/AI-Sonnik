
const fs = require('fs').promises
const path = require('path')

// Путь к файлу с данными (в корне проекта)
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'saved-data.json')

// Создаем директорию если не существует
const ensureDataDirectory = async () => {
    const dataDir = path.dirname(DATA_FILE_PATH)
    try {
        await fs.access(dataDir)
    } catch {
        await fs.mkdir(dataDir, { recursive: true })
    }
}

// Чтение данных из файла
export const readDataFromFile = async () => {
    try {
        await ensureDataDirectory()
        const data = await fs.readFile(DATA_FILE_PATH, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        // Если файла нет, возвращаем пустой массив
        if (error.code === 'ENOENT') {
            return []
        }
        console.error('Ошибка чтения файла:', error)
        return []
    }
}

// Запись данных в файл
export const saveDataToFile = async (data) => {
    try {
        await ensureDataDirectory()

        // Читаем существующие данные
        const existingData = await readDataFromFile()

        // Добавляем новые данные с timestamp
        const newEntry = {
            ...data,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        }

        const updatedData = [...existingData, newEntry]

        // Сохраняем в файл
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(updatedData, null, 2))

        return newEntry
    } catch (error) {
        console.error('Ошибка записи в файл:', error)
        throw error
    }
}

// Экспорт данных в файл (для скачивания)
export const exportDataToFile = (data, filename = 'user-data.json') => {
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(dataBlob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
}