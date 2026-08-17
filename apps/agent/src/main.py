import os

import uvicorn

from src.controllers.app import create_app
from src.infrastructure import SERVER_HOST, SERVER_PORT

app = create_app()

if __name__ == "__main__":
    host = os.getenv("SERVER_HOST", SERVER_HOST)
    port = int(os.getenv("SERVER_PORT", str(SERVER_PORT)))
    uvicorn.run("src.main:app", host=host, port=port, reload=True)
