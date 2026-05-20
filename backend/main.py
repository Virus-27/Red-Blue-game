from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
import models 
Base.metadata.create_all(bind=engine)
from routes import room_routes, game_logic_routes, discussion_routes
from websocket import handle_session 

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(room_routes.router, prefix="/game")
app.include_router(game_logic_routes.router, prefix="/game")
app.include_router(discussion_routes.router, prefix="/game")

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await handle_session(websocket, game_id)