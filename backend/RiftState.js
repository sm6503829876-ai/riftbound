const { Schema, type, ArraySchema, MapSchema } = require("@colyseus/schema");

// 1. 定义单张卡牌的数据结构
class Card extends Schema {
    constructor(data = {}) {
        super();
        this.id = data.id || Math.random().toString(36).substr(2, 9);
        this.name = data.name || "未知";
        this.type = data.type || "单位";
        this.cost = data.cost || "-";
        this.power = data.power || null;
        this.health = data.health || null;
        this.tapped = data.tapped || false; // 是否横置
        
        // 自由放置时的坐标 (百分比)
        this.x = data.x || 50; 
        this.y = data.y || 50;
    }
}

// 2. 定义单个玩家的数据结构
class Player extends Schema {
    constructor() {
        super();
        this.sessionId = ""; // 玩家的网络连接ID
        this.score = 0;      // 得分 (0-10)
        this.deck = 40;      // 主牌库剩余数量
        this.discard = 0;    // 废牌堆数量
        this.runeDeck = 12;  // 剩余可召出符文数
        
        // 玩家的各个区域
        this.hand = new ArraySchema();      // 手牌
        this.runes = new ArraySchema();     // 符文区 (包含12个槽位，用空卡或实体卡填充)
        this.baseUnits = new ArraySchema(); // 基地自由放置区
        
        this.legend = new Card({ type: "传奇" });   // 传奇卡 (这里给一个默认空实例，防止前端报错)
        this.champion = new Card({ type: "英雄" }); // 英雄卡
    }
}

// 3. 定义单个战场 (前线) 的数据结构
class Battlefield extends Schema {
    constructor() {
        super();
        this.fieldCard = new Card({ type: "战场" });  // 战场牌 (中间的横置卡)
        this.player1Units = new ArraySchema();        // 玩家1在战场的单位
        this.player2Units = new ArraySchema();        // 玩家2在战场的单位
    }
}

// 4. 定义整个房间(对战桌布)的全局状态
class RiftState extends Schema {
    constructor() {
        super();
        // 存储房间内的两名玩家 (Key 为 sessionId)
        this.players = new MapSchema();
        
        // 两个战场 (左和右)
        this.board = new ArraySchema(new Battlefield(), new Battlefield());
    }
}

// 暴露类型定义，以便后端处理网络同步
type("string")(Card.prototype, "id");
type("string")(Card.prototype, "name");
type("string")(Card.prototype, "type");
type("string")(Card.prototype, "cost");
type("number")(Card.prototype, "power");
type("number")(Card.prototype, "health");
type("boolean")(Card.prototype, "tapped");
type("number")(Card.prototype, "x");
type("number")(Card.prototype, "y");

type("string")(Player.prototype, "sessionId");
type("number")(Player.prototype, "score");
type("number")(Player.prototype, "deck");
type("number")(Player.prototype, "discard");
type("number")(Player.prototype, "runeDeck");
type([ Card ])(Player.prototype, "hand");
type([ Card ])(Player.prototype, "runes");
type([ Card ])(Player.prototype, "baseUnits");
type(Card)(Player.prototype, "legend");
type(Card)(Player.prototype, "champion");

type(Card)(Battlefield.prototype, "fieldCard");
type([ Card ])(Battlefield.prototype, "player1Units");
type([ Card ])(Battlefield.prototype, "player2Units");

type({ map: Player })(RiftState.prototype, "players");
type([ Battlefield ])(RiftState.prototype, "board");

module.exports = { Card, Player, Battlefield, RiftState };