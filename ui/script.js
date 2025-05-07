let ws;
let selectedPiece = null; // 当前选中的棋子
const GRID_SIZE = 80;  // 格子大小
const BOARD_PADDING = 40;  // 棋盘边距
let legalMoveMarkers = []; // 存储合法移动标记的数组

// 棋盘状态
let boardState = {};

function initializeBoard() {
    const chessboard = document.querySelector('.chessboard');
    const pieces = document.querySelectorAll('.piece');

    // 初始化棋盘状态
    boardState = {};

    // 初始化棋子位置
    pieces.forEach(piece => {
        const position = piece.getAttribute('data-position');
        if (position) {
            const [col, row] = position.split('');
            const x = col.charCodeAt(0) - 'a'.charCodeAt(0);
            const y = parseInt(row);
            
            piece.style.left = `${BOARD_PADDING + x * GRID_SIZE}px`;
            piece.style.top = `${BOARD_PADDING + (9 - y) * GRID_SIZE}px`;
            // 确保棋子在最上层
            piece.style.zIndex = "100";
            
            // 更新棋盘状态
            boardState[position] = {
                element: piece,
                type: piece.className.split(' ')[1]
            };
        }
    });

    // 确保棋盘网格在底层
    const boardGrid = document.querySelector('.board-grid');
    if (boardGrid) {
        boardGrid.style.zIndex = "1";
    }

    // 移除所有现有的点击事件
    document.removeEventListener('click', handleGlobalClick, true);
    
    // 在document级别添加一个捕获阶段的点击事件处理器
    document.addEventListener('click', handleGlobalClick, true);
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
    console.log("handleBoardClick processing");
    if (!selectedPiece) return;

    const chessboard = document.querySelector('.chessboard');
    const rect = chessboard.getBoundingClientRect();
    
    let x, y;
    // 如果点击的是合法移动标记
    if (event.target.classList.contains('legal-move-marker')) {
        const pos = event.target.getAttribute('data-position');
        const [col, row] = pos.split('');
        const toPos = pos;
        const fromPos = selectedPiece.getAttribute('data-position');
        
        if (isLegalMove(selectedPiece, fromPos, toPos)) {
            makeMove(fromPos, toPos);
        }
        return;
    }
    
    x = event.clientX - rect.left - BOARD_PADDING;
    y = event.clientY - rect.top - BOARD_PADDING;

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

async function makeMove(fromPos, toPos) {
    console.log(`Moving piece from ${fromPos} to ${toPos}`);
    
    // 移动玩家的棋子
    const movingPiece = document.querySelector(`[data-position="${fromPos}"]`);
    const targetPiece = document.querySelector(`[data-position="${toPos}"]`);
    
    if (targetPiece) {
        targetPiece.remove();
        // 更新棋盘状态
        delete boardState[toPos];
    }
    
    movingPiece.setAttribute('data-position', toPos);
    
    const col = toPos.charCodeAt(0) - 97;
    const row = 9 - parseInt(toPos.slice(1));
    
    movingPiece.style.left = `${col * GRID_SIZE + BOARD_PADDING}px`;
    movingPiece.style.top = `${row * GRID_SIZE + BOARD_PADDING}px`;
    
    // 更新棋盘状态
    boardState[toPos] = boardState[fromPos];
    delete boardState[fromPos];
    
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        selectedPiece = null;
        clearLegalMoveMarkers();
    }

    // 发送移动到 elephantfish 引擎并等待 AI 的响应
    try {
        const move = `${fromPos}${toPos}`;  // 例如 "h2e2"
        const response = await fetch('http://localhost:8000/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ move: move })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();  // 解析 JSON 响应
        const aiMove = data.move;  // 从 JSON 响应中获取移动
        
        if (aiMove) {
            // 解析AI的移动 (例如 "h0g2")
            const aiFromPosBackend = aiMove.substring(0, 2);
            const aiToPosBackend = aiMove.substring(2, 4);
            
            // 将后端黑方视角的坐标转换为前端红方视角的坐标
            const aiFromPos = convertCoordinate(aiFromPosBackend);
            const aiToPos = convertCoordinate(aiToPosBackend);
            
            console.log(`AI moves from ${aiFromPosBackend} to ${aiToPosBackend} (后端坐标)`);
            console.log(`AI moves from ${aiFromPos} to ${aiToPos} (前端坐标)`);
            
            // 延迟一小段时间后执行AI的移动，让玩家能看清楚
            setTimeout(() => {
                // 使用转换后的坐标查找棋子
                const aiPiece = document.querySelector(`[data-position="${aiFromPos}"]`);
                if (!aiPiece) {
                    console.error(`找不到位于 ${aiFromPos} 的AI棋子`);
                    // 检查所有棋子，帮助调试
                    document.querySelectorAll('.piece').forEach(p => {
                        console.log(`棋子位置: ${p.getAttribute('data-position')}, 类型: ${p.className}`);
                    });
                    return;
                }
                
                console.log(`找到AI棋子: ${aiPiece.textContent}, 类型: ${aiPiece.className}`);
                
                const aiTargetPiece = document.querySelector(`[data-position="${aiToPos}"]`);
                
                if (aiTargetPiece) {
                    aiTargetPiece.remove();
                    // 更新棋盘状态
                    delete boardState[aiToPos];
                }
                
                if (aiPiece) {
                    aiPiece.setAttribute('data-position', aiToPos);
                    
                    const aiCol = aiToPos.charCodeAt(0) - 97;
                    const aiRow = 9 - parseInt(aiToPos.slice(1));
                    
                    aiPiece.style.left = `${aiCol * GRID_SIZE + BOARD_PADDING}px`;
                    aiPiece.style.top = `${aiRow * GRID_SIZE + BOARD_PADDING}px`;
                    
                    // 更新棋盘状态
                    boardState[aiToPos] = boardState[aiFromPos];
                    delete boardState[aiFromPos];
                }
            }, 500);  // 500ms 延迟
        }
    } catch (error) {
        console.error('Error:', error);
        alert('与象棋引擎通信时出错，请确保 elephantfish 服务正在运行');
    }
}

function updateStatus(message, color) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = color;
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
    initializeBoard();
}); 
