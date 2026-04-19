from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from models import Game
from db.database import SessionLocal
from websocket import broadcast
import json

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
    vote = vote_data.get("vote") # Can be True/False

    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(404, "Game not found")

    # Update votes dictionary
    votes = dict(game.discussion_votes)
    votes[player] = vote
    game.discussion_votes = votes
    flag_modified(game, "discussion_votes")

    # Check if both players have voted
    if game.discussion_votes.get("RED") is not None and game.discussion_votes.get("BLUE") is not None:
        # Chat only enables if BOTH say True
        game.chat_enabled = (game.discussion_votes["RED"] is True and 
                             game.discussion_votes["BLUE"] is True)
        
        # Resume game status
        game.status = "in_progress"
        game.discussion_votes = {"RED": None, "BLUE": None}
        flag_modified(game, "discussion_votes")

    db.commit()
    db.refresh(game)

    # Broadcast the FULL updated state so React knows status changed to 'in_progress'
    game_state = {
        "type": "update",
        "game_id": game.id,
        "status": game.status,
        "round": game.round,
        "chat_enabled": game.chat_enabled,
        "score": game.score,
        "history": game.history,
        "discussion_votes": game.discussion_votes
    }
    
    await broadcast(game_id, game_state)
    return game_state