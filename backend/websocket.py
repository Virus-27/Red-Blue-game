from fastapi import WebSocket
import json

connections = {} # {game_id: [WebSocket, ...]}

async def connect(websocket: WebSocket, game_id: str):
    await websocket.accept()
    if game_id not in connections:
        connections[game_id] = []
    connections[game_id].append(websocket)

async def disconnect(websocket: WebSocket, game_id: str):
    if game_id in connections:
        connections[game_id].remove(websocket)

async def broadcast(game_id: str, message: dict):
    if game_id in connections:
        for connection in connections[game_id]:
            try:
                await connection.send_text(json.dumps(message))
            except:
                continue