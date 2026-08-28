/**
 * Firebase 配置文件
 * ------------------------------------------------------------------
 * 默认为占位配置，游戏会自动回退到「仅本机存储」模式。
 * 若要启用全球排行榜（所有玩家最高分 / 全球榜单），请按
 * README.md 的步骤创建 Firebase 项目，并把下面的值替换为你自己的。
 *
 * 获取方式：Firebase 控制台 → 项目设置 → 常规 → 「您的应用」里的 SDK 配置。
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/** 是否为未配置的占位值。 */
export const isConfigured =
  !!firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("YOUR_") &&
  !!firebaseConfig.databaseURL &&
  !firebaseConfig.databaseURL.includes("YOUR_PROJECT");
