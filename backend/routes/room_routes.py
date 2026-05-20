from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models import Game
from websocket import broadcast, connections
import random

router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def generate_short_id(length=6):
    return ''.join(random.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(length))

@router.post("/create")
async def create_game(nickname: str, db: Session = Depends(get_db)):
    new_id = generate_short_id()
    new_game = Game(
        id=new_id,
        status="waiting",
        players={"RED": nickname, "BLUE": None},
        score={"RED": 0, "BLUE": 0},
        round=1,
        history=[],
        discussion_votes={"RED": None, "BLUE": None}
    )
    db.add(new_game)
    db.commit()
    db.refresh(new_game)
    return {"game_id": new_id}

@router.post("/rejoin/{game_id}")
async def rejoin_game(game_id: str, db: Session = Depends(get_db)):
    room_id = game_id.upper()
    game = db.query(Game).filter(Game.id == room_id).first()
    if not game:
        raise HTTPException(404, "Game not found")
    if game.status in ["finished", "game_over", "abandoned"]:
        raise HTTPException(400, "Match has already finished or been abandoned")
        
    active_room = connections.get(room_id)
    if not active_room:
        raise HTTPException(400, "Game session is inactive or has timed out")
        
    sockets = active_room.get("sockets", {"RED": None, "BLUE": None})
    players_details = active_room.get("players_details", {"RED": None, "BLUE": None})
    
    rejoin_role = None
    if sockets.get("RED") is None and sockets.get("BLUE") is not None:
        rejoin_role = "RED"
    elif sockets.get("BLUE") is None and sockets.get("RED") is not None:
        rejoin_role = "BLUE"
    else:
        raise HTTPException(400, "Cannot resolve rejoin slot or room is fully occupied")
        
    nickname = game.players.get(rejoin_role)
    details = players_details.get(rejoin_role, {"face": "🐱", "hat": "❌"}) if players_details else {"face": "🐱", "hat": "❌"}
    if details is None:
        details = {"face": "🐱", "hat": "❌"}
        
    return {
        "status": "rejoined",
        "color": rejoin_role,
        "nickname": nickname,
        "face": details.get("face", "🐱"),
        "hat": details.get("hat", "❌"),
        "players": game.players,
        "score": game.score,
        "round": game.round,
        "history": game.history,
        "game_status": game.status
    }

@router.post("/join/{game_id}")
async def join_game(game_id: str, nickname: str, db: Session = Depends(get_db)):
    room_id = game_id.upper()
    game = db.query(Game).filter(Game.id == room_id).first()
    if not game:
        raise HTTPException(404, "Game not found")
    if game.status in ["finished", "game_over", "abandoned"]:
        raise HTTPException(400, "Match has already finished or been abandoned")
        
    if game.players["BLUE"] is None:
        game.players["BLUE"] = nickname
        game.status = "in_progress"
        color = "BLUE"
    else:
        raise HTTPException(400, "Game full or slot occupied")
        
    db.commit()
    await broadcast(room_id, {
        "type": "update",
        "status": game.status,
        "players": game.players,
        "score": game.score,
        "round": game.round,
        "history": game.history
    })
    return {
        "status": "joined",
        "color": color,
        "players": game.players
    }

@router.get("/state/{game_id}")
async def get_game_state(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
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