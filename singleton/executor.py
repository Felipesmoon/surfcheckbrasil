from concurrent.futures import ThreadPoolExecutor

# Executor dedicado para operacoes de rede Modbus (evita esgotar o pool do FastAPI)
modbus_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ModbusPool")
