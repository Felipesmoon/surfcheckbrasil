from dataclasses import dataclass, asdict
from typing import Any, Self
from interface.dto import DTO

@dataclass
class SensorDto(DTO):
    speed: float
    direction: int

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def to_dto(cls, payload: dict[str, Any]) -> Self:
        return cls(**payload)
