from sqlalchemy import Column, String, Integer, JSON, Boolean
from sqlalchemy.ext.mutable import MutableDict, MutableList
from db.database import Base # Use the shared Base

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True, index=True)
    players = Column(MutableDict.as_mutable(JSON), default=lambda: {"RED": None, "BLUE": None})
    score = Column(MutableDict.as_mutable(JSON), default=lambda: {"RED": 0, "BLUE": 0})
    current_choice = Column(MutableDict.as_mutable(JSON), default=lambda: {"RED": None, "BLUE": None})
    discussion_votes = Column(MutableDict.as_mutable(JSON), default=lambda: {"RED": None, "BLUE": None})
    history = Column(MutableList.as_mutable(JSON), default=list) # Added missing column
    round = Column(Integer, default=1)
    status = Column(String, default="waiting")
    chat_enabled = Column(Boolean, default=False)
    discussion_active = Column(Boolean, default=False)
    ended_by = Column(String, nullable=True) # Added missing column