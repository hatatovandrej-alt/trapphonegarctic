const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map(); // socketId -> roomId
    }

    createRoom(hostId, hostName, settings = {}) {
        const roomId = this.generateRoomCode();

        const room = {
            id: roomId,
            hostId,
            players: [{
                id: hostId,
                name: hostName,
                avatar: this.getRandomAvatar(),
                score: 0,
                achievements: []
            }],
            settings: {
                drawTime: settings.drawTime || 60,
                guessTime: settings.guessTime || 45,
                mode: settings.mode || 'classic',
                modifiers: settings.modifiers || false,
                maxPlayers: settings.maxPlayers || 10,
                rounds: settings.rounds || 1
            },
            state: 'lobby', // lobby, playing, revealing, finished
            chains: [],
            gallery: []
        };

        this.rooms.set(roomId, room);
        this.playerRooms.set(hostId, roomId);
        return room;
    }

    joinRoom(roomId, playerId, playerName) {
        const room = this.rooms.get(roomId);

        if (!room) return { error: 'Комната не найдена 😕' };
        if (room.state !== 'lobby') return { error: 'Игра уже идёт ⏳' };
        if (room.players.length >= room.settings.maxPlayers) return { error: 'Комната полная 😤' };
        if (room.players.find(p => p.name === playerName)) return { error: 'Имя уже занято 🙄' };

        room.players.push({
            id: playerId,
            name: playerName,
            avatar: this.getRandomAvatar(),
            score: 0,
            achievements: []
        });

        this.playerRooms.set(playerId, roomId);
        return { room };
    }

    removePlayer(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) return null;

        room.players = room.players.filter(p => p.id !== playerId);
        this.playerRooms.delete(playerId);

        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            return null;
        }

        // Передаём хоста
        if (room.hostId === playerId) {
            room.hostId = room.players[0].id;
        }

        return roomId;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getRoomByPlayer(playerId) {
        const roomId = this.playerRooms.get(playerId);
        return roomId ? this.rooms.get(roomId) : null;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        // Проверяем уникальность
        if (this.rooms.has(code)) return this.generateRoomCode();
        return code;
    }

    getRandomAvatar() {
        const avatars = ['🐱', '🐶', '🦊', '🐸', '🐧', '🦄', '🐼', '🐨', '🦁', '🐮',
            '🐷', '🐵', '🐔', '🦋', '🐙', '👽', '🤖', '👻', '🎃', '🦖'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }
}

module.exports = { RoomManager };