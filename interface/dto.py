from abc import ABC, abstractmethod
from typing import Any, Self
from dataclasses import dataclass

@dataclass(slots=True)
class DTO(ABC):

    @abstractmethod
    def to_json(self) -> dict[str, Any]:...

    @classmethod
    def to_dto(cls, payload: dict[str, Any]) -> Self:...
