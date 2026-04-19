from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from game_routes import router as game_router
from discussion_routes import router as discussion_router
from websocket import connect, disconnect, broadcast
from db.database import Base, engine
import json
# This will now correctly create the 'games' table
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game_router, prefix="/game")
app.include_router(discussion_router, prefix="/game")

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await connect(websocket, game_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # If the received message is a chat, broadcast it to everyone in the game
            if message_data.get("type") == "chat":
                await broadcast(game_id, message_data)
    except:
        await disconnect(websocket, game_id)