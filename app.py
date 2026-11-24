from __future__ import annotations

import argparse
import json
import re
import sqlite3
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "data" / "palettes.db"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_BODY_SIZE = 64 * 1024


def connect_database() -> sqlite3.Connection:
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS palettes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            colors TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    return connection


class PaletteHandler(BaseHTTPRequestHandler):
    server_version = "Kaoi Project-ColorStudio/1.0"

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Độ dài yêu cầu không hợp lệ.") from exc
        if length < 1 or length > MAX_BODY_SIZE:
            raise ValueError("Dữ liệu gửi lên bị thiếu hoặc vượt quá giới hạn.")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("JSON không hợp lệ.") from exc
        if not isinstance(value, dict):
            raise ValueError("Dữ liệu phải là một đối tượng JSON.")
        return value

    def do_GET(self) -> None:
        route = urlparse(self.path).path
        if route == "/api/palettes":
            with connect_database() as connection:
                rows = connection.execute(
                    "SELECT id, name, colors, created_at FROM palettes "
                    "ORDER BY id DESC"
                ).fetchall()
            self.send_json(
                200,
                [
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "colors": json.loads(row["colors"]),
                        "createdAt": row["created_at"],
                    }
                    for row in rows
                ],
            )
            return

        static_files = {
            "/favicon.png": ("Tiêu đề.png", "image/png"),
            "/": ("index.html", "text/html; charset=utf-8"),
            "/index.html": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        }
        asset = static_files.get(route)
        if asset is None:
            self.send_json(404, {"error": "Không tìm thấy tài nguyên."})
            return
        filename, content_type = asset
        body = (ROOT / filename).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/palettes":
            self.send_json(404, {"error": "Không tìm thấy tài nguyên."})
            return
        try:
            payload = self.read_json()
            name = payload.get("name")
            colors = payload.get("colors")
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
                raise ValueError("Tên bộ màu phải có từ 1 đến 80 ký tự.")
            if (
                not isinstance(colors, list)
                or not 1 <= len(colors) <= 12
                or any(not isinstance(color, str) or not HEX_COLOR.fullmatch(color) for color in colors)
            ):
                raise ValueError("Bộ màu cần có từ 1 đến 12 mã HEX hợp lệ.")
            created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with connect_database() as connection:
                cursor = connection.execute(
                    "INSERT INTO palettes (name, colors, created_at) VALUES (?, ?, ?)",
                    (name.strip(), json.dumps([c.upper() for c in colors]), created_at),
                )
                palette_id = cursor.lastrowid
            self.send_json(
                201,
                {
                    "id": palette_id,
                    "name": name.strip(),
                    "colors": [color.upper() for color in colors],
                    "createdAt": created_at,
                },
            )
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except sqlite3.Error:
            self.log_error("Không thể lưu bộ màu vào SQLite.")
            self.send_json(500, {"error": "Không thể lưu bộ màu. Vui lòng thử lại."})

    def do_DELETE(self) -> None:
        match = re.fullmatch(r"/api/palettes/([1-9][0-9]*)", urlparse(self.path).path)
        if match is None:
            self.send_json(404, {"error": "Không tìm thấy bộ màu."})
            return
        with connect_database() as connection:
            cursor = connection.execute(
                "DELETE FROM palettes WHERE id = ?", (int(match.group(1)),)
            )
        if cursor.rowcount == 0:
            self.send_json(404, {"error": "Bộ màu không tồn tại hoặc đã bị xóa."})
            return
        self.send_json(200, {"deleted": True})

    def log_message(self, message: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {message % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Chạy ứng dụng ColorStudio trên máy tính.")
    parser.add_argument("--host", default="127.0.0.1", help="Địa chỉ lắng nghe (mặc định: localhost)")
    parser.add_argument("--port", type=int, default=8000, help="Cổng web (mặc định: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Không tự mở trình duyệt")
    args = parser.parse_args()

    with connect_database():
        pass
    server = ThreadingHTTPServer((args.host, args.port), PaletteHandler)
    address = f"http://{args.host}:{args.port}/"
    print(f"ColorStudio is running at {address} - press Ctrl+C to stop.")
    if not args.no_browser and args.host in ("127.0.0.1", "localhost"):
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng ColorStudio...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
