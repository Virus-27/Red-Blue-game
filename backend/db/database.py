from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

if not os.path.exists("./db"):
    os.makedirs("./db", exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./db/red_blue.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} # Necessary for multiple games/threads
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()