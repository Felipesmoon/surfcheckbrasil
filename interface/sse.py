from abc import ABC, abstractmethod
import asyncio

class ConnectionManager(ABC):

    @abstractmethod
    def connect(self) -> asyncio.Queue: ...

    @abstractmethod
    def disconnect(self, queue: asyncio.Queue): ...

    @abstractmethod
    async def broadcast(self, message: str, event_type: str = "notification"): ...

    @property
    @abstractmethod
    def count_connections(self) -> int: ...
    
