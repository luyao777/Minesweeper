/**
 * 排行榜与存储模块
 * ------------------------------------------------------------------
 * - 本机：用 localStorage 保存「本机最高分」与玩家昵称，无需任何后端。
 * - 全球：当 firebase-config 已配置时，自动启用 Firebase Realtime Database，
 *   实现「所有玩家最高分」与全球 Top 10 排行榜。
 * - 未配置 Firebase 时，全球相关功能会优雅降级（显示「—」）。
 */

import { firebaseConfig, isConfigured } from "./firebase-config.js";

const LS_BEST = "ms_cute_local_best";
const LS_NAME = "ms_cute_player_name";
const LS_SCORES = "ms_cute_local_scores"; // 本机榜单兜底

let db = null;
let fbReady = false;

async function ensureFirebase() {
  if (fbReady || !isConfigured) return fbReady;
  try {
    const appMod = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
    );
    const dbMod = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"
    );
    const app = appMod.initializeApp(firebaseConfig);
    db = dbMod.getDatabase(app);
    fbReady = true;
    return true;
  } catch (e) {
    console.warn("[排行榜] Firebase 初始化失败，回退到本机模式：", e);
    return false;
  }
}

/** 异步预加载 Firebase（页面加载后即尝试，避免首次查询时卡顿）。 */
export async function preloadBackend() {
  await ensureFirebase();
}

export function isGlobalEnabled() {
  return fbReady;
}

/* ---------------- 本机存储 ---------------- */

export function getLocalBest() {
  const v = Number(localStorage.getItem(LS_BEST) || 0);
  return Number.isFinite(v) ? v : 0;
}

function setLocalBest(score) {
  const best = getLocalBest();
  if (score > best) localStorage.setItem(LS_BEST, String(score));
}

export function getPlayerName() {
  return localStorage.getItem(LS_NAME) || "";
}

export function setPlayerName(name) {
  const n = String(name || "").trim().slice(0, 12);
  localStorage.setItem(LS_NAME, n || "小可爱");
  return n || "小可爱";
}

/** 本机兜底榜单（无 Firebase 时也展示一个本地 Top10）。 */
function getLocalScores() {
  try {
    return JSON.parse(localStorage.getItem(LS_SCORES) || "[]");
  } catch {
    return [];
  }
}

function pushLocalScore(entry) {
  const list = getLocalScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  localStorage.setItem(LS_SCORES, JSON.stringify(top));
}

/* ---------------- 提交分数 ---------------- */

/**
 * 提交一局成绩。
 * @returns {Promise<{best:boolean, global:boolean}>}
 */
export async function submitScore(name, score, level) {
  const playerName = (String(name || "").trim() || "小可爱").slice(0, 12);
  const entry = {
    name: playerName,
    score: Math.max(0, Math.floor(score)),
    level: Math.max(1, level | 0),
    date: Date.now(),
  };

  const prevBest = getLocalBest();
  setLocalBest(entry.score);
  pushLocalScore(entry);
  const isBest = entry.score > prevBest;

  let global = false;
  if (await ensureFirebase()) {
    try {
      const { ref, push } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"
      );
      await push(ref(db, "scores"), entry);
      global = true;
    } catch (e) {
      console.warn("[排行榜] 提交到全球失败：", e);
    }
  }
  return { best: isBest, global };
}

/* ---------------- 读取最高分 / 榜单 ---------------- */

/** 全球最高分（无后端时返回 null）。 */
export async function getGlobalBest() {
  if (!(await ensureFirebase())) return null;
  try {
    const { ref, query, orderByChild, limitToLast, get } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"
    );
    const q = query(ref(db, "scores"), orderByChild("score"), limitToLast(1));
    const snap = await get(q);
    let best = null;
    snap.forEach((child) => {
      best = child.val();
    });
    return best;
  } catch (e) {
    console.warn("[排行榜] 读取全球最高分失败：", e);
    return null;
  }
}

/**
 * 全球 Top 10 榜单。
 * 无后端时返回本机兜底榜单，并标记 local:true。
 */
export async function getLeaderboard(myName) {
  if (await ensureFirebase()) {
    try {
      const { ref, query, orderByChild, limitToLast, get } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"
      );
      const q = query(ref(db, "scores"), orderByChild("score"), limitToLast(10));
      const snap = await get(q);
      const list = [];
      snap.forEach((child) => list.push(child.val()));
      list.reverse();
      return { local: false, list };
    } catch (e) {
      console.warn("[排行榜] 读取全球榜单失败，使用本机榜单：", e);
    }
  }
  return { local: true, list: getLocalScores() };
}
