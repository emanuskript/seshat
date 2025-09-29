"""Expose the Flask application for Hugging Face Spaces (or local runs)."""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "python-backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from simple_backend import app as application


def main() -> None:
    """Start the Flask development server when executed directly."""
    port = int(os.environ.get("PORT", os.environ.get("HF_SPACE_PORT", "7860")))
    host = "0.0.0.0"
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    application.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()
