"""
Minimal Vercel Python entrypoint.

Streamlit cannot run as a Vercel serverless function.
This endpoint only serves a status/info page so the project deploys cleanly.
Run the real dashboard with: streamlit run app.py
"""

from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = {
            "status": "ok",
            "project": "Tactica AI",
            "message": (
                "This is a Streamlit trading lab. "
                "Vercel only hosts this info endpoint. "
                "Run the full dashboard locally or on Streamlit Community Cloud."
            ),
            "run_locally": "streamlit run app.py",
            "docs": "https://github.com/heidif24/tactica-ai",
            "recommended_hosting": [
                "Streamlit Community Cloud (free)",
                "Railway",
                "Render",
                "Your own machine / VPS",
            ],
        }
        payload = json.dumps(body, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        return
