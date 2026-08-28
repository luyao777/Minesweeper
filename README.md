# 💥 卡通扫雷大冒险 · Cute Minesweeper

一个卡通可爱风格的扫雷小游戏，部署到 GitHub Pages 即可让访客在线游玩。
- 🌈 卡通配色 + 圆角格子 + 弹跳动画 + 五彩纸屑
- 🎯 **过关式闯关**：每过一关棋盘更大、雷更多，难度递增
- ⭐ **当前分数**实时显示，分数跨关累积
- 🏠 **本机最高分**（localStorage，开箱即用，无需后端）
- 🌍 **全球最高分 + Top 10 排行榜**（可选，配置 Firebase 后所有玩家共享）
- 📱 支持移动端（长按插旗 / 标记模式切换）

---

## 📁 项目结构

```
Minesweeper/
├── index.html              # 页面骨架
├── css/
│   └── style.css           # 卡通可爱样式
├── js/
│   ├── main.js             # 主入口：UI 与逻辑串联
│   ├── game.js             # 扫雷核心逻辑 + 难度递增
│   ├── leaderboard.js      # 排行榜（本机 + 全球 Firebase）
│   └── firebase-config.js  # Firebase 配置（默认占位，可选）
└── README.md               # 本说明文档
```

---

## 🚀 部署步骤（GitHub Pages）

### 第一步：把项目推送到 GitHub 仓库

1. 在 GitHub 新建一个仓库，例如 `minesweeper`。
2. 把本目录所有文件提交并推送：

```bash
cd Minesweeper
git init
git add .
git commit -m "feat: 卡通扫雷大冒险"
git branch -M main
git remote add origin https://github.com/<你的用户名>/minesweeper.git
git push -u origin main
```

### 第二步：开启 GitHub Pages

1. 打开仓库页面 → **Settings（设置）** → 左侧 **Pages**。
2. **Source** 选择 `Deploy from a branch`。
3. **Branch** 选择 `main`，文件夹选择 `/ (root)`，点击 **Save**。
4. 等待 1~2 分钟，页面顶部会出现站点地址：

```
https://<你的用户名>.github.io/minesweeper/
```

打开即可游玩！🎉

> **提示**：若希望站点直接在 `https://<你的用户名>.github.io/` 根路径访问，需把仓库命名为 `<你的用户名>.github.io`。

### 第三步（可选）：启用「全球最高分 / 排行榜」

默认情况下，「全球最高分」会显示 `—`，排行榜只展示本机记录。
要让**所有访客共享**全球最高分与 Top 10，请按以下步骤配置免费 Firebase 后端：

1. 打开 [Firebase 控制台](https://console.firebase.google.com/)，登录 Google 账号 → **添加项目**（任意名称，可关闭 Google Analytics）。
2. 进入项目 → 左侧 **Build → Realtime Database（实时数据库）** → **创建数据库** → 选择区域 → **以测试模式启动**。
3. 设置公开读写规则（用于公开游戏榜单，**注意：任何人都能读写此榜单**）：
   - 进入 Realtime Database → **规则** 标签，粘贴：
   ```json
   {
     "rules": {
       "scores": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   - 点击 **发布**。
4. 注册 Web 应用并获取配置：
   - 项目设置（齿轮）→ **项目设置** → 「常规」标签页底部「您的应用」→ 点击 `</>` 添加 Web 应用。
   - 注册后复制 SDK 配置中的 `apiKey / authDomain / databaseURL / projectId / storageBucket / messagingSenderId / appId`。
5. 打开本项目的 `js/firebase-config.js`，把占位值替换为你刚复制的真实值并保存：

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...你的值",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```

6. 提交并推送：

```bash
git add js/firebase-config.js
git commit -m "feat: 启用 Firebase 全球排行榜"
git push
```

7. GitHub Pages 自动重新部署后，刷新页面——右上角会出现「🌍 全球排行榜已启用」提示，「全球最高分」与排行榜即会显示所有玩家的成绩。

> ⚠️ 安全说明：上述公开读写规则适合演示型小游戏。若担心被恶意刷分，可改用 Firebase 身份验证 + 服务端校验，或限制每日写入频率。

---

## 🎮 玩法

- **左键**点开格子，**右键**（移动端：长按或开启「标记模式」）插旗标记炸弹。
- 数字代表周围 8 格的炸弹数量。
- 点开所有非炸弹格子即过关，分数累积进入下一关。
- 踩到炸弹游戏结束，本局累计分数计入排行榜。
- 用时越短，过关时间奖励越高。

### 计分规则
| 行为 | 得分 |
|------|------|
| 翻开一个安全格 | +10 |
| 过关关卡奖励 | +关卡 × 100 |
| 过关用时奖励 | 越快越多（最高约 + (30+关卡×4)×5） |

### 难度递增
- 第 N 关棋盘边长 = `min(8+N, 18)`，雷密度 = `min(10% + N×1.3%, 26%)`。
- 关卡越高，棋盘越大、雷越密。

---

## 🛠 本地预览

无需构建，直接用任意静态服务器即可：

```bash
# 任选其一
python3 -m http.server 8080
# 或
npx serve .
```

浏览器打开 `http://localhost:8080` 即可。

> 注意：本地直接双击 `index.html` 打开（`file://`）时，ES 模块可能被浏览器安全策略拦截，建议使用上述静态服务器预览。

---

## ❓ 常见问题

**Q：不配置 Firebase 能用吗？**
能。游戏本体完全可用，「本机最高分」与本机排行榜照常工作；仅「全球最高分」显示 `—`。

**Q：为什么我的全球分数没显示？**
检查 `js/firebase-config.js` 是否已填真实值、`databaseURL` 是否正确、数据库规则是否已发布。

**Q：可以不用 Firebase 改用别的后端吗？**
可以。`js/leaderboard.js` 已把存储逻辑集中封装，替换其中的 Firebase 调用为你的接口即可。

---

用 ❤️ 制作，部署于 GitHub Pages。
