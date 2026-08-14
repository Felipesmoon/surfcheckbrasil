from dataclasses import dataclass
import os

@dataclass(frozen=True)
class MercadoPagoConfig:
    mercado_pago_base_url: str
    mercado_pago_path: str
    mercado_pago_teste_access_token: str | None
    mercado_pago_access_token: str | None
    mercado_pago_webhook_secret: str
    mercado_pago_webhook_url: str
    pix_amount: float
    pix_description: str
    pix_key_phone: str
    payment_method_id: str

    @classmethod
    def from_env(cls) -> "MercadoPagoConfig":
        return cls(
            mercado_pago_base_url="https://api.mercadopago.com",
            mercado_pago_path="/v1/payments",
            mercado_pago_teste_access_token=os.getenv("MERCADO_PAGO_TESTE_ACCESS_TOKEN", None),
            mercado_pago_access_token=os.getenv("MERCADO_PAGO_ACCESS_TOKEN", None),
            mercado_pago_webhook_secret="Ana120210@SufCheck@BRasil",
            mercado_pago_webhook_url="https://surfcheckbrasil.com.br/webhook",
            pix_amount=float(os.getenv("PIX_AMOUNT", 0.10)),
            pix_description="Surf Check Brasil",
            pix_key_phone="+5585987728843",
            payment_method_id="pix",
        )
