const colyseus = require('colyseus');

class RiftRoom extends colyseus.Room {
    onCreate(options) {
        this.maxClients = 8;
        this.setState({});

        this.seats = [null, null];
        this.spectatorMap = new Map();

        // 用 _roomName 存储，避免覆盖 Colyseus 只读属性 roomName
        this._roomName = options.name || `战场 ${this.roomId.slice(0, 4).toUpperCase()}`;
        this._password = options.password || null;
        this._updateMeta(this._roomName);

        console.log(`\n⚔️  新房间创建: [${this.roomId}] "${this._roomName}"`);

        // ── 声明角色（加入房间后发送）──────────────────────────────
        this.onMessage("claimSeat", (client, { nickname, role }) => {
            // 防止重复 claimSeat：已有座位或已是观战者则忽略
            if (this._seat(client.sessionId) >= 0 || this.spectatorMap.has(client.sessionId)) return;

            const availableSeat = this.seats.findIndex(s => !s);
            if (role === 'player' && availableSeat !== -1) {
                this.seats[availableSeat] = { sessionId: client.sessionId, nickname };
                client.send("roleAssigned", { role: 'player', seatIndex: availableSeat, nickname });
                console.log(`[${this.roomId}] 🪑 ${nickname} 坐下 → 座位${availableSeat}`);
            } else {
                this.spectatorMap.set(client.sessionId, nickname);
                client.send("roleAssigned", { role: 'spectator', nickname });
                if (role === 'player') {
                    client.send("seatFull", { message: '座位已满，已自动切换为观战模式' });
                }
                console.log(`[${this.roomId}] 👁  ${nickname} 观战`);
            }
            this._updateMeta();
            this._broadcastRoster();
            this.seats.forEach(seat => {
                if (seat) {
                    const c = this.clients.find(cl => cl.sessionId === seat.sessionId);
                    if (c) c.send("requestFullSync", { forSession: client.sessionId });
                }
            });
        });

        // ── 游戏内切换角色 ──────────────────────────────────────────
        this.onMessage("switchRole", (client, { nickname, newRole }) => {
            // 防抖：500ms 内同一客户端不能重复切换
            const now = Date.now();
            if (client._lastSwitch && now - client._lastSwitch < 500) return;
            client._lastSwitch = now;

            const currentSeat = this._seat(client.sessionId);
            const isSpectator = this.spectatorMap.has(client.sessionId);

            if (newRole === 'spectator' && currentSeat >= 0) {
                // 玩家 → 观战
                this.seats[currentSeat] = null;
                this.spectatorMap.set(client.sessionId, nickname);
                client.send("roleAssigned", { role: 'spectator', nickname });
                console.log(`[${this.roomId}] 🔄 ${nickname} 起立 → 观战`);

            } else if (newRole === 'player' && isSpectator) {
                // 观战 → 玩家
                const availableSeat = this.seats.findIndex(s => !s);
                if (availableSeat !== -1) {
                    this.spectatorMap.delete(client.sessionId);
                    this.seats[availableSeat] = { sessionId: client.sessionId, nickname };
                    client.send("roleAssigned", { role: 'player', seatIndex: availableSeat, nickname });
                    console.log(`[${this.roomId}] 🔄 ${nickname} 坐下 → 座位${availableSeat}`);
                    // 通知其他玩家发送全量同步
                    this.seats.forEach(seat => {
                        if (seat && seat.sessionId !== client.sessionId) {
                            const c = this.clients.find(cl => cl.sessionId === seat.sessionId);
                            if (c) c.send("requestFullSync", { forSession: client.sessionId });
                        }
                    });
                } else {
                    client.send("seatFull", { message: '座位已满，无法坐下' });
                }
            }
            this._updateMeta();
            this._broadcastRoster();
        });

        // ── 游戏消息（带 senderSeat）────────────────────────────────
        this.onMessage("moveCard", (client, msg) => {
            this.broadcast("cardMoved",
                { senderSeat: this._seat(client.sessionId), ...msg },
                { except: client });
        });

        this.onMessage("tapCard", (client, msg) => {
            this.broadcast("cardTapped",
                { senderSeat: this._seat(client.sessionId), ...msg },
                { except: client });
        });

        this.onMessage("gameAction", (client, msg) => {
            this.broadcast("remoteAction",
                { senderSeat: this._seat(client.sessionId), ...msg },
                { except: client });
        });

        // ── 全量同步 ────────────────────────────────────────────────
        this.onMessage("fullSyncData", (client, msg) => {
            const senderSeat = this._seat(client.sessionId);
            if (msg.forSession) {
                const target = this.clients.find(c => c.sessionId === msg.forSession);
                if (target) target.send("applyFullSync", { senderSeat, ...msg });
            } else {
                this.broadcast("applyFullSync", { senderSeat, ...msg }, { except: client });
            }
        });
    }

    // ── 密码验证 ──────────────────────────────────────────────────
    async onAuth(client, options) {
        if (this._password && options.password !== this._password) {
            throw new Error("密码错误，无法进入房间");
        }
        return true;
    }

    // ── 工具方法 ──────────────────────────────────────────────────
    _seat(sessionId) {
        return this.seats.findIndex(s => s?.sessionId === sessionId);
    }

    _updateMeta(overrideName) {
        this.setMetadata({
            roomName:          overrideName || this._roomName,
            seats:             this.seats.map(s => s?.nickname || null),
            spectatorCount:    this.spectatorMap.size,
            status:            this.seats.filter(Boolean).length === 2 ? 'playing' : 'waiting',
            passwordProtected: !!this._password,
        });
    }

    _broadcastRoster() {
        this.broadcast("rosterUpdate", {
            seats:       this.seats.map(s => s ? { nickname: s.nickname, sessionId: s.sessionId } : null),
            spectators:  [...this.spectatorMap.entries()].map(([id, name]) => ({ sessionId: id, nickname: name })),
            playerCount: this.seats.filter(Boolean).length,
        });
    }

    // ── 生命周期 ──────────────────────────────────────────────────
    onJoin(client, options) {
        console.log(`[${this.roomId}] 👉 ${client.sessionId.slice(0, 6)} 连入 (共 ${this.clients.length} 人)`);
    }

    async onLeave(client, consented) {
        const si = this._seat(client.sessionId);
        console.log(`[${this.roomId}] 🚪 ${client.sessionId.slice(0, 6)} 离开 consented=${consented}`);

        if (!consented) {
            // 意外断开 → 保留席位最多 30 秒等待重连
            console.log(`[${this.roomId}] ⏳ 等待重连: ${client.sessionId.slice(0, 6)}…`);
            try {
                await this.allowReconnection(client, 30);
                // 重连成功：通知在线玩家发送全量同步
                console.log(`[${this.roomId}] ✅ 重连成功: ${client.sessionId.slice(0, 6)}`);
                this.seats.forEach(seat => {
                    if (seat && seat.sessionId !== client.sessionId) {
                        const c = this.clients.find(cl => cl.sessionId === seat.sessionId);
                        if (c) c.send("requestFullSync", { forSession: client.sessionId });
                    }
                });
                this._broadcastRoster();
                return; // 重连成功，不清除席位
            } catch (e) {
                console.log(`[${this.roomId}] ❌ 重连超时: ${client.sessionId.slice(0, 6)}`);
            }
        }

        // 正常离开或重连超时 → 清除席位
        if (si >= 0) this.seats[si] = null;
        this.spectatorMap.delete(client.sessionId);
        console.log(`[${this.roomId}] 👥 剩余 ${this.clients.length} 人`);
        this._updateMeta();
        this._broadcastRoster();
    }

    onDispose() {
        console.log(`[${this.roomId}] 💥 房间销毁\n`);
    }
}

module.exports = { RiftRoom };
