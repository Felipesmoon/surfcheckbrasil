from dataclasses import asdict, dataclass
from typing import Any, Self
from interface.dto import DTO


@dataclass(slots=True)
class MercadoPagoDto(DTO):
    payment_id: str
    amount: float
    payer_email: str
    status: str
    status_detail: str
    qr_code: str
    qr_code_base64: str
    ticket_url: str

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def to_dto(cls, payload: dict[str, Any]) -> Self:
        return cls(
            payment_id=payload["id"],
            amount=payload["transaction_amount"],
            payer_email=payload["payer"]["email"],
            status=payload["status"],
            status_detail=payload["status_detail"],
            qr_code=payload["point_of_interaction"]["transaction_data"]["qr_code"],
            qr_code_base64=payload["point_of_interaction"]["transaction_data"][
                "qr_code_base64"
            ],
            ticket_url=payload["point_of_interaction"]["transaction_data"][
                "ticket_url"
            ],
        )
