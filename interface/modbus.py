from abc import ABC, abstractmethod
from typing import Any, List


class ModbusClient(ABC):
    
    @abstractmethod
    async def connect(self) -> Any: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def read_holding_registers(
        self, name: str, address: int, count: int, device_id: int) -> List[int]: ...

    @property
    @abstractmethod
    async def is_connected(self) -> bool: ...
