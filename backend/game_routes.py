from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from db.database import SessionLocal
from models import Game
from websocket import broadcast
import uuid
import random
from pydantic import BaseModel

class MoveRequest(BaseModel):
    player: str  # "RED" or "BLUE"
    choice: str  # "RED" or "BLUE"

class WithdrawRequest(BaseModel):
    player: str
    
router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def generate_short_id(length=6):
    # Generates a code like 'XJ92K4' (Excludes confusing letters like O, 0, I, 1)
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return ''.join(random.choice(chars) for _ in range(length))

@router.post("/create")
async def create_game(db: Session = Depends(get_db)):
    new_id = generate_short_id()
    
    new_game = Game(
        id=new_id,
        status="waiting",
        # Pre-assign RED to the creator so the slot is taken
        players={"RED": "Player1", "BLUE": None}, 
        score={"RED": 0, "BLUE": 0},
        round=1,
        current_choice={"RED": None, "BLUE": None},
        history=[]
    )
    db.add(new_game)
    db.commit()
    
    return {"game_id": new_id}

@router.post("/join/{game_id}")
async def join_game(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(404, "Game not found")

    if game.players["RED"] is None:
        game.players["RED"] = "Player1"
        color = "RED"
    elif game.players["BLUE"] is None:
        game.players["BLUE"] = "Player2"
        game.status = "in_progress" # Update status to unlock Player 1
        color = "BLUE"
    else:
        raise HTTPException(400, "Game full")

    flag_modified(game, "players")
    db.commit()
    db.refresh(game)

    await broadcast(game_id, {
        "type": "update",
        "status": game.status,
        "players": game.players,
        "round": game.round,
        "score": game.score,
        "history": game.history
    })
    
    return {"color": color}

@router.post("/move/{game_id}")
async def move(game_id: str, move_data: dict, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game or game.status != "in_progress":
        raise HTTPException(400, "Game not active")

    player = move_data.get("player", "").upper()
    choice = move_data.get("choice", "").upper()

    if game.current_choice[player]:
        raise HTTPException(400, "Move already made")

    game.current_choice[player] = choice
    flag_modified(game, "current_choice")

    # Resolve round if both players have moved
    if game.current_choice["RED"] and game.current_choice["BLUE"]:
        red, blue = game.current_choice["RED"], game.current_choice["BLUE"]
        mult = 2 if game.round >= 9 else 1
        
        # Scoring Logic
        if red == "RED" and blue == "RED":
            game.score["RED"] += 3 * mult
            game.score["BLUE"] += 3 * mult
        elif red == "BLUE" and blue == "BLUE":
            game.score["RED"] -= 3 * mult
            game.score["BLUE"] -= 3 * mult
        elif red == "BLUE" and blue == "RED":
            game.score["RED"] += 6 * mult
            game.score["BLUE"] -= 6 * mult
        else: # RED vs BLUE
            game.score["RED"] -= 6 * mult
            game.score["BLUE"] += 6 * mult

        game.history.append({"round": game.round, "RED": red, "BLUE": blue})
        game.current_choice = {"RED": None, "BLUE": None}
        game.round += 1

        if game.round > 10:
            game.status = "finished"
            db.commit()
            
            # Determine winner
            winner = "DRAW"
            if game.score["RED"] > game.score["BLUE"]:
                winner = "RED"
            elif game.score["BLUE"] > game.score["RED"]:
                winner = "BLUE"

            # Broadcast Game Over
            await broadcast(game_id, {
                "type": "game_over", 
                "winner": winner, 
                "score": game.score
            })
            return {"status": "game_over", "winner": winner}

        elif game.round in [5, 9]:
            game.status = "discussion"
        else:
            game.status = "in_progress"

        flag_modified(game, "score")
        flag_modified(game, "history")
        flag_modified(game, "current_choice")
        db.commit()

        await broadcast(game_id, {
            "type": "update", 
            "round": game.round, 
            "score": game.score, 
            "status": game.status,
            "reset_selection": True 
        })
        
    else:
     
        db.commit()

    return {"status": "success"}


@router.post("/withdraw/{game_id}")
async def withdraw(game_id: str, data: dict, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game or game.status == "finished":
        raise HTTPException(400, "Game not active")

    withdrawing_player = data.get("player") # "RED" or "BLUE"
    winner = "BLUE" if withdrawing_player == "RED" else "RED"

    game.status = "finished"
    db.commit()

    # Broadcast game over immediately
    await broadcast(game_id, {
        "type": "game_over",
        "winner": winner,
        "reason": f"{withdrawing_player} withdrew from the game.",
        "score": game.score
    })
    
    return {"status": "success"}
@router.get("/state/{game_id}")
def get_state(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(404, "Game not found")
    return game