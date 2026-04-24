import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps camera_id to a set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        if camera_id not in self.active_connections:
            self.active_connections[camera_id] = set()
        self.active_connections[camera_id].add(websocket)
        logger.info(f"[WebSocket] Client connected to {camera_id}. Total clients: {len(self.active_connections[camera_id])}")

    def disconnect(self, websocket: WebSocket, camera_id: str):
        if camera_id in self.active_connections:
            self.active_connections[camera_id].discard(websocket)
            logger.info(f"[WebSocket] Client disconnected from {camera_id}.")
            if not self.active_connections[camera_id]:
                del self.active_connections[camera_id]

    async def broadcast_metadata(self, camera_id: str, metadata: dict):
        """
        Broadcast JSON metadata to all connected clients for a specific camera_id.
        """
        if camera_id not in self.active_connections:
            return

        dead_connections = set()
        for connection in self.active_connections[camera_id]:
            try:
                await connection.send_json(metadata)
            except Exception as e:
                logger.warning(f"[WebSocket] Failed to send to a client for {camera_id}: {e}")
                dead_connections.add(connection)

        # Cleanup dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn, camera_id)

manager = ConnectionManager()
