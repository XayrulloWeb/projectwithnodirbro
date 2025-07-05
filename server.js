const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public')); // Убедитесь, что ваш index.html лежит в папке 'public'
app.use(express.json());

const DB_FILE = './signal_log.json';

let signalHistory = [];
try {
    if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE);
        // Проверка на пустой файл, чтобы избежать ошибки JSON.parse
        signalHistory = data.length > 0 ? JSON.parse(data) : [];
        console.log(`[OK] Загружено ${signalHistory.length} сигналов из истории.`);
    } else {
        fs.writeFileSync(DB_FILE, '[]');
        console.log(`[INFO] Файл ${DB_FILE} не найден, создан новый.`);
    }
} catch (err) {
    console.error('[ERROR] Ошибка чтения/парсинга файла истории:', err);
}

const objectLocations = {
    "urgench_filial": { lat: 41.5548, lon: 60.6313, name: 'Филиал ТАТУ — Ургенч', type: 'tech' },
    "charvak_ges_sos": { lat: 41.5668, lon: 69.8821, name: 'Чарвакская ГЭС', type: 'sos' },
};

app.post('/signal', (req, res) => {
    const { button_id } = req.body;
    if (!button_id) {
        return res.status(400).send('Bad Request: button_id is required');
    }

    console.log(`[SERVER] Получен сигнал от ID: ${button_id}`);
    const locationInfo = objectLocations[button_id];

    if (locationInfo) {
        const newSignal = {
            id: button_id + '_' + Date.now(),
            button_id,
            name: locationInfo.name,
            type: locationInfo.type || 'default',
            lat: locationInfo.lat,
            lon: locationInfo.lon,
            timestamp: new Date()
        };

        signalHistory.push(newSignal);
        fs.writeFile(DB_FILE, JSON.stringify(signalHistory, null, 2), (err) => {
            if (err) console.error('[ERROR] Не удалось сохранить сигнал в файл:', err);
        });

        io.emit('new_signal', newSignal);
        res.status(200).send('OK');
    } else {
        console.log(`[SERVER] ВНИМАНИЕ! Неизвестный ID: ${button_id}`);
        res.status(404).send('Unknown button_id');
    }
});

io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Новый клиент подключен: ${socket.id}`);

    // Отправляем историю при подключении
    socket.emit('load_history', signalHistory);

    // --- НОВОЕ: Обработчик для очистки истории ---
    socket.on('clear_history', () => {
        console.log(`[SOCKET.IO] Клиент ${socket.id} инициировал очистку истории.`);

        // 1. Очищаем историю в памяти сервера
        signalHistory = [];

        // 2. Перезаписываем файл-базу данных пустым массивом
        fs.writeFile(DB_FILE, '[]', (err) => {
            if (err) {
                console.error('[ERROR] Не удалось очистить файл истории:', err);
            } else {
                console.log('[OK] Файл истории успешно очищен.');
            }
        });

        // 3. Отправляем команду на очистку интерфейса ВСЕМ подключенным клиентам
        io.emit('history_cleared');
    });
    // --- КОНЕЦ НОВОГО ОБРАБОТЧИКА ---

    socket.on('disconnect', () => {
        console.log(`[SOCKET.IO] Клиент отключился: ${socket.id}`);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
