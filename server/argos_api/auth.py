import hmac

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="missing or invalid API key",
    headers={"WWW-Authenticate": "Bearer"},
)


# Only declares the bearer scheme in OpenAPI (Swagger's "Authorize" button). auto_error=False
# so it never rejects on its own: missing/invalid keys still get the 401 below.
_bearer = HTTPBearer(auto_error=False, scheme_name="ApiKey", description="API key de Argos (`Authorization: Bearer <key>`)")


def require_api_key(request: Request, _scheme: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """Dependency for /v1/*: validate the bearer key, return the client id."""
    scheme, _, presented = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not presented:
        raise _UNAUTHORIZED
    presented_b = presented.strip().encode()
    client_id = None
    # Compare against every key so timing does not reveal which (if any) matched.
    for key, cid in request.app.state.settings.api_keys.items():
        if hmac.compare_digest(presented_b, key.encode()):
            client_id = cid
    if client_id is None:
        raise _UNAUTHORIZED
    request.state.client_id = client_id
    return client_id
