import sys
import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
import models 
Base.metadata.create_all(bind=engine)
from routes import room_routes, game_logic_routes, discussion_routes
from websocket import connect, disconnect, broadcast
import json

app = FastAPI()

# ... rest of your CORS and app.include_router code ...

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Splitting the routers
app.include_router(room_routes.router, prefix="/game")
app.include_router(game_logic_routes.router, prefix="/game")
app.include_router(discussion_routes.router, prefix="/game")

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await connect(websocket, game_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "chat":
                await broadcast(game_id, msg)
    except:
        await disconnect(websocket, game_id)