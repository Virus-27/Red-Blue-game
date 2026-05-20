import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from db.database import SessionLocal
from models import Game

connections = {}

async def connect(websocket: WebSocket, game_id: str):
    await websocket.accept()
    if game_id not in connections:
        connections[game_id] = {
            "sockets": {"RED": None, "BLUE": None},
            "timers": {"RED": None, "BLUE": None},
            "players_details": {"RED": None, "BLUE": None}
        }

async def disconnect_with_grace(websocket: WebSocket, game_id: str):
    if game_id not in connections:
        return
    room = connections[game_id]
    assigned_role = None
    for role, ws in room["sockets"].items():
        if ws == websocket:
            assigned_role = role
            break
            
    if not assigned_role:
        return
        
    room["sockets"][assigned_role] = None
    
    if room["sockets"]["RED"] is None and room["sockets"]["BLUE"] is None:
        print(f"📉 Both players disconnected from room {game_id}. Setting status to abandoned.")
        for role_key in ["RED", "BLUE"]:
            if room["timers"].get(role_key):
                room["timers"][role_key].cancel()
                room["timers"][role_key] = None
                
        db = SessionLocal()
        try:
            game = db.query(Game).filter(Game.id == game_id).first()
            if game:
                game.status = "abandoned"
                db.commit()
        finally:
            db.close()
            
        if game_id in connections:
            del connections[game_id]
        return

    print(f"📡 Player {assigned_role} disconnected from room {game_id}. Starting 2-minute grace window...")
    
    await broadcast(game_id, {
        "type": "opponent_disconnected",
        "player": assigned_role
    })
    
    loop = asyncio.get_event_loop()
    timeout_task = loop.create_task(hold_slot_timeout(game_id, assigned_role))
    room["timers"][assigned_role] = timeout_task

async def hold_slot_timeout(game_id: str, role: str):
    try:
        await asyncio.sleep(120)
        print(f"⏰ Player {role} timed out after 2 minutes in room {game_id}. Remaining player wins.")
        winner_color = "BLUE" if role == "RED" else "RED"
        
        db = SessionLocal()
        try:
            game = db.query(Game).filter(Game.id == game_id).first()
            if game:
                game.status = "finished"
                game.ended_by = winner_color
                db.commit()
        finally:
            db.close()
            
        await broadcast(game_id, {
            "type": "surrender_broadcast",
            "winnerColor": winner_color,
            "reason": "timeout"
        })
        if game_id in connections:
            del connections[game_id]
    except asyncio.CancelledError:
        print(f"♻️ Player {role} successfully reconnected to room {game_id}! Grace timer canceled.")

async def broadcast(game_id: str, message: dict):
    if game_id in connections:
        room_sockets = connections[game_id]["sockets"]
        for role, connection in room_sockets.items():
            if connection is not None:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    connections[game_id]["sockets"][role] = None

async def handle_session(websocket: WebSocket, game_id: str):
    game_id = game_id.upper()
    await connect(websocket, game_id)
    bound_role = None
    room = connections[game_id]
    try:
        while True:
            raw_data = await websocket.receive_text()
            msg = json.loads(raw_data)
            msg_type = msg.get("type")
            
            if msg_type == "avatar_handshake":
                bound_role = msg.get("sender")
                if bound_role:
                    if room["timers"].get(bound_role) is not None:
                        room["timers"][bound_role].cancel()
                        room["timers"][bound_role] = None
                    room["sockets"][bound_role] = websocket
                    
                    if "players_details" not in room:
                        room["players_details"] = {"RED": None, "BLUE": None}
                    room["players_details"][bound_role] = {
                        "face": msg.get("face", "🐱"),
                        "hat": msg.get("hat", "❌")
                    }
                    await broadcast(game_id, msg)
                    
            elif msg_type == "stop_discussion":
                db = SessionLocal()
                try:
                    game = db.query(Game).filter(Game.id == game_id).first()
                    if game:
                      
                        game.status = "in_progress"
                        
                        if hasattr(game, 'discussion_votes'):
                            game.discussion_votes = {"RED": False, "BLUE": False}
                            
                        db.commit()
                finally:
                    db.close()
                
                await broadcast(game_id, msg)
                
            else:
                if msg_type == "surrender_broadcast":
                    winner_color = msg.get("winnerColor")
                    db = SessionLocal()
                    try:
                        game = db.query(Game).filter(Game.id == game_id).first()
                        if game:
                            game.status = "finished"
                            game.ended_by = winner_color
                            db.commit()
                    finally:
                        db.close()
                await broadcast(game_id, msg)
                
    except WebSocketDisconnect:
        await disconnect_with_grace(websocket, game_id)
    except Exception as e:
        print(f"Socket error in room {game_id}: {e}")
        await disconnect_with_grace(websocket, game_id)