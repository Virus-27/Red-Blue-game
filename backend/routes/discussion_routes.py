from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from models import Game
from db.database import SessionLocal
from websocket import broadcast
import time

router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.post("/discussion/{game_id}")
async def discussion_vote(game_id: str, vote_data: dict, db: Session = Depends(get_db)):
    player = vote_data.get("player", "").upper()
    vote = vote_data.get("vote")
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game:
        raise HTTPException(404, "Game not found")
        
    votes = dict(game.discussion_votes) if game.discussion_votes else {"RED": None, "BLUE": None}
    votes[player] = vote
    game.discussion_votes = votes
    flag_modified(game, "discussion_votes")
    db.commit()
    db.refresh(game)
    
    chat_end_time = None
    if game.discussion_votes.get("RED") is not None and game.discussion_votes.get("BLUE") is not None:
        if game.discussion_votes["RED"] is True and game.discussion_votes["BLUE"] is True:
            game.chat_enabled = True
            game.status = "discussion"
            chat_end_time = time.time() + 60
        else:
            game.chat_enabled = False
            game.status = "discussion_refused"
            game.round += 1
            game.discussion_votes = {"RED": None, "BLUE": None}
            flag_modified(game, "discussion_votes")
        db.commit()
        db.refresh(game)
        
    game_state = {
        "type": "update",
        "status": game.status,
        "chat_enabled": game.chat_enabled,
        "chat_end_time": chat_end_time,
        "score": game.score,
        "round": game.round,
        "players": game.players,
        "history": game.history,
        "discussion_votes": game.discussion_votes
    }
    await broadcast(game_id, game_state)
    return game_state

@router.post("/discussion/stop/{game_id}")
async def stop_discussion(game_id: str, stop_data: dict, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game:
        raise HTTPException(404, "Game not found")
    
    stopping_player = stop_data.get("player", "").upper()
    stopper_name = game.players.get(stopping_player, "Opponent")
    
    game.round += 1
    game.status = "in_progress"
    game.chat_enabled = False
    game.discussion_votes = {"RED": None, "BLUE": None}
    flag_modified(game, "discussion_votes")
    db.commit()
    
    await broadcast(game_id, {
        "type": "discussion_stopped_by",
        "stopper_name": stopper_name
    })
    
    await broadcast(game_id, {
        "type": "update",
        "status": game.status,
        "score": game.score,
        "round": game.round,
        "history": game.history,
        "chat_enabled": False,
        "discussion_votes": game.discussion_votes
    })
    return {"status": "ok"}

@router.post("/chat/send/{game_id}")
async def send_chat_message(game_id: str, msg_data: dict):
    await broadcast(game_id, {
        "type": "chat_msg",
        "sender": msg_data.get("sender"),
        "text": msg_data.get("text")
    })
    return {"status": "sent"}