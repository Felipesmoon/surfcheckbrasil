import logging
from typing import List
from interface.dto import DTO
from dto.sensor import SensorDto
from config.modbus import ModbusConfig
from service.modbus_service import ModbusTCPClient

logger = logging.getLogger(__name__)


class SensorRepository:

    async def get_sensor_data(self, name: str) -> DTO:
        config = ModbusConfig.get(name=name)
        modbus_client = ModbusTCPClient(name=name)

        speed_regs: List[int] = await modbus_client.read_holding_registers(
            name="speed",
            address=config.wind_speed_register,
            count=1,
            device_id=config.wind_speed_id,
        )

        dir_regs: List[int] = await modbus_client.read_holding_registers(
            name="direction",
            address=config.wind_dir_register,
            count=2,
            device_id=config.wind_dir_id,
        )

        if not speed_regs:
            raise ValueError(f"Leitura inválida do registro de velocidade do vento (sensor '{name}')")
        if not dir_regs:
            raise ValueError(f"Leitura inválida do registro de direção do vento (sensor '{name}')")

        speed = round((speed_regs[0] / 10) * 3.6, 1)
        direction = dir_regs[1]

        return SensorDto.to_dto({"speed": speed, "direction": direction})