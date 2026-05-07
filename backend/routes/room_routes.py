from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models import Game
from websocket import broadcast
import random

router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def generate_short_id(length=6):
    return ''.join(random.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(length))

@router.post("/create")
async def create_game(db: Session = Depends(get_db)):
    new_id = generate_short_id()
    new_game = Game(
        id=new_id,
        status="waiting",
        players={"RED": "Player1", "BLUE": None},
        score={"RED": 0, "BLUE": 0},
        round=1,
        history=[],
        discussion_votes={"RED": None, "BLUE": None}
    )
    db.add(new_game)
    db.commit()
    db.refresh(new_game)
    return {"game_id": new_id}

@router.post("/join/{game_id}")
async def join_game(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game: raise HTTPException(404, "Game not found")
    
    if game.players["BLUE"] is None:
        game.players["BLUE"] = "Player2"
        game.status = "in_progress"
        color = "BLUE"
    else:
        raise HTTPException(400, "Game full")

    db.commit()
    await broadcast(game_id, {"type": "update", "status": game.status, "players": game.players})
    return {"color": color}
@router.get("/state/{game_id}")
async def get_game_state(game_id: str, db: Session = Depends(get_db)):
    # Look up the game in the database
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    # Return the current data structure
    return {
        "id": game.id,
        "status": game.status,
        "players": game.players,
        "score": game.score,
        "round": game.round,
        "history": game.history,
        "chat_enabled": game.chat_enabled,
        "current_choice": game.current_choice
    }