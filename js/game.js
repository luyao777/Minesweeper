/**
 * 扫雷核心逻辑 —— 卡通扫雷大冒险
 * 负责棋盘生成、翻格、标记、胜负判定与难度递增。
 */

/** 根据关卡生成难度参数（棋盘越大、雷越多）。 */
export function levelConfig(level) {
  const size = Math.min(8 + level, 18);          // 边长：9 -> 18
  const density = Math.min(0.1 + level * 0.013, 0.26); // 雷密度：10% -> 26%
  const mines = Math.max(1, Math.floor(size * size * density));
  return { rows: size, cols: size, mines };
}

export class Minesweeper {
  /**
   * @param {object}   opts
   * @param {number}   opts.rows
   * @param {number}   opts.cols
   * @param {number}   opts.mines
   * @param {(state:object)=>void} opts.onChange  状态变化回调
   */
  constructor({ rows, cols, mines, onChange }) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mines;
    this.onChange = onChange || (() => {});

    this.board = [];      // -1 雷, 0~8 周围雷数
    this.revealed = [];   // 是否已翻开
    this.flagged = [];    // 是否已标记
    this.firstClick = true;
    this.gameOver = false;
    this.won = false;
    this.flagsUsed = 0;
    this.revealedCount = 0;

    this._initArrays();
  }

  _initArrays() {
    this.board = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.revealed = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    this.flagged = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
  }

  /** 第一次点击后才放雷，保证起手及周边无雷。 */
  _placeMines(safeR, safeC) {
    const forbidden = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeR + dr, c = safeC + dc;
        if (this._inBound(r, c)) forbidden.add(r * this.cols + c);
      }
    }
    const candidates = [];
    for (let i = 0; i < this.rows * this.cols; i++) {
      if (!forbidden.has(i)) candidates.push(i);
    }
    // Fisher-Yates 洗牌取前 N 个
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const mineNum = Math.min(this.mineCount, candidates.length);
    for (let i = 0; i < mineNum; i++) {
      const idx = candidates[i];
      const r = Math.floor(idx / this.cols);
      const c = idx % this.cols;
      this.board[r][c] = -1;
    }
    // 计算数字
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c] === -1) continue;
        this.board[r][c] = this._countNeighbors(r, c);
      }
    }
  }

  _countNeighbors(r, c) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (this._inBound(nr, nc) && this.board[nr][nc] === -1) n++;
      }
    }
    return n;
  }

  _inBound(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  /** 翻开格子，返回事件类型。 */
  reveal(r, c) {
    if (this.gameOver || this.won) return 'idle';
    if (this.revealed[r][c] || this.flagged[r][c]) return 'idle';

    if (this.firstClick) {
      this._placeMines(r, c);
      this.firstClick = false;
    }

    if (this.board[r][c] === -1) {
      this.revealed[r][c] = true;
      this.gameOver = true;
      this.lastMine = [r, c];
      this._emit();
      return 'lose';
    }

    this._flood(r, c);
    this._checkWin();
    this._emit();
    return this.won ? 'win' : 'reveal';
  }

  _flood(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      if (cr < 0 || cc < 0 || cr >= this.rows || cc >= this.cols) continue;
      if (this.revealed[cr][cc] || this.flagged[cr][cc]) continue;
      if (this.board[cr][cc] === -1) continue;
      this.revealed[cr][cc] = true;
      this.revealedCount++;
      if (this.board[cr][cc] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            stack.push([cr + dr, cc + dc]);
          }
        }
      }
    }
  }

  /** 切换标记。 */
  toggleFlag(r, c) {
    if (this.gameOver || this.won) return 'idle';
    if (this.revealed[r][c]) return 'idle';
    this.flagged[r][c] = !this.flagged[r][c];
    this.flagsUsed += this.flagged[r][c] ? 1 : -1;
    this._emit();
    return 'flag';
  }

  _checkWin() {
    const safeTotal = this.rows * this.cols - this.mineCount;
    if (this.revealedCount >= safeTotal) {
      this.won = true;
    }
  }

  /** 游戏失败时暴露所有雷的位置。 */
  revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c] === -1 && !this.flagged[r][c]) {
          this.revealed[r][c] = true;
        }
      }
    }
  }

  /** 标错的旗子（游戏失败时用于提示）。 */
  wrongFlags() {
    const list = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.flagged[r][c] && this.board[r][c] !== -1) list.push([r, c]);
      }
    }
    return list;
  }

  minesLeft() {
    return this.mineCount - this.flagsUsed;
  }

  _emit() {
    this.onChange({
      rows: this.rows,
      cols: this.cols,
      board: this.board,
      revealed: this.revealed,
      flagged: this.flagged,
      gameOver: this.gameOver,
      won: this.won,
      minesLeft: this.minesLeft(),
    });
  }
}
