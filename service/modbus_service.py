import logging
from typing import List
from pymodbus.pdu import ModbusPDU
from interface.modbus import ModbusClient
from singleton.modbus_connections_manager import ModbusConnectionManager
from singleton.sensor_connection_registry import SensorConnectionRegistry

logger = logging.getLogger(__name__)

class ModbusTCPClient(ModbusClient):

    def __init__(self, name: str) -> None:
        self.__name = name

    async def _get_registry(self) -> SensorConnectionRegistry:
        return await SensorConnectionRegistry.get_instance()

    async def connect(self) -> ModbusConnectionManager:
        registry = await self._get_registry()
        return await registry.connect(self.__name)

    async def close(self) -> None:
        registry = await self._get_registry()
        await registry.disconnect(self.__name)

    @property
    async def is_connected(self) -> bool:
        registry = await self._get_registry()
        manager = registry.get(self.__name)
        return manager.connected if manager else False

    async def read_holding_registers(
        self, name: str, address: int, count: int, device_id: int
    ) -> List[int]:
        registry = await self._get_registry()
        manager = registry.get(self.__name)

        if manager is None or not manager.connected:
            manager = await registry.connect(self.__name)
            try:
                host_info = f"{manager.comm_params.host}:{manager.comm_params.port}"
            except AttributeError:
                host_info = f"{getattr(manager, 'host', 'unknown')}:{getattr(manager, 'port', 'unknown')}"
                
            logger.info(f"Conectado ao Modbus gateway '{self.__name}': {host_info}")

        try:
            result: ModbusPDU = await manager.read_holding_registers(
                address=address,
                count=count,
                device_id=device_id,
            )

            if result is None:
                raise TimeoutError(
                    f"Nenhuma resposta do dispositivo Modbus (Slave {name}-{device_id}) no endereço {address}"
                )
            if result.isError():
                raise IOError(
                    f"Erro Modbus ao ler registros (Slave {name}-{device_id}): {getattr(result, 'status', result)}"
                )
            if not hasattr(result, "registers"):
                raise ValueError(
                    f"Resultado Modbus sem registros: {getattr(result, 'status', result)}"
                )

            return result.registers

        except Exception as e:
            logger.critical(f"Erro crítico no gateway Modbus (sensor '{self.__name}'): {e}")
            await self.close()
            raise e
