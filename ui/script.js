let ws;
let selectedPiece = null; // 当前选中的棋子
let GRID_SIZE = 80;  // 格子大小（将根据棋盘实际大小动态计算）
let BOARD_PADDING = 40;  // 棋盘边距（将根据棋盘实际大小动态计算）
let legalMoveMarkers = []; // 存储合法移动标记的数组

// 棋盘状态
let boardState = {};
let isGameOver = false; // 新增：游戏结束状态标志

// Piece mapping from server characters to frontend classes and text
const pieceMap = {
    // Red pieces (player)
    'R': { class: 'red-che', text: '车' },
    'N': { class: 'red-ma', text: '马' },
    'B': { class: 'red-xiang', text: '相' },
    'A': { class: 'red-shi', text: '士' },
    'K': { class: 'red-jiang', text: '帅' },
    'C': { class: 'red-pao', text: '炮' },
    'P': { class: 'red-bing', text: '兵' },
    // Black pieces (AI)
    'r': { class: 'black-che', text: '車' },
    'n': { class: 'black-ma', text: '馬' },
    'b': { class: 'black-xiang', text: '象' },
    'a': { class: 'black-shi', text: '士' },
    'k': { class: 'black-jiang', text: '将' },
    'c': { class: 'black-pao', text: '炮' },
    'p': { class: 'black-bing', text: '卒' }
};

// 计算棋盘和格子的实际尺寸
function calculateBoardDimensions() {
    const chessboard = document.querySelector('.chessboard');
    if (!chessboard) return;
    
    const boardRect = chessboard.getBoundingClientRect();
    const boardWidth = boardRect.width;
    const boardHeight = boardRect.height;
    
    // 计算棋盘内边距（padding）
    BOARD_PADDING = boardWidth * 0.059; // 5.9%的相对内边距
    
    // 计算实际格子大小 - 现在为8格(横向)和9格(纵向)
    GRID_SIZE = (boardWidth - 2 * BOARD_PADDING) / 8;
    
    console.log(`棋盘尺寸已更新: 宽=${boardWidth}px, 高=${boardHeight}px, 格子大小=${GRID_SIZE}px, 内边距=${BOARD_PADDING}px`);
}

// 更新所有棋子的位置
function updateAllPiecesPositions() {
    const pieces = document.querySelectorAll('.piece');
    
    pieces.forEach(piece => {
        const position = piece.getAttribute('data-position');
        if (position) {
            const [col, row] = position.split('');
            const x = col.charCodeAt(0) - 'a'.charCodeAt(0);
            const y = parseInt(row);
            
            piece.style.left = `${BOARD_PADDING + x * GRID_SIZE}px`;
            piece.style.top = `${BOARD_PADDING + (9 - y) * GRID_SIZE}px`;
        }
    });
}

function initializeBoard() {
    const chessboard = document.querySelector('.chessboard');
    // Clear existing pieces before initializing or re-rendering
    // const existingPieces = chessboard.querySelectorAll('.piece');
    // existingPieces.forEach(p => p.remove()); // REMOVED THIS LINE - IT WAS CAUSING INITIAL PIECES TO DISAPPEAR
    boardState = {}; // Reset boardState

    // If called without arguments, it means initial setup from HTML defined pieces
    // This part might need adjustment if we always render from a server state initially.
    // For now, assume HTML provides the initial setup.
    const initialPieces = document.querySelectorAll('.chessboard > .piece-template'); // Assuming we might change HTML to use templates
    // Or, more robustly, defer to updateBoardFromServer for initial setup too.

    // 计算棋盘尺寸
    calculateBoardDimensions();

    // The original initializeBoard populated boardState from existing HTML pieces.
    // Now, this function is more about setting up dimensions and event listeners.
    // Piece rendering will be handled by updateBoardFromServer or if initial HTML pieces are kept.
    // For now, let's assume the HTML defines the very first board state correctly.
    // We will re-populate boardState from actual DOM pieces found.
    document.querySelectorAll('.chessboard .piece').forEach(piece => {
        const position = piece.getAttribute('data-position');
        if (position) {
            boardState[position] = {
                element: piece,
                type: piece.className.split(' ')[1]
            };
        }
    });
    updateAllPiecesPositions(); // Ensure pieces from HTML are positioned correctly

    // 确保棋盘网格在底层
    const boardGrid = document.querySelector('.board-grid');
    if (boardGrid) {
        boardGrid.style.zIndex = "1";
    }

    // 初始化状态面板
    const status = document.getElementById('status');
    if (status) {
        status.textContent = "轮到您走棋";
    }
    
    // 确保AI思考状态初始隐藏
    hideAIThinking();

    // 移除所有现有的点击事件
    document.removeEventListener('click', handleGlobalClick, true);
    
    // 在document级别添加一个捕获阶段的点击事件处理器
    document.addEventListener('click', handleGlobalClick, true);

    // Add Undo button listener
    const undoButton = document.getElementById('undo-button');
    if (undoButton) {
        undoButton.addEventListener('click', handleUndoClick);
        undoButton.disabled = true; // Disable undo button on initial load
    }

    // Add New Game button listener
    const newGameButton = document.getElementById('new-game-button');
    if (newGameButton) {
        newGameButton.addEventListener('click', handleNewGameClick);
    }
}

function handleGlobalClick(event) {
    console.log("Global click handler triggered");
    
    // 检查是否点击了棋子
    if (event.target.classList.contains('piece')) {
        console.log("Piece clicked");
        event.stopPropagation();
        handlePieceClick(event);
        return;
    }

    // 检查是否点击了棋盘
    const chessboard = document.querySelector('.chessboard');
    if (event.target === chessboard || event.target.classList.contains('board-grid') || event.target.classList.contains('legal-move-marker')) {
        console.log("Board clicked");
        handleBoardClick(event);
    }
}

function handlePieceClick(event) {
    if (isGameOver) {
        console.log("Game is over. Cannot select piece.");
        deselectPiece(); // 确保没有棋子保持选中状态
        return;
    }
    console.log("handlePieceClick processing");
    const piece = event.target;
    const piecePosition = piece.getAttribute('data-position');
    const pieceType = piece.className.split(' ')[1];
    
    // 检查是否是玩家的棋子(红方)
    const isPlayerPiece = pieceType.startsWith('red-');
    
    if (selectedPiece === piece) {
        console.log("Deselecting piece");
        deselectPiece();
    } else if (selectedPiece && isPlayerPiece) {
        // 如果当前选中的是玩家的棋子并点击了另一个玩家棋子，则选中新棋子
        console.log("Selecting different player piece");
        deselectPiece();
        selectPiece(piece);
    } else if (selectedPiece) {
        console.log("Attempting to capture piece");
        const fromPos = selectedPiece.getAttribute('data-position');
        const toPos = piecePosition;
        
        // 验证移动是否合法
        if (isLegalMove(selectedPiece, fromPos, toPos)) {
            makeMove(fromPos, toPos);
        } else {
            console.log("Illegal move");
        }
    } else if (isPlayerPiece) {
        console.log("Selecting new piece");
        selectPiece(piece);
    }
}

function handleBoardClick(event) {
    if (isGameOver) {
        console.log("Game is over. Cannot move to board position.");
        return;
    }
    console.log("handleBoardClick processing");
    if (!selectedPiece) return;

    const chessboard = document.querySelector('.chessboard');
    const rect = chessboard.getBoundingClientRect();
    
    let x, y;
    // 如果点击的是合法移动标记
    if (event.target.classList.contains('legal-move-marker')) {
        const pos = event.target.getAttribute('data-position');
        const toPos = pos;
        const fromPos = selectedPiece.getAttribute('data-position');
        
        if (isLegalMove(selectedPiece, fromPos, toPos)) {
            makeMove(fromPos, toPos);
        }
        return;
    }
    
    // 计算相对于棋盘的点击位置
    x = event.clientX - rect.left - BOARD_PADDING;
    y = event.clientY - rect.top - BOARD_PADDING;

    // 根据当前格子大小计算列和行
    const col = Math.round(x / GRID_SIZE);
    const row = 9 - Math.round(y / GRID_SIZE);

    if (col >= 0 && col < 9 && row >= 0 && row < 10) {
        const toPos = `${String.fromCharCode(97 + col)}${row}`;
        const fromPos = selectedPiece.getAttribute('data-position');
        
        // 验证移动是否合法
        if (isLegalMove(selectedPiece, fromPos, toPos)) {
            makeMove(fromPos, toPos);
        } else {
            console.log("Illegal move");
        }
    }
}

function selectPiece(piece) {
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        clearLegalMoveMarkers();
    }
    selectedPiece = piece;
    piece.classList.add('selected');
    
    // 显示该棋子的合法移动位置
    showLegalMoves(piece);
}

function deselectPiece() {
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        selectedPiece = null;
        clearLegalMoveMarkers();
    }
}

// 清除所有合法移动标记
function clearLegalMoveMarkers() {
    legalMoveMarkers.forEach(marker => {
        if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
        }
    });
    legalMoveMarkers = [];
}

// 新增辅助函数：根据代数坐标定位棋子元素的视觉位置
function positionPieceElement(pieceElement, algebraicPos) {
    const colChar = algebraicPos.charAt(0);
    const rowChar = algebraicPos.substring(1);
    const x = colChar.charCodeAt(0) - 'a'.charCodeAt(0); // 0 for 'a', 1 for 'b', ...
    const y = parseInt(rowChar); // 0-9

    // BOARD_PADDING 和 GRID_SIZE 必须是最新的
    // calculateBoardDimensions(); // 可以在此调用以确保，但可能会影响性能，假设它们是相对稳定的

    pieceElement.style.left = `${BOARD_PADDING + x * GRID_SIZE}px`;
    // Y坐标转换：棋盘数组的0行是视觉上的第9行（黑方底线），代数坐标的0行是视觉上的第0行（红方底线）
    // 前端视觉渲染时，通常 (0,0) 在左上角。我们的代数坐标系中，红方在行0-4，黑方在行5-9。
    // updateAllPiecesPositions 和 showLegalMoves 使用 (9-y) 的逻辑，这里保持一致。
    pieceElement.style.top = `${BOARD_PADDING + (9 - y) * GRID_SIZE}px`;
    pieceElement.setAttribute('data-position', algebraicPos); // 更新棋子的data-position属性
}

// 显示棋子的合法移动位置
function showLegalMoves(piece) {
    const fromPos = piece.getAttribute('data-position');
    const chessboard = document.querySelector('.chessboard');
    
    // 遍历整个棋盘的所有位置
    for (let col = 0; col < 9; col++) {
        for (let row = 0; row < 10; row++) {
            const toPos = `${String.fromCharCode(97 + col)}${row}`;
            
            // 跳过自己的位置
            if (toPos === fromPos) continue;
            
            // 检查移动是否合法
            if (isLegalMove(piece, fromPos, toPos)) {
                // 创建合法移动标记
                const marker = document.createElement('div');
                marker.className = 'legal-move-marker';
                marker.setAttribute('data-position', toPos);
                
                // 设置标记的位置
                marker.style.left = `${BOARD_PADDING + col * GRID_SIZE}px`;
                marker.style.top = `${BOARD_PADDING + (9 - row) * GRID_SIZE}px`;
                
                // 使标记大小响应式
                marker.style.width = `${GRID_SIZE * 0.4}px`;
                marker.style.height = `${GRID_SIZE * 0.4}px`;
                
                chessboard.appendChild(marker);
                legalMoveMarkers.push(marker);
            }
        }
    }
}

// 解析位置字符串为坐标
function parsePosition(pos) {
    const col = pos.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = parseInt(pos[1]);
    return [col, row];
}

// 判断移动是否合法
function isLegalMove(piece, fromPos, toPos) {
    const pieceType = piece.className.split(' ')[1];
    const [fromCol, fromRow] = parsePosition(fromPos);
    const [toCol, toRow] = parsePosition(toPos);
    
    // 目标位置已经有自己的棋子，不能移动
    const targetPiece = document.querySelector(`[data-position="${toPos}"]`);
    if (targetPiece && targetPiece.classList.contains('piece')) {
        const targetPieceType = targetPiece.className.split(' ')[1];
        if (targetPieceType && targetPieceType.startsWith(pieceType.split('-')[0])) {
            return false;
        }
    }
    
    // 根据棋子类型判断移动是否合法
    switch (pieceType) {
        case 'red-che':
        case 'black-che':
            return isValidCheMove(fromCol, fromRow, toCol, toRow);
        case 'red-ma':
        case 'black-ma':
            return isValidMaMove(fromCol, fromRow, toCol, toRow);
        case 'red-xiang':
            return isValidXiangMove(fromCol, fromRow, toCol, toRow, true);
        case 'black-xiang':
            return isValidXiangMove(fromCol, fromRow, toCol, toRow, false);
        case 'red-shi':
            return isValidShiMove(fromCol, fromRow, toCol, toRow, true);
        case 'black-shi':
            return isValidShiMove(fromCol, fromRow, toCol, toRow, false);
        case 'red-jiang':
            return isValidJiangMove(fromCol, fromRow, toCol, toRow, true);
        case 'black-jiang':
            return isValidJiangMove(fromCol, fromRow, toCol, toRow, false);
        case 'red-pao':
        case 'black-pao':
            return isValidPaoMove(fromCol, fromRow, toCol, toRow);
        case 'red-bing':
            return isValidBingMove(fromCol, fromRow, toCol, toRow, true);
        case 'black-bing':
            return isValidBingMove(fromCol, fromRow, toCol, toRow, false);
        default:
            return false;
    }
}

// 车的走法验证
function isValidCheMove(fromCol, fromRow, toCol, toRow) {
    // 车只能横向或纵向移动
    if (fromCol !== toCol && fromRow !== toRow) {
        return false;
    }
    
    // 检查路径上是否有其他棋子
    if (fromCol === toCol) { // 纵向移动
        const minRow = Math.min(fromRow, toRow);
        const maxRow = Math.max(fromRow, toRow);
        for (let row = minRow + 1; row < maxRow; row++) {
            const pos = `${String.fromCharCode(97 + fromCol)}${row}`;
            if (boardState[pos]) {
                return false; // 路径上有棋子，不能移动
            }
        }
    } else { // 横向移动
        const minCol = Math.min(fromCol, toCol);
        const maxCol = Math.max(fromCol, toCol);
        for (let col = minCol + 1; col < maxCol; col++) {
            const pos = `${String.fromCharCode(97 + col)}${fromRow}`;
            if (boardState[pos]) {
                return false; // 路径上有棋子，不能移动
            }
        }
    }
    
    return true;
}

// 马的走法验证
function isValidMaMove(fromCol, fromRow, toCol, toRow) {
    // 马走"日"字
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    if ((colDiff === 1 && rowDiff === 2) || (colDiff === 2 && rowDiff === 1)) {
        // 检查马腿
        if (colDiff === 1) { // 纵向的"日"字
            const stepRow = fromRow + (toRow > fromRow ? 1 : -1);
            const pos = `${String.fromCharCode(97 + fromCol)}${stepRow}`;
            return !boardState[pos]; // 马腿位置没有棋子才能移动
        } else { // 横向的"日"字
            const stepCol = fromCol + (toCol > fromCol ? 1 : -1);
            const pos = `${String.fromCharCode(97 + stepCol)}${fromRow}`;
            return !boardState[pos]; // 马腿位置没有棋子才能移动
        }
    }
    
    return false;
}

// 相/象的走法验证
function isValidXiangMove(fromCol, fromRow, toCol, toRow, isRed) {
    // 相/象走"田"字
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    // 检查是否过河
    if (isRed && toRow > 4) {
        return false; // 红相不能过河
    }
    
    if (!isRed && toRow < 5) {
        return false; // 黑象不能过河
    }
    
    if (colDiff === 2 && rowDiff === 2) {
        // 检查象眼
        const eyeCol = (fromCol + toCol) / 2;
        const eyeRow = (fromRow + toRow) / 2;
        const pos = `${String.fromCharCode(97 + eyeCol)}${eyeRow}`;
        return !boardState[pos]; // 象眼位置没有棋子才能移动
    }
    
    return false;
}

// 士/仕的走法验证
function isValidShiMove(fromCol, fromRow, toCol, toRow, isRed) {
    // 士/仕只能在九宫格内斜走一格
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    // 检查是否在九宫格内
    if (isRed) {
        if (toCol < 3 || toCol > 5 || toRow > 2) {
            return false; // 不在红方九宫格内
        }
    } else {
        if (toCol < 3 || toCol > 5 || toRow < 7) {
            return false; // 不在黑方九宫格内
        }
    }
    
    // 斜走一格
    return colDiff === 1 && rowDiff === 1;
}

// 将/帅的走法验证
function isValidJiangMove(fromCol, fromRow, toCol, toRow, isRed) {
    // 将/帅只能在九宫格内横、纵走一格
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    // 特殊规则：将帅对脸
    if (colDiff === 0 && toCol === fromCol) {
        if (isRed && document.querySelector('.black-jiang')) {
            const blackKingPos = document.querySelector('.black-jiang').getAttribute('data-position');
            const [blackKingCol, blackKingRow] = parsePosition(blackKingPos);
            
            // 如果在同一列，检查中间是否有其他棋子
            if (blackKingCol === fromCol) {
                let hasPieceBetween = false;
                for (let row = fromRow + 1; row < blackKingRow; row++) {
                    const pos = `${String.fromCharCode(97 + fromCol)}${row}`;
                    if (boardState[pos]) {
                        hasPieceBetween = true;
                        break;
                    }
                }
                
                if (!hasPieceBetween) {
                    return true; // 将帅对脸且中间无子，可以吃对方将帅
                }
            }
        }
    }
    
    // 检查是否在九宫格内
    if (isRed) {
        if (toCol < 3 || toCol > 5 || toRow > 2) {
            return false; // 不在红方九宫格内
        }
    } else {
        if (toCol < 3 || toCol > 5 || toRow < 7) {
            return false; // 不在黑方九宫格内
        }
    }
    
    // 横、纵走一格
    return (colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1);
}

// 炮的走法验证
function isValidPaoMove(fromCol, fromRow, toCol, toRow) {
    // 炮只能横向或纵向移动
    if (fromCol !== toCol && fromRow !== toRow) {
        return false;
    }
    
    // 检查目标位置是否有棋子
    const targetPos = `${String.fromCharCode(97 + toCol)}${toRow}`;
    const hasTargetPiece = boardState[targetPos] !== undefined;
    
    // 计算路径上的棋子数量
    let pieceCount = 0;
    
    if (fromCol === toCol) { // 纵向移动
        const minRow = Math.min(fromRow, toRow);
        const maxRow = Math.max(fromRow, toRow);
        for (let row = minRow + 1; row < maxRow; row++) {
            const pos = `${String.fromCharCode(97 + fromCol)}${row}`;
            if (boardState[pos]) {
                pieceCount++;
            }
        }
    } else { // 横向移动
        const minCol = Math.min(fromCol, toCol);
        const maxCol = Math.max(fromCol, toCol);
        for (let col = minCol + 1; col < maxCol; col++) {
            const pos = `${String.fromCharCode(97 + col)}${fromRow}`;
            if (boardState[pos]) {
                pieceCount++;
            }
        }
    }
    
    // 炮吃子时必须隔一个棋子（炮架）
    if (hasTargetPiece) {
        return pieceCount === 1;
    } else {
        return pieceCount === 0; // 移动时不能有棋子阻挡
    }
}

// 兵/卒的走法验证
function isValidBingMove(fromCol, fromRow, toCol, toRow, isRed) {
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    if (isRed) {
        // 红兵
        if (fromRow < 5) { // 还没过河
            // 只能向前走一格
            return colDiff === 0 && toRow - fromRow === 1;
        } else { // 已经过河
            // 可以向前或左右走一格，不能后退
            if (colDiff === 0) {
                return toRow - fromRow === 1; // 向前一格
            } else if (rowDiff === 0) {
                return colDiff === 1; // 左右一格
            }
        }
    } else {
        // 黑卒
        if (fromRow > 4) { // 还没过河
            // 只能向前走一格
            return colDiff === 0 && fromRow - toRow === 1;
        } else { // 已经过河
            // 可以向前或左右走一格，不能后退
            if (colDiff === 0) {
                return fromRow - toRow === 1; // 向前一格
            } else if (rowDiff === 0) {
                return colDiff === 1; // 左右一格
            }
        }
    }
    
    return false;
}

// 将后端黑方视角的坐标转换为前端红方视角的坐标
function convertCoordinate(pos) {
    const col = pos.charAt(0);
    const row = parseInt(pos.charAt(1));
    
    // 列从'a'到'i'，红黑双方左右是对称的：a对应i，b对应h，依此类推
    const newCol = String.fromCharCode('a'.charCodeAt(0) + ('i'.charCodeAt(0) - col.charCodeAt(0)));
    // 行从0到9，红黑双方上下是对称的：0对应9，1对应8，依此类推
    const newRow = 9 - row;
    
    return newCol + newRow;
}

// 显示AI思考状态
function showAIThinking(message = "AI正在思考...") {
    const aiThinking = document.getElementById('ai-thinking');
    const undoButton = document.getElementById('undo-button');

    if (aiThinking) {
        // 重置进度条动画
        const progressBar = aiThinking.querySelector('.progress-bar');
        if (progressBar) {
            // 重置动画
            progressBar.style.animation = 'none';
            // 触发重排
            void progressBar.offsetWidth;
            // 重新启动动画
            progressBar.style.animation = 'progress-animation 5s linear forwards';
        }
        
        aiThinking.classList.remove('hidden');
    }
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
    }
    if (undoButton) {
        undoButton.disabled = true;
    }
}

// 清除所有上一步高亮
function clearLastMoveHighlight() {
    document.querySelectorAll('.last-move, .last-move-highlight').forEach(element => {
        element.classList.remove('last-move');
        element.classList.remove('last-move-highlight');
    });
}

// 高亮AI的最后一步移动
function highlightLastMove(fromPos, toPos) {
    // 先清除之前的高亮
    clearLastMoveHighlight();
    
    // 高亮起点和终点
    const path = document.createElement('div');
    path.className = 'last-move-path';
    
    // 高亮目标位置的棋子
    const targetPiece = document.querySelector(`[data-position="${toPos}"]`);
    if (targetPiece) {
        targetPiece.classList.add('last-move');
        targetPiece.classList.add('last-move-highlight');
        
        // 5秒后自动移除高亮闪烁效果，但保留基本高亮
        setTimeout(() => {
            if (targetPiece) {
                targetPiece.classList.remove('last-move-highlight');
            }
        }, 5000);
    }
}

// 隐藏AI思考状态
function hideAIThinking() {
    const aiThinking = document.getElementById('ai-thinking');
    // const undoButton = document.getElementById('undo-button'); // No longer handled here

    if (aiThinking) {
        aiThinking.classList.add('hidden');
        
        // 暂停进度条动画
        const progressBar = aiThinking.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.animationPlayState = 'paused';
        }
    }
    const status = document.getElementById('status');
    if (status) {
        status.textContent = "轮到您走棋";
    }
    // if (undoButton) {
    //     undoButton.disabled = false; // Enable undo button -- NO LONGER HANDLED HERE
    // }
}

// 监听窗口大小变化，重新计算棋盘尺寸和棋子位置
window.addEventListener('resize', function() {
    // 添加防抖，避免频繁计算
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(function() {
        calculateBoardDimensions();
        updateAllPiecesPositions();
        // 同样更新所有的合法移动标记
        if (selectedPiece && !isGameOver) { // 游戏结束时不应再显示合法走法
            clearLegalMoveMarkers();
            showLegalMoves(selectedPiece);
        }
    }, 100);
});

async function makeMove(fromPos, toPos) {
    // 1. 乐观前端更新 (Optimistic Frontend Update)
    const movingPieceElement = boardState[fromPos]?.element;

    if (!movingPieceElement) {
        console.error("Optimistic update error: Piece not found at", fromPos, "in local boardState.");
        updateStatus("内部错误：找不到要移动的棋子。");
        return; // 如果找不到棋子，则不继续
    }

    // 处理吃子（视觉上和本地状态）
    const capturedPieceData = boardState[toPos]; // 检查目标位置是否有棋子数据
    if (capturedPieceData && capturedPieceData.element) {
        capturedPieceData.element.remove(); // 从DOM移除被吃棋子
        // boardState[toPos] 将在下面被覆盖或删除
    }

    // 更新移动棋子的视觉位置和 data-position 属性
    positionPieceElement(movingPieceElement, toPos);

    // 更新本地 boardState
    const pieceDataToMove = boardState[fromPos]; // 获取要移动的棋子数据
    delete boardState[fromPos];              // 从旧位置删除
    boardState[toPos] = pieceDataToMove;     // 添加到新位置
    // pieceDataToMove.element 已经是 movingPieceElement，所以不需要重新赋值

    // 玩家的棋子移动后，清除之前的AI高亮，并取消选中
    clearLastMoveHighlight(); 
    // 可以选择高亮玩家的当前走法，但这会被 updateBoardFromServer 很快清除
    // highlightLastMove(fromPos, toPos); // 暂时不高亮玩家的乐观移动，避免闪烁
    deselectPiece(); // 玩家的棋子已"落定"在前端

    // 2. 显示AI思考提示，并向服务器发送移动请求
    showAIThinking();

    try {
        const response = await fetch('/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ move: `${fromPos}${toPos}` }),
        });
        const data = await response.json();
        // hideAIThinking(); // 移至finally块

        console.log("Server response:", data);

        if (response.ok) {
            // 服务器响应是权威状态，使用它更新整个棋盘
            // 这会正确显示AI的走法，并纠正任何与乐观更新不一致的地方
            updateBoardFromServer(data.board);
            updateStatus(data.message);
            
            isGameOver = (data.turn === 'game_over');
            document.getElementById('undo-button').disabled = !data.canUndoAgain;

            if (data.move) { // AI 的实际走法
                highlightLastMove(data.move.substring(0, 2), data.move.substring(2, 4));
            }
            // deselectPiece() 已在乐观更新后调用
        } else {
            updateStatus(data.error || "无效的移动或服务器错误");
            // 如果服务器拒绝了移动（例如，由于更复杂的规则如"被将军"），
            // 并且返回了棋盘状态，则使用该状态回滚前端的乐观更新。
            if (data.board) {
                updateBoardFromServer(data.board); 
                // 此时，可能需要重新让玩家选择，或者提示为什么移动失败
                // updateStatus 已经显示了错误消息。
            } else {
                // 如果服务器出错且未返回棋盘状态，前端的乐观更新可能与实际状态不符
                // 这是一个复杂情况，理想情况下应强制同步或提示用户
                console.error("Move rejected by server, and no board data provided to revert UI. Client state might be inconsistent.");
                // 也可以考虑尝试重新获取棋盘状态
                // await fetchInitialBoardState(); // (假设有这样一个函数)
            }
        }
    } catch (error) {
        // hideAIThinking(); // 移至finally块
        updateStatus("与服务器通信错误");
        console.error("Network error:", error);
        // 网络错误后，前端的乐观更新仍然存在。理想情况下应有回滚机制。
        // alert("网络连接错误，您的操作可能未生效，请尝试刷新或检查网络。");
    } finally {
        hideAIThinking();
    }
}

function updateStatus(message) {
    const status = document.getElementById('status');
    status.textContent = message;
}

function updateBoardFromServer(boardArray) {
    const chessboard = document.querySelector('.chessboard');
    if (!chessboard) return;

    // Clear existing pieces from the board and from boardState
    const existingPieces = chessboard.querySelectorAll('.piece');
    existingPieces.forEach(p => p.remove());
    boardState = {};
    clearLastMoveHighlight();
    deselectPiece();

    boardArray.forEach((rowStr, rowIndex) => {
        for (let colIndex = 0; colIndex < rowStr.length; colIndex++) {
            const char = rowStr[colIndex];
            if (char !== '.') { // If it's a piece
                const pieceDetails = pieceMap[char];
                if (pieceDetails) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${pieceDetails.class}`;
                    // Algebraic position: col 'a'-'i', row 0-9
                    // boardArray has row 0 as black's back rank (visual top, algebraic row 9)
                    // boardArray has row 9 as red's back rank (visual bottom, algebraic row 0)
                    const algebraicRow = 9 - rowIndex;
                    const algebraicCol = String.fromCharCode(97 + colIndex);
                    const position = `${algebraicCol}${algebraicRow}`;
                    
                    pieceElement.setAttribute('data-position', position);
                    pieceElement.textContent = pieceDetails.text;
                    chessboard.appendChild(pieceElement);
                    
                    boardState[position] = {
                        element: pieceElement,
                        type: pieceDetails.class
                    };
                }
            }
        }
    });

    // After adding all pieces, update their visual positions
    calculateBoardDimensions(); // Recalculate dimensions in case of resize
    updateAllPiecesPositions(); // Position new pieces correctly
    console.log("Board updated from server state.");
}

async function handleUndoClick() {
    console.log("Undo button clicked");
    showAIThinking("正在悔棋..."); // Show thinking/loading message
    try {
        const response = await fetch('/undo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        hideAIThinking();

        if (response.ok) {
            isGameOver = false; // After undo, game is no longer over
            updateStatus(data.message || "悔棋成功，轮到您走棋。");
            updateBoardFromServer(data.board);
            deselectPiece(); // Clear selection
            clearLastMoveHighlight(); // Clear any previous move highlight
            document.getElementById('undo-button').disabled = !data.canUndoAgain;
            console.log("Undo successful:", data);
        } else {
            updateStatus(data.error || "悔棋失败。");
            document.getElementById('undo-button').disabled = false; // Re-enable if it failed but was clickable
            console.error("Error undoing move:", data.error);
        }
    } catch (error) {
        hideAIThinking();
        updateStatus("与服务器通信错误，无法悔棋。");
        document.getElementById('undo-button').disabled = false; // Re-enable on network error
        console.error("Network error during undo:", error);
    }
}

// 新增: 处理新游戏按钮点击的函数
async function handleNewGameClick() {
    console.log("New Game button clicked");
    showAIThinking("正在重新开始游戏...");
    try {
        const response = await fetch('/new_game', {
            method: 'POST', // Or 'GET' if your backend is set up for that
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        hideAIThinking();

        if (response.ok) {
            isGameOver = false; 
            updateStatus(data.message || "新游戏已开始，轮到您走棋。");
            updateBoardFromServer(data.board);
            deselectPiece(); 
            clearLastMoveHighlight();
            // Undo button should be disabled at the start of a new game
            document.getElementById('undo-button').disabled = true; 
            console.log("New game started successfully:", data);
        } else {
            updateStatus(data.error || "开始新游戏失败。");
            console.error("Error starting new game:", data.error);
        }
    } catch (error) {
        hideAIThinking();
        updateStatus("与服务器通信错误，无法开始新游戏。");
        console.error("Network error starting new game:", error);
    }
}

// 初始化棋盘（在DOM加载完成后执行）
document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    // Potentially, fetch initial board state from server here instead of relying on HTML
    // Example: fetch('/get_initial_board').then(res => res.json()).then(data => updateBoardFromServer(data.board));
}); 
