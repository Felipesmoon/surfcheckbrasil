import logging
from contextlib import asynccontextmanager
from functools import lru_cache
import os
from fastapi import FastAPI,WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from config.modbus import ModbusConfig
from service.mercado_pago import MercadoPagoPayment
from broadcast.sensors import SensorsBroadcast
from singleton.sensor_connection_registry import SensorConnectionRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@lru_cache()
def sensor_broadcast() -> SensorsBroadcast:
    return SensorsBroadcast()

@lru_cache()
def get_mercado_pago_service() -> MercadoPagoPayment:
    return MercadoPagoPayment()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"{app.title} iniciado.")
    yield
    broadcast = sensor_broadcast()
    await broadcast.close()
    logger.info("Conexões Modbus fechadas.")

app = FastAPI(title="Wind SSE & WebSocket Service", lifespan=lifespan)

# CORS configurado corretamente para aceitar conexões externas
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/sensors")
async def list_sensors():
    registry = await SensorConnectionRegistry.get_instance()
    active = registry.active_names()
    return [
        {
            "id": s.name,
            "name": s.name,
            "city": s.city,
            "province": s.province,
            "connected": s.name in active,
        }
        for s in ModbusConfig.catalog()
    ]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    registry = await SensorConnectionRegistry.get_instance()
    await registry.connect_ws(websocket)
    broadcast = sensor_broadcast()
    logger.info("Novo cliente conectado via WebSocket")

    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"Mensagem WebSocket recebida: {data}")
            action = data.get("action")
            sensor_id = data.get("sensor_id")

            if action in ("select_sensor", "name") and sensor_id:
                await registry.set_ws_sensor(websocket, sensor_id)
                await broadcast.start_sensor(sensor_id)
            elif action == "disconnect_sensor" and sensor_id:
                await registry.set_ws_sensor(websocket, None)

    except WebSocketDisconnect:
        logger.info("Cliente WebSocket desconectado")
    except Exception as e:
        logger.error(f"Erro na conexão WebSocket: {e}")
    finally:
        await registry.disconnect_ws(websocket)
    
@app.get("/")
def serve_index():
    if not os.path.exists("frontend/index.html"):
        logger.error(f"Erro crítico: arquivo index.html não existe em frontend/index.html")
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html missing"})
    return FileResponse("frontend/index.html", media_type="text/html")

app.mount("/frontend", StaticFiles(directory='frontend'), name="frontend")


