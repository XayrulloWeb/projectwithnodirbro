const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));
app.use(express.json());

const objectLocations = {
    "urgench_filial": { lat: 41.5548, lon: 60.6313, name: 'Филиал ТАТУ — Ургенч', type: 'tech' }, // Добавим тип для красоты
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
        console.log(`[SERVER] Найден объект: ${locationInfo.name}. Отправка на карту...`);

        // !!! ИЗМЕНЕНИЕ ЗДЕСЬ !!!
        // Отправляем событие с именем 'new_signal', которое слушает наша карта
        io.emit('new_signal', {
            button_id,
            name: locationInfo.name,
            type: locationInfo.type || 'default', // Отправляем тип
            lat: locationInfo.lat,
            lon: locationInfo.lon,
        });

        res.status(200).send('OK');
    } else {
        console.log(`[SERVER] ВНИМАНИЕ! Неизвестный ID: ${button_id}`);
        res.status(404).send('Unknown button_id');
    }
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
