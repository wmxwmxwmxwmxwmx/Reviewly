from fastapi import HTTPException


def api_error(message: str, status: int = 400, code: str | None = None) -> HTTPException:
    body: dict[str, str] = {"error": message}
    if code:
        body["code"] = code
    return HTTPException(status_code=status, detail=body)
