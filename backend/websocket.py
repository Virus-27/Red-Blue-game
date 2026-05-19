# websocket.py
from fastapi import WebSocket, WebSocketDisconnect
import json

connections = {} # {game_id: [WebSocket, ...]}

async def connect(websocket: WebSocket, game_id: str):
    await websocket.accept()
    if game_id not in connections:
        connections[game_id] = []
    connections[game_id].append(websocket)

async def disconnect(websocket: WebSocket, game_id: str):
    if game_id in connections:
        if websocket in connections[game_id]:
            connections[game_id].remove(websocket)
        if not connections[game_id]: 
            del connections[game_id]

async def broadcast(game_id: str, message: dict):
    if game_id in connections:
        for connection in connections[game_id]:
            try:
                await connection.send_text(json.dumps(message))
            except:
                continue

# NEW: The traffic controller loop lives here now!
async def handle_session(websocket: WebSocket, game_id: str):
    await connect(websocket, game_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            msg = json.loads(raw_data)
            
            # Blindly broadcast EVERYTHING (rematch handshakes, moves, chat, surrenders)
            await broadcast(game_id, msg)
            
    except WebSocketDisconnect:
        await disconnect(websocket, game_id)
    except Exception as e:
        print(f"Socket error or closed: {e}")
        await disconnect(websocket, game_id)