/**
 * 主入口：把扫雷逻辑、UI 与排行榜串联起来。
 */

import { Minesweeper, levelConfig } from "./game.js";
import {
  preloadBackend,
  isGlobalEnabled,
  getLocalBest,
  getGlobalBest,
  getPlayerName,
  setPlayerName,
  submitScore,
  getLeaderboard,
} from "./leaderboard.js";

/* ============ DOM ============ */
const $ = (id) => document.getElementById(id);
const boardEl = $("board");
const overlayEl = $("overlay");
const overlayEmoji = $("overlayEmoji");
const overlayTitle = $("overlayTitle");
const overlayMsg = $("overlayMsg");
const overlayBtn = $("overlayBtn");
const levelEl = $("level");
const scoreEl = $("score");
const minesEl = $("minesLeft");
const timerEl = $("timer");
const localBestEl = $("localBest");
const globalBestEl = $("globalBest");
const nameInput = $("playerName");
const restartBtn = $("restartBtn");
const helpBtn = $("helpBtn");
const flagModeBtn = $("flagModeBtn");
const rankBtn = $("rankBtn");
const rankModal = $("rankModal");
const helpModal = $("helpModal");
const rankList = $("rankList");
const rankHint = $("rankHint");
const toastEl = $("toast");

/* ============ 状态 ============ */
let level = 1;
let totalScore = 0;
let game = null;
let cellEls = []; // 二维数组缓存
let flagMode = false;
let timerStart = 0;
let timerId = null;
let levelElapsed = 0; // 当前关已用秒数
let busy = false; // 防止过关动画期间重复点击

/* ============ 工具 ============ */
function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}

function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth; // 触发重绘
  el.classList.add("bump");
}

function fmtTime(s) {
  return s + "s";
}

/* ============ 计时器 ============ */
function startTimer() {
  stopTimer();
  timerStart = Date.now();
  levelElapsed = 0;
  timerEl.textContent = "0s";
  timerId = setInterval(() => {
    levelElapsed = Math.floor((Date.now() - timerStart) / 1000);
    timerEl.textContent = fmtTime(levelElapsed);
  }, 250);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

/* ============ 棋盘渲染 ============ */
function computeCellSize(cols) {
  // 适配屏幕宽度，最大 40px，最小 24px
  const maxBoardW = Math.min(window.innerWidth - 60, 680);
  const byWidth = Math.floor((maxBoardW - 20 - (cols - 1) * 3) / cols);
  return Math.max(24, Math.min(40, byWidth));
}

function buildBoard() {
  const { rows, cols, mines } = levelConfig(level);
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
  const cellSize = computeCellSize(cols);
  boardEl.style.setProperty("--cell", cellSize + "px");

  cellEls = [];
  game = new Minesweeper({ rows, cols, mines, onChange: render });

  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < cols; c++) {
      const btn = document.createElement("button");
      btn.className = "cell";
      btn.type = "button";
      btn.dataset.r = r;
      btn.dataset.c = c;
      btn.setAttribute("aria-label", `格子 ${r + 1}-${c + 1}`);
      boardEl.appendChild(btn);
      rowArr.push(btn);
    }
    cellEls.push(rowArr);
  }

  minesEl.textContent = game.minesLeft();
  startTimer();
  hideOverlay();
}

function render(state) {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const el = cellEls[r][c];
      const val = state.board[r][c];
      const isOpen = state.revealed[r][c];
      const isFlag = state.flagged[r][c];

      el.className = "cell";
      el.textContent = "";

      if (isOpen) {
        el.classList.add("open");
        if (val === -1) {
          el.classList.add("mine");
          if (game.lastMine && game.lastMine[0] === r && game.lastMine[1] === c) {
            el.classList.add("exploded");
          }
          el.textContent = "💣";
        } else if (val > 0) {
          el.textContent = val;
          el.classList.add("n" + val);
        }
      } else if (isFlag) {
        el.classList.add("flag");
        el.textContent = "🚩";
      }
    }
  }
  minesEl.textContent = state.minesLeft;
}

/* ============ 交互 ============ */
function onCellClick(r, c) {
  if (busy || !game || game.gameOver || game.won) return;
  if (flagMode) {
    game.toggleFlag(r, c);
    return;
  }
  const result = game.reveal(r, c);
  if (result === "reveal") {
    addScore(10);
  } else if (result === "win") {
    handleWin();
  } else if (result === "lose") {
    handleLose(r, c);
  }
}

function onCellRightClick(r, c, e) {
  e.preventDefault();
  if (busy || !game || game.gameOver || game.won) return;
  game.toggleFlag(r, c);
}

boardEl.addEventListener("click", (e) => {
  const t = e.target.closest(".cell");
  if (!t) return;
  onCellClick(+t.dataset.r, +t.dataset.c);
});

boardEl.addEventListener("contextmenu", (e) => {
  const t = e.target.closest(".cell");
  if (!t) return;
  onCellRightClick(+t.dataset.r, +t.dataset.c, e);
});

// 长按标记（移动端）
let longPressTimer = null;
boardEl.addEventListener("touchstart", (e) => {
  const t = e.target.closest(".cell");
  if (!t) return;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    onCellRightClick(+t.dataset.r, +t.dataset.c, { preventDefault: () => {} });
  }, 380);
}, { passive: true });
boardEl.addEventListener("touchend", () => {
  if (longPressTimer) clearTimeout(longPressTimer);
});
boardEl.addEventListener("touchmove", () => {
  if (longPressTimer) clearTimeout(longPressTimer);
}, { passive: true });

/* ============ 计分 / 过关 / 失败 ============ */
function addScore(n) {
  totalScore += n;
  scoreEl.textContent = totalScore;
  bump(scoreEl);
}

function timeBonus() {
  // 30s 内完成有奖励，越快越多
  const ref = 30 + level * 4;
  return Math.max(0, Math.floor((ref - levelElapsed) * 5));
}

async function handleWin() {
  busy = true;
  stopTimer();
  const levelBonus = level * 100;
  const tb = timeBonus();
  addScore(levelBonus);
  addScore(tb);
  confetti();
  showOverlay("🎉", `第 ${level} 关过关！`, `+关卡${levelBonus} · +用时奖励${tb} · 进入第 ${level + 1} 关`, "下一关 ▶");
  // 立即绑定按钮，避免同步期间空点
  overlayBtn.onclick = () => {
    level++;
    levelEl.textContent = level;
    bump(levelEl);
    buildBoard();
    busy = false;
  };
  // 后台同步分数（中途成绩）并刷新记录
  submitScore(getPlayerName(), totalScore, level).then(refreshRecords).catch(() => {});
}

async function handleLose(r, c) {
  busy = true;
  stopTimer();
  game.revealAllMines();
  game.wrongFlags().forEach(([wr, wc]) => cellEls[wr][wc].classList.add("wrong"));
  render({ ...game, rows: game.rows, cols: game.cols, board: game.board, revealed: game.revealed, flagged: game.flagged, minesLeft: game.minesLeft() });
  boardEl.classList.add("shake");
  setTimeout(() => boardEl.classList.remove("shake"), 500);

  let msg = `本局得分 ${totalScore}，到达第 ${level} 关。`;
  showOverlay("💥", "踩到炸弹啦！", msg, "再来一局 🔄");
  overlayBtn.onclick = () => {
    restartFromLevel1();
    busy = false;
  };
  const { best, global } = await submitScore(getPlayerName(), totalScore, level).catch(() => ({ best: false, global: false }));
  refreshRecords();
  if (best) msg = "🏆 刷新本机最高分！" + msg;
  if (global) msg += " 已同步至全球榜～";
  overlayMsg.textContent = msg;
}

function showOverlay(emoji, title, msg, btnText) {
  overlayEmoji.textContent = emoji;
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayBtn.textContent = btnText;
  overlayEl.classList.remove("hidden");
}
function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function restartFromLevel1() {
  level = 1;
  totalScore = 0;
  levelEl.textContent = level;
  scoreEl.textContent = totalScore;
  buildBoard();
}

/* ============ 控制按钮 ============ */
restartBtn.addEventListener("click", () => {
  if (game && !game.gameOver && !game.won && totalScore > 0) {
    // 进行中重新开始 = 放弃本局
    if (!confirm("确定要放弃本局重新开始吗？")) return;
  }
  restartFromLevel1();
});

flagModeBtn.addEventListener("click", () => {
  flagMode = !flagMode;
  flagModeBtn.classList.toggle("on", flagMode);
  flagModeBtn.textContent = `🚩 标记模式：${flagMode ? "开" : "关"}`;
});

helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
rankBtn.addEventListener("click", openRank);

document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => {
    rankModal.classList.add("hidden");
    helpModal.classList.add("hidden");
  })
);
[rankModal, helpModal].forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.add("hidden");
  })
);

async function openRank() {
  rankList.innerHTML = '<li style="justify-content:center">加载中…</li>';
  rankModal.classList.remove("hidden");
  const { local, list } = await getLeaderboard(getPlayerName());
  rankHint.textContent = local
    ? "当前为本机榜单 · 配置 Firebase 后可全球同步"
    : "全球 Top 10 高手榜 🌍";
  if (!list.length) {
    rankList.innerHTML = '<li style="justify-content:center">还没有记录，快来抢占第一名！</li>';
    return;
  }
  const me = getPlayerName();
  rankList.innerHTML = list
    .map((e, i) => {
      const isMe = e.name === me;
      return `<li class="${i === 0 ? "first" : ""} ${isMe ? "me" : ""}">
        <span class="rk-name">${escapeHtml(e.name)}</span>
        <span class="rk-lv">Lv.${e.level}</span>
        <span class="rk-score">${e.score}</span>
      </li>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============ 昵称 ============ */
nameInput.value = getPlayerName();
nameInput.addEventListener("change", () => {
  setPlayerName(nameInput.value);
  toast("昵称已保存：" + getPlayerName());
});
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") nameInput.blur();
});

/* ============ 记录刷新 ============ */
async function refreshRecords() {
  localBestEl.textContent = getLocalBest();
  const gBest = await getGlobalBest();
  globalBestEl.textContent = gBest ? gBest.score : "—";
}

/* ============ 五彩纸屑 ============ */
function confetti() {
  const colors = ["#ff7eb3", "#7ed957", "#ffd166", "#4d9de0", "#845ec2", "#ff8e6e"];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "confetti";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    p.style.animationDelay = Math.random() * 0.3 + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    if (Math.random() > 0.5) p.style.borderRadius = "50%";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3500);
  }
}

/* ============ 窗口缩放重排 ============ */
let resizeTimer = null;
window.addEventListener("resize", () => {
  if (!game) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const size = computeCellSize(levelConfig(level).cols);
    boardEl.style.setProperty("--cell", size + "px");
  }, 150);
});

/* ============ 启动 ============ */
(async function init() {
  localBestEl.textContent = getLocalBest();
  buildBoard();
  // 后台预加载 Firebase 并刷新全球最高分
  await preloadBackend();
  if (isGlobalEnabled()) {
    toast("🌍 全球排行榜已启用");
  }
  refreshRecords();
})();
