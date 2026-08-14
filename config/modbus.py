class ModbusConfig:

    def __init__(
        self,
        city: str,
        province: str,
        name: str,
        gateway_ip: str,
        gateway_port: int,
        timeout: int = 1,
        retries: int = 1,
        wind_speed_id: int = 1,
        wind_speed_register: int = 0,
        wind_dir_id: int = 2,
        wind_dir_register: int = 0,
        broadcast_interval: int = 1,
    ) -> None:
        self.city = city
        self.province = province
        self.name = name
        self.gateway_ip = gateway_ip
        self.gateway_port = gateway_port
        self.timeout = timeout
        self.retries = retries
        self.wind_speed_id = wind_speed_id
        self.wind_speed_register = wind_speed_register
        self.wind_dir_id = wind_dir_id
        self.wind_dir_register = wind_dir_register
        self.broadcast_interval = broadcast_interval

    @staticmethod
    def catalog() -> list["ModbusConfig"]:
        return [
            ModbusConfig(
                city="Fortaleza",
                province="Ceará",
                name="Carlinhos Maravilha",
                gateway_ip="45.161.67.51",
                gateway_port=8898,
            ),
            ModbusConfig(
                city="Fortaleza",
                province="Ceará",
                name="Titanzinho",
                gateway_ip="45.161.67.51",
                gateway_port=8898,
            ),

        ]

    @classmethod
    def get(cls, name: str) -> "ModbusConfig":
        for config in cls.catalog():
            if config.name == name:
                return config
        raise ValueError(f"Sensor desconhecido: {name}")

    @classmethod
    def from_env(cls, name: str) -> "ModbusConfig":
        return cls.get(name)
