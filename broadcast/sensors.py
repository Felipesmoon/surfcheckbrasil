import asyncio
import json
import logging
from repository.modbus import SensorRepository
from singleton.sensor_connection_registry import SensorConnectionRegistry

logger = logging.getLogger(__name__)


class SensorsBroadcast:

    def __init__(self) -> None:
        self.__repository = SensorRepository()
        self.__tasks: dict[str, asyncio.Task] = {}


    def is_running(self, name: str) -> bool:
        task = self.__tasks.get(name)
        return task is not None and not task.done()

    async def start_sensor(self, name: str) -> None:
        if self.is_running(name):
            return
        self.__tasks[name] = asyncio.create_task(self.__loop(name))
        logger.info(f"Broadcast iniciado para o sensor '{name}'.")

    async def stop_sensor(self, name: str) -> None:
        task = self.__tasks.pop(name, None)
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info(f"Broadcast parado para o sensor '{name}'.")

    async def stop_all(self) -> None:
        for name in list(self.__tasks.keys()):
            await self.stop_sensor(name)

    async def __loop(self, name: str) -> None:
        try:
            while True:
                try:
                    wind_data = await self.__repository.get_sensor_data(name=name)
                    if wind_data is not None:
                        message = json.dumps(wind_data.to_json())
                        manager = await SensorConnectionRegistry.get_instance()
                        await manager.broadcast(message, event_type=f"wind:{name}")
                    else:
                        logger.warning(f"Falha ao ler dados do sensor '{name}' (dados nulos).")
                except Exception as e:
                    logger.error(f"Erro ao transmitir dados do sensor '{name}': {e}")
                    await asyncio.sleep(5)
                else:
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info(f"Tarefa de broadcast do sensor '{name}' cancelada.")
            raise

    async def close(self) -> None:
        await self.stop_all()
        registry = await SensorConnectionRegistry.get_instance()
        for name in registry.active_names():
            await registry.disconnect(name)
        logger.info("Conexões Modbus fechadas via broadcast.")

    