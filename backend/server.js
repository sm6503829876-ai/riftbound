const colyseus = require("colyseus");
const http = require("http");
const express = require("express");
const path = require("path");
const cors = require("cors");
const os = require("os");
const { RiftRoom } = require("./RiftRoom");

const port = process.env.PORT || 2567;
const app = express();

// 允许跨域请求
app.use(cors());
app.use(express.json());

// 本地提供浏览器端 Colyseus SDK，避免依赖外网 CDN
app.use("/colyseus-sdk", express.static(path.join(__dirname, "node_modules", "colyseus.js", "dist")));

// 静态文件服务（供局域网手机端访问 index.html、manifest.json、sw.js 等）
app.use(express.static(path.join(__dirname, "..")));

// 创建基础的 HTTP 服务器
const server = http.createServer(app);

// 实例化 Colyseus 游戏引擎
const gameServer = new colyseus.Server({
    server: server,
});

// 注册符文战场房间逻辑
gameServer.define("rift_battle", RiftRoom);

// 自定义房间列表接口（Colyseus 0.16 移除了客户端 getAvailableRooms）
const { matchMaker } = require("@colyseus/core");
app.get("/api/rooms", async (req, res) => {
    try {
        const rooms = await matchMaker.query({ name: "rift_battle" });
        res.json(rooms.map(r => ({
            roomId:   r.roomId,
            metadata: r.metadata,
            clients:  r.clients,
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 获取本机局域网 IP（方便手机访问）
const getLocalIP = () => {
    const nets = os.networkInterfaces();
    for (const ifaces of Object.values(nets)) {
        for (const iface of ifaces) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "localhost";
};

// 启动服务器
// 云端部署（Fly.io 等）必须绑定 0.0.0.0 才能接受外部流量
const host = process.env.FLY_APP_NAME ? "0.0.0.0" : undefined;
gameServer.listen(port, host);

if (process.env.FLY_APP_NAME) {
    console.log(`\n🚀 符文战场已在 Fly.io 启动！端口: ${port}`);
    console.log(`🌐 访问地址: https://${process.env.FLY_APP_NAME}.fly.dev\n`);
} else {
    console.log("\n🚀 符文战场后端服务器已启动！");
    console.log("📡 本机浏览器: http://localhost:" + port);
    console.log("📱 局域网手机: http://" + getLocalIP() + ":" + port + "\n");
}
