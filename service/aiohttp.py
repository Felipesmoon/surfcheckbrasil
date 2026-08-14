import aiohttp
from interface.request import HTTPClient
from typing import Any
from fastapi import HTTPException


class AioHttpClient(HTTPClient):
    async def request(self, url: str, method: str, headers: dict[str, Any] | None = None, payload: bytes | None = None) -> bytes:
        async with aiohttp.ClientSession() as session:
            async with session.request(url=url, method=method.upper(), headers=headers, data=payload) as response:
                if response.ok:
                    return await response.read()
                raise HTTPException(status_code=response.status, detail=response.reason)
