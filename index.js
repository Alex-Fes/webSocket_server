const express = require('express');
const cors = require('cors');


const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const {v4: uuidv4} = require('uuid');
const port = 3000


app.use(express.json())

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

const corsOptions = {
    origin: /^http:\/\/localhost:(30(0[0-9]|10))$/,
    credentials:true,
    optionSuccessStatus:200
};

app.use(cors(corsOptions));

app.options('*', cors());

const rooms = new Map();

app.get('/rooms/:id', (req, res) => {
    const roomName = req.params.id;

    if (rooms.has(roomName)) {
        const room = rooms.get(roomName);
        const users = room.get('users') ? [...room.get('users').values()] : [];
        const messages = room.get('messages') ? [...room.get('messages').values()] : [];

        const obj = {users, messages, roomName};
        res.json(obj);
    } else {
        res.json({users: [], messages: []});
    }
});

app.post('/rooms', (req, res) => {
    const {roomName} = req.body

    if (!rooms.has(roomName)) {
        rooms.set(roomName, new Map([
            ['users', new Map()],
            ['messages', []],
        ]));
    }
    res.json(rooms);
});

io.on('connection', (socket) => {
    socket.on('ROOM:JOIN', ({roomName, userName}) => {
        socket.join(roomName); // Подключаем пользователя к комнате с UUID

        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Map()); // Создаем новую комнату в объекте rooms, если она еще не существует
            rooms.get(roomName).set('users', new Map()); // Инициализируем объект users в комнате
        }

        rooms.get(roomName).get('users').set(socket.id, userName); // Добавляем пользователя в комнату с UUID

        const users = [...rooms.get(roomName).get('users').values()]; // Получаем список пользователей в комнате с UUID

        socket.to(roomName).emit('ROOM:JOINED', users); // Отправляем событие о подключении нового пользователя всем пользователям комнаты с UUID
        console.log('New user connected', socket.id)
    })

    socket.on('ROOM:ADD_NEW_MESSAGES', ({roomName, userName, text}) => {
        const messageId = uuidv4();
        const room = rooms.get(roomName);
        const userId = socket.id;


        if (room) {
            const messages = room.get('messages') || [];
            const newMessage = {messageId, userId, userName, text};

            messages.push(newMessage);
            room.set('messages', messages);

            socket.to(roomName).emit('ROOM:NEW_MESSAGES_ADDED', newMessage);
            socket.emit('ROOM:NEW_MESSAGES_ADDED', newMessage);
            console.log('New message added', newMessage)
        }
    })

    socket.on('disconnect', () => {
        rooms.forEach((value, roomName) => {
            if (value.get('users').delete(socket.id)) {
                const users = [...rooms.get(roomName).get('users').values()]; // Получаем список пользователей в комнате с UUID
                socket.broadcast.to(roomName).emit('ROOM:LEAVE_USER', users); // Отправляем событие о отключении пользователя всем пользователям комнаты с UUID
                console.log('User disconnected', socket.id)
            }
        })
    });
});


server.listen(port, (err) => {
    if (err) {
        throw Error('Something bad happened...');
    }
    console.log(`Server started on port ${port}`);
});

