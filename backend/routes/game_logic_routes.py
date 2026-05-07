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
        # 1. SCORING ENGINE
        r, b = game.current_choice["RED"], game.current_choice["BLUE"]
        m = 2 if game.round >= 9 else 1
        
        if r == "RED" and b == "RED":
            game.score["RED"] += 3*m; game.score["BLUE"] += 3*m
        elif r == "BLUE" and b == "BLUE":
            game.score["RED"] -= 3*m; game.score["BLUE"] -= 3*m
        elif r == "BLUE" and b == "RED":
            game.score["RED"] += 6*m; game.score["BLUE"] -= 6*m
        else:
            game.score["RED"] -= 6*m; game.score["BLUE"] += 6*m

        game.history.append({"round": game.round, "RED": r, "BLUE": b})
        game.current_choice = {"RED": None, "BLUE": None}
        game.chat_enabled = False 

        # 2. CHECK FOR GAME OVER BEFORE INCREMENTING UI
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
                "history": game.history
            })
            return {"status": "game_over"}

        # 3. IF GAME CONTINUES, INCREMENT ROUND
        game.round += 1
        game.status = "discussion" if game.round in [5, 9] else "in_progress"

        flag_modified(game, "score")
        flag_modified(game, "history")
        db.commit()
        
        await broadcast(game_id, {
            "type": "update", 
            "status": game.status, 
            "score": game.score, 
            "round": game.round,
            "chat_enabled": False,
            "reset_selection": True
        })
    else:
        db.commit()
        
    return {"status": "ok"}
