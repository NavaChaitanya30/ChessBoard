
class Cell {
    constructor(coordinates, pieceHtmlDecimal) {
      this.coordinates = coordinates;
      this.pieceHtmlDecimal = pieceHtmlDecimal;
    }
  }
        let selectedCell = null;

        function handleCellClick(event) {
        const clickedCell = event.target;

        if (selectedCell === null) {
            // First click, selecting a piece
            if (clickedCell.dataset.pieceHtmlDecimal) {
            selectedCell = clickedCell;
            selectedCell.classList.add('selected');
            }
        } else {
            // Second click, moving the piece
            const coordinates = clickedCell.dataset.coordinates;

            // Move the piece and update the cells
            if (coordinates && !clickedCell.dataset.pieceHtmlDecimal) {
            clickedCell.dataset.pieceHtmlDecimal = selectedCell.dataset.pieceHtmlDecimal;
            clickedCell.dataset.pieceName = selectedCell.dataset.pieceName;
            clickedCell.innerHTML = selectedCell.dataset.pieceHtmlDecimal;

            selectedCell.dataset.pieceHtmlDecimal = '';
            selectedCell.dataset.pieceName = '';
            selectedCell.innerHTML = '';

            selectedCell.classList.remove('selected');
            }

            selectedCell = null; // Clear the selected cell
        }
        }

        const chessboardElement = document.getElementById('chessboard');
        chessboardElement.addEventListener('click', handleCellClick);

        const chessPieces = [
        { name: 'white chess king', htmlDecimal: '&#9812;' },
        { name: 'white chess queen', htmlDecimal: '&#9813;' },
        { name: 'white chess rook', htmlDecimal: '&#9814;' },
        { name: 'white chess bishop', htmlDecimal: '&#9815;' },
        { name: 'white chess knight', htmlDecimal: '&#9816;' },
        { name: 'white chess pawn', htmlDecimal: '&#9817;' },
        { name: 'black chess king', htmlDecimal: '&#9818;' },
        { name: 'black chess queen', htmlDecimal: '&#9819;' },
        { name: 'black chess rook', htmlDecimal: '&#9820;' },
        { name: 'black chess bishop', htmlDecimal: '&#9821;' },
        { name: 'black chess knight', htmlDecimal: '&#9822;' },
        { name: 'black chess pawn', htmlDecimal: '&#9823;' },
        ];

        function populateChessboard() {
            const initialPiecesOrder = [
            'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'
            ];

            let pieceIndex = 0;
            for (let row = 8; row >= 1; row--) {
                for (let col = 'A'.charCodeAt(0); col <= 'H'.charCodeAt(0); col++) {
                    const coordinates = String.fromCharCode(col) + row;
                    const cellElement = document.createElement('div');
                    cellElement.className = ((row + col) % 2 === 0) ? 'cell dark' : 'cell';
                    cellElement.id = coordinates;
                    cellElement.dataset.coordinates = coordinates;

                    let piece = null;

                    if (row === 1) {
                        const colChar = String.fromCharCode(col);
                        const pieceName = `white chess ${initialPiecesOrder[col - 'A'.charCodeAt(0)]}`;
                        piece = chessPieces.find(piece => piece.name === pieceName);
                    } else if (row === 2) {
                        piece = chessPieces.find(piece => piece.name === 'white chess pawn');
                    } else if (row === 7) {
                        piece = chessPieces.find(piece => piece.name === 'black chess pawn');
                    } else if (row === 8) {
                        const colChar = String.fromCharCode(col);
                        const pieceName = `black chess ${initialPiecesOrder[col - 'A'.charCodeAt(0)]}`;
                        piece = chessPieces.find(piece => piece.name === pieceName);
                        }

                    if (piece) {
                        cellElement.dataset.pieceHtmlDecimal = piece.htmlDecimal;
                        cellElement.dataset.pieceName = piece.name;
                        cellElement.innerHTML = piece.htmlDecimal;
                    } else {
                        cellElement.dataset.pieceHtmlDecimal = '';
                        cellElement.dataset.pieceName = '';
                        cellElement.innerHTML = '';
                    }

                    chessboardElement.appendChild(cellElement);
                }
            }
        }


    function handleRestartClick() {
        chessboardElement.innerHTML = '';
        populateChessboard();
        }

        const restartButton = document.getElementById('restartButton');
        restartButton.addEventListener('click', handleRestartClick);

        populateChessboard();
