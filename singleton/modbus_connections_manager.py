# Cliente Async de verdade: usa AsyncModbusTcpClient para não bloquear o event loop.
from pymodbus.client import AsyncModbusTcpClient
from typing import Self

from config.modbus import ModbusConfig

class ModbusConnectionManager(AsyncModbusTcpClient): 
    def __init__(self, config: ModbusConfig) -> None:
        self.__config = config
        super().__init__(
            host=self.__config.gateway_ip,
            port=self.__config.gateway_port,
            timeout=self.__config.timeout,
            retries=self.__config.retries,
        )

    @classmethod
    def new_instance(cls, config: ModbusConfig) -> Self:
        return cls(config=config)
