import json
import time
import re
import os # Import os for path manipulation
from flask import Flask, request, jsonify, send_from_directory # Import send_from_directory
from flask_cors import CORS # Import CORS

# Assuming elephantfish.py is in the same directory or accessible in PYTHONPATH
import elephantfish

# Define the path to the 'ui' directory relative to this app.py file
# This assumes app.py is in the project root, and 'ui' is a subdirectory.
UI_FOLDER = os.path.join(os.path.dirname(__file__), 'ui')

app = Flask(__name__, static_folder=UI_FOLDER, static_url_path='/ui')
# By setting static_folder=UI_FOLDER and static_url_path='/ui',
# requests to /ui/script.js will serve UI_FOLDER/script.js
# requests to /ui/styles.css will serve UI_FOLDER/styles.css

CORS(app) # Enable CORS for all routes and origins by default

# --- Helper function from ui-server.py --- (Or import if structured as a module)
def convert_board_to_frontend_format(board_string_256):
    playable_board_rows = []
    for i in range(3, 13): # 10 rows
        row_start_index = i * 16 + 3
        row_end_index = row_start_index + 9
        playable_board_rows.append(board_string_256[row_start_index:row_end_index])
    return playable_board_rows

# --- Game state and AI Searcher (Global for simplicity in this example) ---
# In a production app, you might manage state differently (e.g., per session, or a more robust global store)
hist = [elephantfish.Position(elephantfish.initial, 0)]
searcher = elephantfish.Searcher()

# --- Core game logic function (adapted from ui-server.py's process_move) ---
def process_player_move(player_move_str):
    global hist, searcher

    # elephantfish.print_pos(hist[-1]) # Log current position before player's move

    # Check if AI already has a winning position (or player has lost based on current board for AI)
    # This check was originally for hist[-1] which was AI's turn to move.
    # Here, hist[-1] is player's turn to move.
    # We should check for game over conditions *after* player's move is applied and *after* AI's move is applied.

    match = re.match('([a-i][0-9])'*2, player_move_str)
    if not match:
        return jsonify({'error': "Please enter a move like h2e2", 'board': convert_board_to_frontend_format(hist[-1].board), 'score': hist[-1].score, 'canUndoAgain': len(hist) > 2}), 400
    
    parsed_move = elephantfish.parse(match.group(1)), elephantfish.parse(match.group(2))
    
    player_pos = hist[-1] # Current position, player (Red) to move
    if parsed_move not in player_pos.gen_moves():
        return jsonify({'error': "Invalid move", 'board': convert_board_to_frontend_format(player_pos.board), 'score': player_pos.score, 'canUndoAgain': len(hist) > 2}), 400

    print(f"Key log: Player move '{player_move_str}' is valid")
    hist.append(player_pos.move(parsed_move)) # Apply player's move. New hist[-1] is AI's (Black's) turn.
    # elephantfish.print_pos(hist[-1]) # Log position after player's move (AI's perspective)

    # Check if player's move resulted in a win for the player (checkmate against AI)
    # hist[-1].score is from AI's (Black's) perspective.
    if hist[-1].score <= -elephantfish.MATE_UPPER:
        current_board_state = convert_board_to_frontend_format(hist[-1].rotate().board) # Rotate back for player's view of final board
        return jsonify({
            'message': "You won! (AI is checkmated)", 
            'move': None, # AI makes no move
            'score': elephantfish.MATE_UPPER, # Player's score
            'board': current_board_state,
            'turn': 'game_over',
            'winner': 'player',
            'canUndoAgain': len(hist) > 2
        }), 200

    # AI's turn
    ai_pos = hist[-1] # AI (Black) to move
    start_time = time.time()
    ai_move_tuple = None
    final_ai_score_from_search = 0 # From AI's perspective, initialize to a non-mate score

    for _depth, current_ai_move_tuple, current_ai_score in searcher.search(ai_pos, hist):
        ai_move_tuple = current_ai_move_tuple
        final_ai_score_from_search = current_ai_score # Capture the score from search
        if time.time() - start_time > elephantfish.THINK_TIME:
            print(f"AI think time limit reached at depth {_depth}")
            break
    
    if ai_move_tuple is None:
        # This case means AI has no moves. Could be checkmated by player or stalemated.
        # We'll rely on the player win condition check after player's move for checkmate detection by player.
        # For now, if search returns no move, treat as an error or potential stalemate (not fully handled here yet).
        return jsonify({'error': "AI Error: No move found or AI is stalemated/checkmated (player might have won)", 'board': convert_board_to_frontend_format(ai_pos.rotate().board), 'score': -ai_pos.score, 'canUndoAgain': len(hist) > 2}), 500

    # ai_move_tuple contains (from_sq_AI_pov, to_sq_AI_pov) which are indices on the AI's rotated board.
    # We need to convert these to absolute board indices (Red's POV, standard board) before rendering.
    # The rotation effect is: rotated_board[k] corresponds to original_board[254-k].
    from_sq_absolute = 254 - ai_move_tuple[0]
    to_sq_absolute = 254 - ai_move_tuple[1]

    ai_move_str = elephantfish.render(from_sq_absolute) + elephantfish.render(to_sq_absolute)
    # Original line: ai_move_str = elephantfish.render(ai_move_tuple[0]) + elephantfish.render(ai_move_tuple[1])
    print(f"Key log: AI move (rotated POV): {elephantfish.render(ai_move_tuple[0]) + elephantfish.render(ai_move_tuple[1])}, AI move (absolute POV): {ai_move_str}")
    
    hist.append(ai_pos.move(ai_move_tuple)) # Apply AI's move. New hist[-1] is Player's (Red's) turn.
    # elephantfish.print_pos(hist[-1]) # Log position after AI's move (Player's perspective)

    # Check if AI's move resulted in a win for AI (checkmate against player)
    # hist[-1].score is from Player's (Red's) perspective. If very low, player is checkmated.
    # final_player_score = hist[-1].score # Previous way
    ai_response_message = "AI moved. Your turn."
    game_turn_status = 'player' # Default
    winner_status = None      # Default

    # Use the score from AI's search to determine if AI checkmated the player.
    # final_ai_score_from_search is from AI's perspective.
    if final_ai_score_from_search >= elephantfish.MATE_UPPER: # AI believes it has checkmated the player
        ai_response_message = "AI wins! You are checkmated."
        game_turn_status = 'game_over' # CHANGED
        winner_status = 'ai'         # ADDED

    board_for_frontend = convert_board_to_frontend_format(hist[-1].board)
    displayed_player_score = hist[-1].score # This is the actual score of the board from player's perspective for display
    
    response_data = {
        'message': ai_response_message,
        'move': ai_move_str, 
        'score': displayed_player_score, # Use the actual board score for display
        'board': board_for_frontend,
        'turn': game_turn_status, # Use the updated status
        'canUndoAgain': len(hist) > 2
    }
    if winner_status:
        response_data['winner'] = winner_status
    
    return jsonify(response_data), 200

@app.route('/') # Route for the main game page
def game_page():
    # Serves chess.html from the UI_FOLDER (which is 'ui')
    return send_from_directory(UI_FOLDER, 'chess.html')

@app.route('/new_game', methods=['POST', 'GET']) # Allow GET for easy browser testing too
def new_game():
    global hist, searcher
    hist = [elephantfish.Position(elephantfish.initial, 0)]
    searcher = elephantfish.Searcher() # Re-initialize searcher if it has internal state like transposition tables
    print("Key log: New game started.")
    
    initial_pos = hist[0]
    board_for_frontend = convert_board_to_frontend_format(initial_pos.board)
    
    return jsonify({
        'message': 'New game started. Your turn.',
        'board': board_for_frontend,
        'score': initial_pos.score, 
        'turn': 'player',
        'canUndoAgain': False # Cannot undo at the start
    }), 200

@app.route('/move', methods=['POST'])
def handle_move():
    data = request.get_json()
    if not data or 'move' not in data:
        return jsonify({'error': 'Missing move parameter'}), 400
    
    player_move_str = data['move']
    print(f"Key log: Received /move request for: {player_move_str}")
    
    response, status_code = process_player_move(player_move_str)
    return response, status_code

@app.route('/undo', methods=['POST'])
def handle_undo():
    global hist
    print("Key log: Received /undo request")

    if len(hist) > 2: # Need at least initial + 1 player move + 1 AI move to undo a pair
        hist.pop()  # Remove AI's last move state
        hist.pop()  # Remove Player's last move state
        
        current_pos = hist[-1] # This is now the state where it's player's turn again
        board_for_frontend = convert_board_to_frontend_format(current_pos.board)
        can_undo_again = len(hist) > 2
        
        print(f"Key log: Undo successful. New hist length: {len(hist)}.")
        # elephantfish.print_pos(current_pos)
        
        return jsonify({
            'message': 'Undo successful. Your turn.',
            'board': board_for_frontend,
            'score': current_pos.score, 
            'turn': 'player',
            'canUndoAgain': can_undo_again
        }), 200
    else:
        error_message = "Cannot undo further."
        current_board_for_frontend = convert_board_to_frontend_format(hist[-1].board)
        current_score = hist[-1].score

        if len(hist) <= 1:
            error_message = "Game at initial state, cannot undo."
        elif len(hist) == 2:
            error_message = "Cannot undo until AI has also made a move."
        
        print(f"Key log: Cannot undo. Hist length: {len(hist)}.")
        return jsonify({
            'error': error_message,
            'board': current_board_for_frontend, # Still send current board
            'score': current_score,
            'turn': 'player',
            'canUndoAgain': False
        }), 400

if __name__ == '__main__':
    # For local testing with WeChat DevTools, use 0.0.0.0 to make it accessible on your local network
    # The default port for Flask is 5000.
    # Make sure your computer's firewall allows connections to this port if testing from another device.
    app.run(host='0.0.0.0', port=5001, debug=True) 