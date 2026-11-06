"""Gunicorn entrypoint. Fails startup on missing mandatory secrets or DB location."""
from .http_app import from_environment
application=from_environment()
