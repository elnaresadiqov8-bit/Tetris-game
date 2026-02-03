const canvas = document.getElementById("board");
const context = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start");
const resetButton = document.getElementById("reset");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
  null,
  "#38bdf8",
  "#f97316",
  "#a855f7",
  "#22c55e",
  "#facc15",
  "#f43f5e",
  "#e2e8f0",
];

const SHAPES = [
  [],
  [[1, 1, 1, 1]],
  [
    [2, 0, 0],
    [2, 2, 2],
  ],
  [
    [0, 0, 3],
    [3, 3, 3],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
  ],
  [
    [5, 5],
    [5, 5],
  ],
  [
    [0, 6, 0],
    [6, 6, 6],
  ],
  [
    [7, 7, 0],
    [0, 7, 7],
  ],
];

const state = {
  board: [],
  current: null,
  next: null,
  score: 0,
  level: 1,
  lines: 0,
  dropCounter: 0,
  dropInterval: 1000,
  lastTime: 0,
  running: false,
  gameOver: false,
};

function createMatrix(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

function createPiece() {
  const type = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
  const matrix = SHAPES[type].map((row) => row.slice());
  return {
    matrix,
    pos: {
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
    },
  };
}

function drawCell(x, y, value, ctx, size) {
  if (!value) return;
  ctx.fillStyle = COLORS[value];
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
  ctx.strokeRect(x * size, y * size, size, size);
}

function drawMatrix(matrix, offset, ctx, size) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(x + offset.x, y + offset.y, value, ctx, size);
      }
    });
  });
}

function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[y + piece.pos.y][x + piece.pos.x] = value;
      }
    });
  });
}

function collide(board, piece) {
  return piece.matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) return false;
      const boardY = y + piece.pos.y;
      const boardX = x + piece.pos.x;
      return (
        boardY >= ROWS ||
        boardX < 0 ||
        boardX >= COLS ||
        (board[boardY] && board[boardY][boardX])
      );
    })
  );
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach((row) => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerRotate(dir) {
  const pos = state.current.pos.x;
  let offset = 1;
  rotate(state.current.matrix, dir);
  while (collide(state.board, state.current)) {
    state.current.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > state.current.matrix[0].length) {
      rotate(state.current.matrix, -dir);
      state.current.pos.x = pos;
      return;
    }
  }
}

function sweep() {
  let rowCount = 0;
  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!state.board[y][x]) {
        continue outer;
      }
    }
    const row = state.board.splice(y, 1)[0].fill(0);
    state.board.unshift(row);
    y += 1;
    rowCount += 1;
  }

  if (rowCount > 0) {
    state.lines += rowCount;
    const points = [0, 40, 100, 300, 1200];
    state.score += points[rowCount] * state.level;
    if (state.lines >= state.level * 10) {
      state.level += 1;
      state.dropInterval = Math.max(150, state.dropInterval - 100);
    }
  }
}

function playerDrop() {
  state.current.pos.y += 1;
  if (collide(state.board, state.current)) {
    state.current.pos.y -= 1;
    merge(state.board, state.current);
    resetPiece();
    sweep();
    updateStats();
  }
  state.dropCounter = 0;
}

function hardDrop() {
  while (!collide(state.board, state.current)) {
    state.current.pos.y += 1;
  }
  state.current.pos.y -= 1;
  merge(state.board, state.current);
  resetPiece();
  sweep();
  updateStats();
  state.dropCounter = 0;
}

function resetPiece() {
  state.current = state.next ?? createPiece();
  state.next = createPiece();
  state.current.pos.y = 0;
  state.current.pos.x = Math.floor(
    (COLS - state.current.matrix[0].length) / 2
  );

  if (collide(state.board, state.current)) {
    state.gameOver = true;
    state.running = false;
    overlay.classList.remove("hidden");
  }
}

function updateStats() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  linesEl.textContent = state.lines;
}

function draw() {
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(state.board, { x: 0, y: 0 }, context, BLOCK_SIZE);
  if (state.current) {
    drawMatrix(state.current.matrix, state.current.pos, context, BLOCK_SIZE);
  }
}

function drawNext() {
  nextContext.fillStyle = "#020617";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!state.next) return;
  const size = 24;
  const offset = {
    x: Math.floor((nextCanvas.width / size - state.next.matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / size - state.next.matrix.length) / 2),
  };
  drawMatrix(state.next.matrix, offset, nextContext, size);
}

function update(time = 0) {
  if (!state.running) return;
  const delta = time - state.lastTime;
  state.lastTime = time;
  state.dropCounter += delta;
  if (state.dropCounter > state.dropInterval) {
    playerDrop();
  }
  draw();
  drawNext();
  requestAnimationFrame(update);
}

function startGame() {
  if (state.gameOver) return;
  if (state.running) return;
  state.running = true;
  state.lastTime = 0;
  requestAnimationFrame(update);
  startButton.textContent = "Duraklat";
}

function togglePause() {
  if (state.gameOver) return;
  state.running = !state.running;
  if (state.running) {
    state.lastTime = 0;
    requestAnimationFrame(update);
    startButton.textContent = "Duraklat";
  } else {
    startButton.textContent = "Başlat";
  }
}

function resetGame() {
  state.board = createMatrix(COLS, ROWS);
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.dropInterval = 1000;
  state.dropCounter = 0;
  state.lastTime = 0;
  state.gameOver = false;
  overlay.classList.add("hidden");
  resetPiece();
  updateStats();
  draw();
  drawNext();
  startButton.textContent = "Duraklat";
  startGame();
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(event.key)) {
    event.preventDefault();
  }
  if (!state.running) {
    if (event.key.toLowerCase() === "p") {
      togglePause();
      return;
    }
    if (!state.gameOver) {
      startGame();
    } else {
      return;
    }
  }
  switch (event.key) {
    case "ArrowLeft":
      state.current.pos.x -= 1;
      if (collide(state.board, state.current)) {
        state.current.pos.x += 1;
      }
      break;
    case "ArrowRight":
      state.current.pos.x += 1;
      if (collide(state.board, state.current)) {
        state.current.pos.x -= 1;
      }
      break;
    case "ArrowDown":
      playerDrop();
      break;
    case "ArrowUp":
      playerRotate(1);
      break;
    case " ":
      hardDrop();
      break;
    case "p":
    case "P":
      togglePause();
      break;
    default:
      break;
  }
});

startButton.addEventListener("click", () => {
  if (state.gameOver) return;
  if (state.running) {
    togglePause();
  } else {
    startGame();
  }
});

resetButton.addEventListener("click", () => {
  state.running = false;
  resetGame();
});

resetGame();
