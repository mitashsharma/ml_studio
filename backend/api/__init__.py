from .auth import bp as auth_bp
from .datasets import bp as datasets_bp
from .experiments import bp as experiments_bp
from .meta import bp as meta_bp

BLUEPRINTS = (meta_bp, auth_bp, datasets_bp, experiments_bp)

__all__ = ["BLUEPRINTS", "auth_bp", "datasets_bp", "experiments_bp", "meta_bp"]
