const chessboardElement = document.getElementById("chessboard");
const turnIndicator = document.getElementById("turn-indicator");
const capturedWhite = document.getElementById("captured-white");
const capturedBlack = document.getElementById("captured-black");

let selectedCell = null;
let currentTurn = "white";

const chessPieces = [
  { name: "white king", htmlDecimal: "&#9812;" },
  { name: "white queen", htmlDecimal: "&#9813;" },
  { name: "white rook", htmlDecimal: "&#9814;" },
  { name: "white bishop", htmlDecimal: "&#9815;" },
  { name: "white knight", htmlDecimal: "&#9816;" },
  { name: "white pawn", htmlDecimal: "&#9817;" },
  { name: "black king", htmlDecimal: "&#9818;" },
  { name: "black queen", htmlDecimal: "&#9819;" },
  { name: "black rook", htmlDecimal: "&#9820;" },
  { name: "black bishop", htmlDecimal: "&#9821;" },
  { name: "black knight", htmlDecimal: "&#9822;" },
  { name: "black pawn", htmlDecimal: "&#9823;" },
];

function createCell(row, col) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.classList.add((row + col) % 2 === 0 ? "dark" : "light");

  const colChar = String.fromCharCode(65 + col);
  const coordinates = colChar + (8 - row);
  cell.dataset.coordinates = coordinates;
  return cell;
}

function populateChessboard() {
  chessboardElement.innerHTML = "";

  const initialPiecesOrder = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = createCell(row, col);
      const coordinates = cell.dataset.coordinates;

      let piece = null;

      if (row === 1) piece = chessPieces.find(p => p.name === "white pawn");
      if (row === 6) piece = chessPieces.find(p => p.name === "black pawn");
      if (row === 0) piece = chessPieces.find(p => p.name === `white ${initialPiecesOrder[col]}`);
      if (row === 7) piece = chessPieces.find(p => p.name === `black ${initialPiecesOrder[col]}`);

      if (piece) {
        cell.dataset.piece = piece.name;
        cell.innerHTML = piece.htmlDecimal;
      }

      cell.addEventListener("click", handleCellClick);
      chessboardElement.appendChild(cell);
    }
  }

  currentTurn = "white";
  turnIndicator.textContent = "Turn: White ♔";
  capturedWhite.innerHTML = "";
  capturedBlack.innerHTML = "";
}

function handleCellClick(event) {
  const clicked = event.target;

  // Selecting a piece
  if (!selectedCell) {
    if (clicked.dataset.piece && clicked.dataset.piece.startsWith(currentTurn)) {
      selectedCell = clicked;
      selectedCell.classList.add("selected");
    }
    return;
  }

  // Clicking again on the same piece
  if (clicked === selectedCell) {
    selectedCell.classList.remove("selected");
    selectedCell = null;
    return;
  }

  const movingPiece = selectedCell.dataset.piece;
  const targetPiece = clicked.dataset.piece;
  const from = selectedCell.dataset.coordinates;
  const to = clicked.dataset.coordinates;

  // Can't capture your own piece
  if (targetPiece && targetPiece.startsWith(currentTurn)) return;

  // Get board state (map of coordinates to piece name)
  const boardState = {};
  document.querySelectorAll(".cell").forEach(cell => {
    if (cell.dataset.piece) boardState[cell.dataset.coordinates] = cell.dataset.piece;
  });

  // Check legality
  if (!isLegalMove(movingPiece, from, to, boardState)) {
    console.log("Illegal move!");
    selectedCell.classList.remove("selected");
    selectedCell = null;
    return;
  }

  // Capture opponent piece
  if (targetPiece) {
    const capturedArea = targetPiece.startsWith("white") ? capturedWhite : capturedBlack;
    capturedArea.innerHTML += clicked.innerHTML;
  }

  // Move piece
  clicked.dataset.piece = movingPiece;
  clicked.innerHTML = selectedCell.innerHTML;
  selectedCell.dataset.piece = "";
  selectedCell.innerHTML = "";
  selectedCell.classList.remove("selected");
  selectedCell = null;

  // Switch turn
  currentTurn = currentTurn === "white" ? "black" : "white";
  turnIndicator.textContent =
    currentTurn === "white" ? "Turn: White ♔" : "Turn: Black ♚";
}


document.getElementById("restartButton").addEventListener("click", populateChessboard);
populateChessboard();
