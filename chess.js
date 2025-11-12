let selectedCell = null;
let currentTurn = "white";
const chessboardElement = document.getElementById("chessboard");
const turnIndicator = document.getElementById("turn-indicator");
const capturedWhite = document.getElementById("captured-white");
const capturedBlack = document.getElementById("captured-black");
//const toggleBtn = document.getElementById("theme-toggle");

// === DARK/LIGHT MODE TOGGLE ===
const toggleBtn = document.getElementById("themeToggle");

toggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-ui");
  const isDark = document.body.classList.contains("dark-ui");
  toggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
});



const chessPieces = [
  { name: "white chess king", htmlDecimal: "&#9812;" },
  { name: "white chess queen", htmlDecimal: "&#9813;" },
  { name: "white chess rook", htmlDecimal: "&#9814;" },
  { name: "white chess bishop", htmlDecimal: "&#9815;" },
  { name: "white chess knight", htmlDecimal: "&#9816;" },
  { name: "white chess pawn", htmlDecimal: "&#9817;" },
  { name: "black chess king", htmlDecimal: "&#9818;" },
  { name: "black chess queen", htmlDecimal: "&#9819;" },
  { name: "black chess rook", htmlDecimal: "&#9820;" },
  { name: "black chess bishop", htmlDecimal: "&#9821;" },
  { name: "black chess knight", htmlDecimal: "&#9822;" },
  { name: "black chess pawn", htmlDecimal: "&#9823;" },
];

// create board
function populateChessboard() {
  chessboardElement.innerHTML = "";

  const initialPiecesOrder = [
    "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"
  ];

  for (let row = 8; row >= 1; row--) {
    for (let col = "A".charCodeAt(0); col <= "H".charCodeAt(0); col++) {
      const coordinates = String.fromCharCode(col) + row;
      const cellElement = document.createElement("div");
      cellElement.className = ((row + col) % 2 === 0) ? "cell dark" : "cell light";
      cellElement.id = coordinates;
      cellElement.dataset.coordinates = coordinates;
      cellElement.style.position = "relative"; // allow absolute dots

      let piece = null;
      if (row === 1) {
        piece = chessPieces.find(p => p.name === `white chess ${initialPiecesOrder[col - 65]}`);
      } else if (row === 2) {
        piece = chessPieces.find(p => p.name === "white chess pawn");
      } else if (row === 7) {
        piece = chessPieces.find(p => p.name === "black chess pawn");
      } else if (row === 8) {
        piece = chessPieces.find(p => p.name === `black chess ${initialPiecesOrder[col - 65]}`);
      }

      if (piece) {
        cellElement.dataset.pieceHtmlDecimal = piece.htmlDecimal;
        cellElement.dataset.pieceName = piece.name;
        cellElement.innerHTML = `<span class="piece">${piece.htmlDecimal}</span>`;
      } else {
        cellElement.dataset.pieceHtmlDecimal = "";
        cellElement.dataset.pieceName = "";
        cellElement.innerHTML = "";
      }

      chessboardElement.appendChild(cellElement);
    }
  }
}

populateChessboard();

function getPieceColor(pieceName) {
  if (!pieceName) return null;
  return pieceName.includes("white") ? "white" : "black";
}

// --- Indicator helpers ---
function clearMoveIndicators() {
  document.querySelectorAll(".move-dot").forEach(dot => dot.remove());
  document.querySelectorAll(".capture-cell").forEach(c => c.classList.remove("capture-cell"));
}

function showPossibleMoves(cell) {
  clearMoveIndicators();
  const pieceColor = getPieceColor(cell.dataset.pieceName);
  if (pieceColor !== currentTurn) return;

  // Get all valid moves for the selected piece
  const possibleMoves = getPossibleMoves(cell);

  // Add visual move dots for normal moves
  possibleMoves.forEach(moveCell => {
    if (!moveCell.classList.contains("capture-cell")) {
      const dot = document.createElement("div");
      dot.classList.add("move-dot");
      moveCell.appendChild(dot);
    }
  });
}
//notify helper
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

//main logic
function handleCellClick(event) {
  const clickedCell = event.target.closest(".cell");
  if (!clickedCell) return;

  // === CASE 1: Selecting a piece ===
  if (selectedCell === null) {
    if (
      clickedCell.dataset.pieceHtmlDecimal &&
      getPieceColor(clickedCell.dataset.pieceName) === currentTurn
    ) {
      selectedCell = clickedCell;
      selectedCell.classList.add("selected");
      showPossibleMoves(clickedCell); // show move/capture indicators
      showToast(
        `${capitalize(currentTurn)} selected ${clickedCell.dataset.pieceName.split(" ").slice(2).join(" ")}`,
        "info"
      );
    } else {
      showToast("Please select your own piece.", "warning");
    }
    return;
  }

  // === CASE 2: Clicking again on the same piece → deselect ===
  if (clickedCell === selectedCell) {
    selectedCell.classList.remove("selected");
    clearMoveIndicators();
    selectedCell = null;
    showToast("Selection cancelled.", "info");
    return;
  }

  // === CASE 3: Clicking another of your own pieces → change selection ===
  if (
    clickedCell.dataset.pieceHtmlDecimal &&
    getPieceColor(clickedCell.dataset.pieceName) === currentTurn
  ) {
    selectedCell.classList.remove("selected");
    clearMoveIndicators();
    selectedCell = clickedCell;
    selectedCell.classList.add("selected");
    showPossibleMoves(clickedCell);
    showToast(
      `${capitalize(currentTurn)} switched selection to ${clickedCell.dataset.pieceName.split(" ").slice(2).join(" ")}`,
      "info"
    );
    return;
  }

  // === CASE 4: Attempting a move or capture ===
  const targetCell = clickedCell;
  const movingPiece = selectedCell.dataset.pieceHtmlDecimal;
  const movingName = selectedCell.dataset.pieceName;
  const targetPiece = targetCell.dataset.pieceHtmlDecimal;
  const targetName = targetCell.dataset.pieceName;
  const targetColor = getPieceColor(targetName);

  const isCapture = targetCell.classList.contains("capture-cell");
  const hasDot = targetCell.querySelector(".move-dot");

  let moveMade = false;

  // === Only allow move if it's a valid reachable cell ===
  if (targetCell !== selectedCell && (isCapture || hasDot)) {
      document.querySelectorAll(".last-move").forEach(cell => cell.classList.remove("last-move"));

    // === CASE 4A: Perform Capture ===
    if (isCapture && targetPiece && targetColor !== currentTurn) {
      const capturedArea =
        targetColor === "white"
          ? document.getElementById("captured-white")
          : document.getElementById("captured-black");

      // Remove captured piece from board before adding
      targetCell.innerHTML = "";

      const capturedSpan = document.createElement("span");
      capturedSpan.innerHTML = targetPiece;
      capturedSpan.style.margin = "4px";
      capturedArea.appendChild(capturedSpan);

      showToast(
        `${capitalize(currentTurn)} captured ${capitalize(targetColor)}’s ${targetName.split(" ").slice(2).join(" ")}!`,
        "success"
      );
    }

    // === CASE 4B: Move piece (either normal move or capture) ===
    targetCell.dataset.pieceHtmlDecimal = movingPiece;
    targetCell.dataset.pieceName = movingName;
    targetCell.innerHTML = `<span class="piece">${movingPiece}</span>`;

    selectedCell.dataset.pieceHtmlDecimal = "";
    selectedCell.dataset.pieceName = "";
    selectedCell.innerHTML = "";
    // ✅ Highlight the last move
    selectedCell.classList.add("last-move");
    targetCell.classList.add("last-move");

    moveMade = true;
  } else {
    // Invalid click (not a valid move or capture cell)
    showToast("Invalid move! Select a highlighted cell.", "error");
  }

  // === CASE 5: Cleanup ===
  selectedCell.classList.remove("selected");
  selectedCell = null;
  clearMoveIndicators();

  // === CASE 6: Switch Turn (only if valid move was made) ===
  if (moveMade) {
    currentTurn = currentTurn === "white" ? "black" : "white";
    if (turnIndicator)
      turnIndicator.textContent =
        currentTurn === "white" ? "Turn: White ♔" : "Turn: Black ♚";
    showToast(
      `Now it's ${capitalize(currentTurn)}'s turn ${
        currentTurn === "white" ? "♔" : "♚"
      }`,
      "info"
    );
  }
}


function getPossibleMoves(cell) {
  const pieceName = cell.dataset.pieceName.toLowerCase();

  if (pieceName.includes("pawn")) return getPawnMoves(cell);
  if (pieceName.includes("rook")) return getRookMoves(cell);
  if (pieceName.includes("bishop")) return getBishopMoves(cell);
  if (pieceName.includes("knight")) return getKnightMoves(cell);
  if (pieceName.includes("queen")) return getQueenMoves(cell);
  if (pieceName.includes("king")) return getKingMoves(cell);

  return [];
}
//pawn moves
function getPawnMoves(cell) {
  const pieceColor = getPieceColor(cell.dataset.pieceName);
  const col = cell.id.charCodeAt(0);
  const row = parseInt(cell.id[1]);
  const direction = pieceColor === "white" ? 1 : -1;
  const possibleMoves = [];

  const nextRow = row + direction;
  const forwardCell = document.getElementById(String.fromCharCode(col) + nextRow);

  // Single forward move
  if (forwardCell && !forwardCell.dataset.pieceHtmlDecimal) {
    possibleMoves.push(forwardCell);
  }

  // Double move from start
  const startRow = pieceColor === "white" ? 2 : 7;
  if (row === startRow) {
    const doubleCell = document.getElementById(String.fromCharCode(col) + (row + 2 * direction));
    if (
      doubleCell &&
      !doubleCell.dataset.pieceHtmlDecimal &&
      forwardCell &&
      !forwardCell.dataset.pieceHtmlDecimal
    ) {
      possibleMoves.push(doubleCell);
    }
  }

  // Diagonal captures
  const diagLeft = document.getElementById(String.fromCharCode(col - 1) + nextRow);
  const diagRight = document.getElementById(String.fromCharCode(col + 1) + nextRow);

  [diagLeft, diagRight].forEach(capCell => {
    if (
      capCell &&
      capCell.dataset.pieceHtmlDecimal &&
      getPieceColor(capCell.dataset.pieceName) !== pieceColor
    ) {
      capCell.classList.add("capture-cell");
      possibleMoves.push(capCell);
    }
  });

  return possibleMoves;
}
//rook
function getRookMoves(cell) {
  return exploreDirections(cell, [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]);
}
//bishop
function getBishopMoves(cell) {
  return exploreDirections(cell, [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}
//queen
function getQueenMoves(cell) {
  return exploreDirections(cell, [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]);
}
//knight
function getKnightMoves(cell) {
  const pieceColor = getPieceColor(cell.dataset.pieceName);
  const col = cell.id.charCodeAt(0);
  const row = parseInt(cell.id[1]);
  const moves = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2],
  ];
  const possibleMoves = [];

  moves.forEach(([dx, dy]) => {
    const target = document.getElementById(String.fromCharCode(col + dx) + (row + dy));
    if (target) {
      if (!target.dataset.pieceHtmlDecimal) possibleMoves.push(target);
      else if (getPieceColor(target.dataset.pieceName) !== pieceColor) {
        target.classList.add("capture-cell");
        possibleMoves.push(target);
      }
    }
  });

  return possibleMoves;
}
//king
function getKingMoves(cell) {
  const pieceColor = getPieceColor(cell.dataset.pieceName);
  const col = cell.id.charCodeAt(0);
  const row = parseInt(cell.id[1]);
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const possibleMoves = [];

  directions.forEach(([dx, dy]) => {
    const target = document.getElementById(String.fromCharCode(col + dx) + (row + dy));
    if (target) {
      if (!target.dataset.pieceHtmlDecimal) possibleMoves.push(target);
      else if (getPieceColor(target.dataset.pieceName) !== pieceColor) {
        target.classList.add("capture-cell");
        possibleMoves.push(target);
      }
    }
  });

  return possibleMoves;
}
//moves helper
function exploreDirections(cell, directions) {
  const pieceColor = getPieceColor(cell.dataset.pieceName);
  const col = cell.id.charCodeAt(0);
  const row = parseInt(cell.id[1]);
  const possibleMoves = [];

  directions.forEach(([dx, dy]) => {
    let x = col + dx;
    let y = row + dy;

    while (x >= 65 && x <= 72 && y >= 1 && y <= 8) {
      const target = document.getElementById(String.fromCharCode(x) + y);
      if (!target) break;

      if (!target.dataset.pieceHtmlDecimal) {
        possibleMoves.push(target);
      } else {
        if (getPieceColor(target.dataset.pieceName) !== pieceColor) {
          target.classList.add("capture-cell");
          possibleMoves.push(target);
        }
        break; // stop — piece blocks the path
      }

      x += dx;
      y += dy;
    }
  });

  return possibleMoves;
}
//notify
function showToast(message, type = "info") {
  // Create toast container if it doesn't exist
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    Object.assign(container.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      zIndex: 9999,
    });
    document.body.appendChild(container);
  }

  // Create the toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Dynamic background colors by type
  const bg =
    type === "success"
      ? "#4CAF50"
      : type === "error"
      ? "#f44336"
      : type === "warning"
      ? "#ff9800"
      : "#2196F3";

  Object.assign(toast.style, {
    background: bg,
    color: "white",
    padding: "10px 18px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontSize: "15px",
    opacity: 0,
    transform: "translateX(50px)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
  });

  // Append toast to container
  container.appendChild(toast);

  // Animate fade-in
  requestAnimationFrame(() => {
    toast.style.opacity = 1;
    toast.style.transform = "translateX(0)";
  });

  // Auto-remove after 2.5 seconds
  setTimeout(() => {
    toast.style.opacity = 0;
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}




chessboardElement.addEventListener("click", handleCellClick);

function handleRestartClick() {
  // Reset selection and turn
  selectedCell = null;
  currentTurn = "white";

  // Clear captured pieces
  const capturedWhite = document.getElementById("captured-white");
  const capturedBlack = document.getElementById("captured-black");
  if (capturedWhite) capturedWhite.innerHTML = "";
  if (capturedBlack) capturedBlack.innerHTML = "";

  // Reset the turn indicator text
  const turnIndicator = document.getElementById("turnIndicator");
  if (turnIndicator) turnIndicator.textContent = "Turn: White ♔";

  // Clear old move indicators (dots, highlights)
  clearMoveIndicators();

  // Rebuild the board to starting state
  chessboardElement.innerHTML = "";
  populateChessboard();
}


document.getElementById("restartButton").addEventListener("click", handleRestartClick);
