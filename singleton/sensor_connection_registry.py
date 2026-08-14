import asyncio
import logging
import inspect
from typing import Self
from fastapi import WebSocket
from config.modbus import ModbusConfig
from singleton.modbus_connections_manager import ModbusConnectionManager

logger = logging.getLogger(__name__)

class SensorConnectionRegistry:
    _instance: Self | None = None
    _class_lock = asyncio.Lock()

    def __init__(self) -> None:
        self._connections: dict[str, ModbusConnectionManager] = {}
        self._sse_queues: list[asyncio.Queue] = []
        self._ws_listeners: dict[WebSocket, str | None] = {}
        self._lock = asyncio.Lock()

    @classmethod
    async def get_instance(cls) -> Self:
        if cls._instance is None:
            async with cls._class_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def connect(self, name: str) -> ModbusConnectionManager:
        async with self._lock:
            manager = self._connections.get(name)
            if manager is None:
                config = ModbusConfig.get(name)
                manager = ModbusConnectionManager.new_instance(config=config)
                self._connections[name] = manager

        if not manager.connected:
            try:
                host = getattr(manager, 'host', 'unknown')
                port = getattr(manager, 'port', 'unknown')
                try:
                    if hasattr(manager, 'comm_params') and manager.comm_params:
                        host = manager.comm_params.host
                        port = manager.comm_params.port
                except AttributeError:
                    pass

                logger.info(f"Conectando de forma assíncrona ao sensor '{name}' ({host}:{port})")
                
                connected = await manager.connect()
                
                if not connected:
                    async with self._lock:
                        self._connections.pop(name, None)
                    raise ConnectionError(f"Falha ao conectar sensor '{name}'")
            except Exception as e:
                async with self._lock:
                    self._connections.pop(name, None)
                raise ConnectionError(f"Erro na conexão assíncrona com '{name}': {e}")

        return manager

    async def disconnect(self, name: str) -> None:
        async with self._lock:
            manager = self._connections.pop(name, None)
        if manager is not None:
            if hasattr(manager, 'close') and inspect.iscoroutinefunction(manager.close):
                await manager.close()
            else:
                manager.close()
            logger.info(f"Sensor '{name}' desconectado com sucesso.")

    def get(self, name: str) -> ModbusConnectionManager | None:
        return self._connections.get(name)

    def active_names(self) -> list[str]:
        # Filtra apenas os que realmente mantêm a conexão ativa
        return [name for name, conn in self._connections.items() if conn.connected]

    async def connect_client(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        async with self._lock:
            self._sse_queues.append(queue)
        logger.info(f"New SSE client connected. Total: {len(self._sse_queues)}")
        return queue

    async def disconnect_client(self, queue: asyncio.Queue) -> None:
        async with self._lock:
            try:
                self._sse_queues.remove(queue)
            except ValueError:
                pass
        logger.info(f"SSE client disconnected. Total: {len(self._sse_queues)}")

    async def connect_ws(self, ws: WebSocket) -> None:
        async with self._lock:
            self._ws_listeners[ws] = None
        logger.info(f"Novo cliente WebSocket conectado. Total WS: {len(self._ws_listeners)}")

    async def set_ws_sensor(self, ws: WebSocket, sensor_id: str | None) -> None:
        async with self._lock:
            if ws in self._ws_listeners:
                self._ws_listeners[ws] = sensor_id

    async def disconnect_ws(self, ws: WebSocket) -> None:
        async with self._lock:
            self._ws_listeners.pop(ws, None)
        logger.info(f"Cliente WebSocket removido. Total WS: {len(self._ws_listeners)}")

    async def broadcast(self, message: str, event_type: str) -> None:
        async with self._lock:
            queues = list(self._sse_queues)
            ws_listeners = list(self._ws_listeners.items())

        if queues:
            await asyncio.gather(
                *[queue.put((message, event_type)) for queue in queues],
                return_exceptions=True
            )

        # No arquivo singleton/sensor_connection_registry.py
# Método: async def broadcast(self, message: str, event_type: str) -> None:

        if ws_listeners:
            payload = {"event": event_type, "data": message}
            disconnected = []
            for ws, name in ws_listeners:
                if name is None or event_type != f"wind:{name}":
                    continue
                
                try:
                    await ws.send_json(payload)
                except Exception as e:
                    logger.warning(f"Erro ao enviar WebSocket para cliente: {e}")
                    disconnected.append(ws)
