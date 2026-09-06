"""Flask extensions instantiated without an app (factory pattern)."""

from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()
cors = CORS()
