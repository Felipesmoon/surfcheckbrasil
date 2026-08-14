from dataclasses import dataclass
import json
from typing import Any
from uuid import uuid4
from dto.mercado_pago import MercadoPagoDto
from interface.request import HTTPClient
from interface.payments import Payments
from config.mercado_pago import MercadoPagoConfig
from service.aiohttp import AioHttpClient


class MercadoPagoPayment(Payments):

    def __init__(self):
        self._mercado_pago_config: MercadoPagoConfig = MercadoPagoConfig.from_env()
        self.http_client: HTTPClient = AioHttpClient()

    async def pix_payment(self, payer_email: str) -> MercadoPagoDto:
        payload: dict[str, Any] = {
            "transaction_amount": float(self._mercado_pago_config.pix_amount),
            "payment_method_id": self._mercado_pago_config.payment_method_id,
            "payer": {"email": payer_email},
        }

        response = await self.http_client.request(
            url=f"{self._mercado_pago_config.mercado_pago_base_url}{self._mercado_pago_config.mercado_pago_path}",
            method="POST",
            headers={
                "Authorization": f"Bearer {self._mercado_pago_config.mercado_pago_access_token}",
                "Content-Type": "application/json",
                "X-Idempotency-Key": str(uuid4()),
            },
            payload=json.dumps(payload).encode("utf-8"),
        )
        return MercadoPagoDto.to_dto(json.loads(response.decode("utf-8")))

    async def get_payment(self, payment_id: str) -> MercadoPagoDto:
        response = await self.http_client.request(
            url=f"{self._mercado_pago_config.mercado_pago_base_url}{self._mercado_pago_config.mercado_pago_path}/{payment_id}",
            method="GET",
            headers={
                "Authorization": f"Bearer {self._mercado_pago_config.mercado_pago_access_token}",
                "Content-Type": "application/json",
                "X-Idempotency-Key": str(uuid4()),
            },
        )
        return MercadoPagoDto.to_dto(json.loads(response.decode("utf-8")))
