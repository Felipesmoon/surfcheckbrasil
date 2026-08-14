
from abc import ABC, abstractmethod
from typing import Dict, Any
from interface.dto import DTO

class Payments(ABC):

    @abstractmethod
    async def pix_payment(self, payer_email: str) -> DTO: ...

    @abstractmethod
    async def get_payment(self, payment_id: str) ->  DTO: ...
    

    
