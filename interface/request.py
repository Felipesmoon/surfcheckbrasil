from abc import ABC, abstractmethod
from typing import Any



class HTTPClient(ABC):

    @abstractmethod
    async def request(self, url: str, method: str, headers: dict[str, Any] | None = None, payload: bytes |None = None) -> bytes: ...
