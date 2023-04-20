import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_TITLE: str = "Seismic File Metadata Service"
    PROJECT_VERSION: str = "0.0.1"
    API_PATH: str = "/seismic-file-metadata/api/v1/"

    # This is required for running the service
    SDMS_URL: str = os.getenv('SDMS_SERVICE_HOST')
    APPLICATION_CORS_ENABLED: bool = os.getenv('APPLICATION_CORS_ENABLED', 'true') == 'true'


settings = Settings()
