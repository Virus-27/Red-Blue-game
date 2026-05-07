from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from models import Game
from db.database import SessionLocal
from websocket import broadcast
import json
import time 
router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@router.post("/discussion/{game_id}")
async def discussion_vote(game_id: str, vote_data: dict, db: Session = Depends(get_db)):
    player = vote_data.get("player", "").upper()
    vote = vote_data.get("vote")

    game = db.query(Game).filter(Game.id == game_id.upper()).first()
    if not game:
        raise HTTPException(404, "Game not found")

    votes = dict(game.discussion_votes)
    votes[player] = vote
    game.discussion_votes = votes
    flag_modified(game, "discussion_votes")

    chat_end_time = None # Default

    if game.discussion_votes.get("RED") is not None and game.discussion_votes.get("BLUE") is not None:
        if game.discussion_votes["RED"] is True and game.discussion_votes["BLUE"] is True:
            game.chat_enabled = True
            # FIX: Tell the clients EXACTLY when the chat should end (60s from now)
            chat_end_time = time.time() + 60 
        else:
            game.chat_enabled = False
            game.status = "in_progress"

        game.discussion_votes = {"RED": None, "BLUE": None}
        flag_modified(game, "discussion_votes")

    db.commit()
    db.refresh(game)

    game_state = {
        "type": "update",
        "status": game.status,
        "chat_enabled": game.chat_enabled,
        "chat_end_time": chat_end_time, # Send this to React!
        "score": game.score,
        "round": game.round
    }
    
    await broadcast(game_id, game_state)
    return game_state