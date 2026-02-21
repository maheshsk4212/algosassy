from pydantic import BaseModel

class LoginResponse(BaseModel):
    login_url: str

class CallbackRequest(BaseModel):
    request_token: str

class AuthTokenResponse(BaseModel):
    status: str
    message: str
