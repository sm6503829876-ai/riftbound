# 符文战场 · 云端部署指南（Fly.io）

## 第一次部署（约 5 分钟）

### 1. 安装 flyctl
```bash
# macOS
brew install flyctl

# 或者用官方脚本
curl -L https://fly.io/install.sh | sh
```

### 2. 注册并登录（免费，不需要信用卡）
```bash
fly auth signup   # 新用户注册
# 或
fly auth login    # 已有账号
```

### 3. 修改应用名
打开 `fly.toml`，把第一行改成你自己的名字（全球唯一）：
```toml
app = "suming-riftbound"   # 随便起，只要没被人用
primary_region = "nrt"    # nrt=东京 | sin=新加坡 | hkg=香港
```

### 4. 初始化 + 部署
```bash
cd /Users/suming1/Desktop/riftbound

fly launch --no-deploy   # 第一次：读取 fly.toml，在云上创建应用
fly deploy               # 构建 Docker 镜像并部署（约 2~3 分钟）
```

### 5. 打开游戏
```bash
fly open
# 或者直接访问 https://你的应用名.fly.dev
```

---

## 之后每次更新代码

```bash
cd /Users/suming1/Desktop/riftbound
fly deploy
```

---

## 常用命令

```bash
fly status          # 查看运行状态
fly logs            # 查看实时日志
fly ssh console     # SSH 进入容器（调试用）
```

---

## 费用说明

Fly.io 免费层包含：
- 3 台 shared-cpu-1x（256MB）机器
- 每月 160 小时机器时间（1台常驻不超限）
- 出站流量 100GB/月

对两人测试游戏完全够用，**无需信用卡**即可开始。

---

## 本地测试（同一 WiFi 联机）

```bash
cd /Users/suming1/Desktop/riftbound/backend
node server.js
# 终端会打印局域网 IP，如 http://192.168.1.5:2567
# 朋友用手机浏览器访问这个地址即可
```
