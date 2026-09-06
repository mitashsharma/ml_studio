"""Development entry point: ``python run.py``."""

import os

from backend import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host=os.environ.get("HOST", "0.0.0.0"), port=port, debug=True, use_reloader=True)
