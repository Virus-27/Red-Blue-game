from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from db.database import SessionLocal
from models import Game
from websocket import broadcast

router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.post("/move/{game_id}")
async def make_move(game_id: str, move_data: dict, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game:
        raise HTTPException(404, "Game not found")
        
    player, choice = move_data.get("player"), move_data.get("choice")
    
    game.current_choice[player] = choice
    flag_modified(game, "current_choice")

    if game.current_choice["RED"] and game.current_choice["BLUE"]:
        r, b = game.current_choice["RED"], game.current_choice["BLUE"]
        m = 2 if game.round >= 9 else 1
        
        if r == "RED" and b == "RED":
            game.score["RED"] -= 3*m; game.score["BLUE"] -= 3*m
        elif r == "BLUE" and b == "BLUE":
            game.score["RED"] += 3*m; game.score["BLUE"] += 3*m
        elif r == "BLUE" and b == "RED":
            game.score["RED"] += 6*m; game.score["BLUE"] -= 6*m
        else:
            game.score["RED"] -= 6*m; game.score["BLUE"] += 6*m

        round_details = {"round": game.round, "RED": r, "BLUE": b}
        game.history.append(round_details)
        
        saved_choices_for_broadcast = {"RED": r, "BLUE": b}
        
        game.current_choice = {"RED": None, "BLUE": None}
        game.chat_enabled = False 

        # Check for game over
        if game.round >= 10:
            game.status = "finished"
            winner = "DRAW"
            if game.score["RED"] > game.score["BLUE"]: winner = "RED"
            elif game.score["BLUE"] > game.score["RED"]: winner = "BLUE"
            
            flag_modified(game, "score")
            flag_modified(game, "history")
            db.commit()

            await broadcast(game_id, {
                "type": "game_over",
                "winner": winner,
                "score": game.score,
                "status": "finished",
                "history": game.history,
                "choices": saved_choices_for_broadcast
            })
            return {"status": "game_over"}

        if game.round == 4 or game.round == 8:
            game.status = "prompt_discussion"
            game.discussion_votes = {"RED": None, "BLUE": None}
        else:
            game.round += 1
            game.status = "in_progress"

        flag_modified(game, "score")
        flag_modified(game, "history")
        flag_modified(game, "discussion_votes")
        db.commit()

        await broadcast(game_id, {
            "type": "update", 
            "status": game.status, 
            "score": game.score, 
            "round": game.round,
            "reset_selection": True,
            "choices": saved_choices_for_broadcast,
            "history": game.history,
            "discussion_votes": game.discussion_votes
        })
    else:
        db.commit()
        
    return {"status": "ok"}
@router.post("/reset/{game_id}")
async def reset_game(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    
    if not game:
        return {"status": "error", "message": "Game not found"}

    game.round = 1
    game.status = "in_progress"
    game.score = {"RED": 0, "BLUE": 0}
    game.history = []
    game.current_choice = {"RED": None, "BLUE": None}
    game.discussion_votes = {"RED": None, "BLUE": None}
    game.chat_enabled = False
    flag_modified(game, "score")
    flag_modified(game, "history")
    flag_modified(game, "current_choice")
    flag_modified(game, "discussion_votes")
    db.commit()
    fresh_payload = {
        "type": "update",
        "status": "in_progress",
        "round": 1,
        "score": {"RED": 0, "BLUE": 0},
        "history": [],
        "reset_selection": True
    }
    await broadcast(game_id, fresh_payload)
    
    return {"status": "success", "message": "Game state fully wiped on server"}