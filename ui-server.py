import json, time, re
from http.server import HTTPServer, SimpleHTTPRequestHandler

import elephantfish

class ChessRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        print(f"get option req, path={self.path}")
        self.send_response(200, "ok")
        # self.send_header('Access-Control-Allow-Credentials', 'true')
        # self.send_header('Access-Control-Allow-Origin', '*')
        # self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        # self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        self.end_headers()

    def do_POST(self):
        print(f"get post req, path={self.path}")
        if self.path == '/move':
            # 读取请求体
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            move_data = json.loads(post_data.decode('utf-8'))

            # 获取移动步骤
            move = move_data.get('move')
            if not move:
                self.send_error(400, "Missing move parameter")
                return

            try:
                # 这里调用象棋引擎的代码处理移动并获取 AI 的响应
                print(f"key log: To Process move: {move}")
                ai_message, player_score = process_move(move)
                # print(f"key log: AI move: {ai_move}")

                # 发送响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'move': ai_message, 'score': player_score}).encode('utf-8'))
            except Exception as e:
                self.send_error(500, str(e))

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, ChessRequestHandler)
    print(f"Starting chess server on port {port}...")
    httpd.serve_forever()

hist = [elephantfish.Position(elephantfish.initial, 0)]
searcher = elephantfish.Searcher()

def process_move(input_move):
    """
    处理玩家的移动并返回 AI 的响应和局面评估分数（从玩家视角）
    :param input_move: 字符串，格式如 "h2e2"
    :return: tuple (字符串消息/AI的移动, 玩家视角的评估分数)
    """

    elephantfish.print_pos(hist[-1])

    # hist[-1].score is from the current player's perspective (AI, as it's about to move)
    # If AI has a very high score, it means player made a mistake and is about to be checkmated or lose material badly.
    # Note: The original sunfish MATE_LOWER was a large negative, MATE_UPPER large positive.
    # Here, if hist[-1].score (AI's perspective) is very high (e.g., MATE_UPPER), it's good for AI.
    # The check `hist[-1].score <= -elephantfish.MATE_LOWER` seems to be from a version where scores might be flipped
    # or MATE_LOWER was positive. Given elephantfish.py, MATE_LOWER is negative.
    # Let's use MATE_UPPER for AI winning, MATE_LOWER for AI losing.
    # If hist[-1].score (AI's perspective) >= elephantfish.MATE_UPPER, AI has won. Player lost.
    if hist[-1].score >= elephantfish.MATE_UPPER: # Check if AI already has a winning position
        return ("You lost (AI has winning line)", -elephantfish.MATE_UPPER)


    print(f"key log: input_move: {input_move}")
    match = re.match('([a-i][0-9])'*2, input_move)
    if not match:
        return ("Please enter a move like h2e2", 0) # Neutral score for input error
    move = elephantfish.parse(match.group(1)), elephantfish.parse(match.group(2))
    
    # gen_moves generates moves for the current player (which is Red/Player here, as hist[-1] is before player's move is applied and rotated)
    # So, hist[-1] here is from Player's perspective if we consider it *before* rotation for AI's turn.
    # Let's clarify: hist is a list of positions. hist[-1] is the *current* board state.
    # elephantfish.py has score from the perspective of player whose turn it is.
    # Initial board: hist = [Position(..., 0)] (score 0, Red to move)
    # Player moves: new_pos = hist[-1].move(player_move) -> this rotates, score is now Black's view. hist.append(new_pos)
    # So, before AI search, hist[-1].score IS from Black's (AI's) perspective.

    # Check if player's move is valid for the current board state (hist[-1] before player's move is applied)
    # This requires a temporary position or checking moves from player's perspective.
    # The current hist[-1] is from AI's perspective if a game is ongoing.
    # Let's assume print_pos shows the board correctly for the player to see.
    # The move generation needs to be for the player (Red).
    # The `hist[-1].gen_moves()` in elephantfish.py generates for whosever pieces are 'uppercase' if it's their turn.
    # The `initial` board has 'RNBAKABNR' as uppercase.
    # When player (Red) makes a move, `hist[-1].move(move)` is called. Inside `move`, it does `board = put(board, j, board[i])`
    # then `return Position(board, score).rotate()`. This `rotate()` swaps cases and negates score.
    # So, after player's move, the new position in `hist` will have black pieces as uppercase, and score from black's view.
    
    # Simplification for move validation: The original code had this check after attempting to apply the move.
    # We should check if the move is valid for Red on the *current* board before AI's turn.
    # The `hist[-1]` before `hist.append(hist[-1].move(move))` is the state where it's player's turn.
    # But the code structure is: player makes move -> it's validated -> AI moves.
    # The `hist[-1]` when `process_move` is called is the state *after* AI's last move, rotated, so it's Player's (Red's) turn. Score is from Red's view.

    player_pos = hist[-1] # Score is from Player's (Red's) perspective
    if move not in player_pos.gen_moves(): # gen_moves() on player_pos should generate Red's moves
        return ("ErrInvalidMove", player_pos.score) # Return current player's score

    print(f"key log: input move is valid")
    hist.append(player_pos.move(move)) # This new hist[-1] is now from AI's (Black's) perspective

    # After our move we rotate the board and print it again.
    # This allows us to see the effect of our move.
    # elephantfish.print_pos(hist[-1].rotate()) # This rotate is for display if AI was to play next.
                                             # hist[-1] is already from AI's perspective.
    elephantfish.print_pos(hist[-1]) # Print board from AI's perspective (as it is in hist[-1])


    # Check if player's move resulted in a win for the player (checkmate against AI)
    # hist[-1].score is from AI's (Black's) perspective.
    # AI is checkmated if its score is extremely low (e.g., -MATE_UPPER or less).
    # The original MATE_LOWER from elephantfish.py (a positive value) seems incorrect for this check.
    if hist[-1].score <= -elephantfish.MATE_UPPER: # If AI's score is less than or equal to negative MATE_UPPER
        return ("You won", elephantfish.MATE_UPPER) # Player's score is MATE_UPPER

    # Fire up the engine to look for a move. AI's turn now.
    # searcher.search is on hist[-1] (AI's perspective)
    start = time.time()
    ai_move_tuple = None
    final_ai_score = 0 # This will be from AI's perspective

    for _depth, current_ai_move_tuple, current_ai_score in searcher.search(hist[-1], hist):
        ai_move_tuple = current_ai_move_tuple
        final_ai_score = current_ai_score
        if time.time() - start > elephantfish.THINK_TIME:
            break
    
    if ai_move_tuple is None: # Should not happen if game is not over
        return ("AI Error: No move found", 0)

    # final_ai_score is from AI's perspective.
    # If AI checkmates player, final_ai_score will be MATE_UPPER.
    if final_ai_score >= elephantfish.MATE_UPPER:
        print("Checkmate! AI wins.")
    
    # The black player moves from a rotated position, so we have to
    # 'back rotate' the move before printing it.
    # The `ai_move_tuple` is already in the correct board representation (absolute indices).
    # render() converts index to algebraic.
    ai_move_str = elephantfish.render(ai_move_tuple[0]) + elephantfish.render(ai_move_tuple[1])
    
    # Store the score from AI's perspective along with its depth and move.
    print("Think depth: {} My move: {} AI_Score: {}".format(_depth, ai_move_str, final_ai_score))
    
    hist.append(hist[-1].move(ai_move_tuple)) # new hist[-1] is now from Player's (Red's) perspective

    # The score to return to frontend should be from Player's perspective.
    # After AI moves and board is rotated (inside .move()), hist[-1].score is Player's score.
    player_perspective_score_after_ai_move = hist[-1].score
    
    # However, the 'final_ai_score' from search is more direct evaluation of AI's chosen move from AI's view.
    # So, player's view of that state is -final_ai_score.
    # Let's use the score of the position AFTER AI's move, which is hist[-1].score (Player's view)
    
    print_pos_for_player = hist[-1] # This is after AI's move, score is from player's (Red's) view.
    elephantfish.print_pos(print_pos_for_player) # Print board for player to see

    return ai_move_str, print_pos_for_player.score

if __name__ == '__main__':
    run_server()

