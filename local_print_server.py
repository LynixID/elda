"""
Local Print Server - Harmoni Agro Sistem Kasir
===============================================
Jalankan script ini di PC kasir (Windows) SEBELUM menggunakan fitur cetak.
Script ini menjembatani web app (VPS) dengan printer thermal lokal.

Cara pakai:
    1. Buka terminal/CMD di folder proyek ini
    2. Jalankan: python local_print_server.py
    3. Biarkan tetap berjalan selama kasir beroperasi

Port default: 27631 (bisa diubah di bawah)
"""

import sys
import os
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# =============================================
# KONFIGURASI
# =============================================
PRINT_SERVER_PORT = 27631       # Port yang didengarkan server lokal

# Browser kasir bisa mengakses dari mana saja (lokal, VPS, domain)
# karena request selalu berasal dari browser di PC yang sama dengan printer.
# Tidak ada risiko keamanan karena server hanya listen di 127.0.0.1.
ALLOWED_ORIGINS = None  # None = izinkan semua origin

# Import win32print (hanya tersedia di Windows)
try:
    import win32print
    HAS_WIN32PRINT = True
except ImportError:
    HAS_WIN32PRINT = False
    print("[WARN] win32print tidak tersedia. Pastikan pywin32 sudah terinstall.")
    print("       Jalankan: pip install pywin32")


def get_default_printer():
    """Dapatkan nama printer default sistem."""
    if not HAS_WIN32PRINT:
        return None
    try:
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


def send_raw_to_printer(data: bytes, printer_name: str = None):
    """
    Kirim data ESC/POS raw langsung ke printer thermal.
    Persis seperti cara kerja print_test.py yang hasilnya jernih.
    """
    if not HAS_WIN32PRINT:
        raise RuntimeError("win32print tidak tersedia.")

    if not printer_name:
        printer_name = get_default_printer()

    if not printer_name:
        raise RuntimeError("Tidak ada printer yang ditemukan.")

    hprinter = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(hprinter, 1, ("Struk Kasir Harmoni Agro", None, "RAW"))
        win32print.StartPagePrinter(hprinter)
        win32print.WritePrinter(hprinter, data)
        win32print.EndPagePrinter(hprinter)
        win32print.EndDocPrinter(hprinter)
    finally:
        win32print.ClosePrinter(hprinter)

    return printer_name


class PrintHandler(BaseHTTPRequestHandler):
    """Handler HTTP request sederhana untuk menerima perintah cetak."""

    def log_message(self, format, *args):
        # Kustom format log
        waktu = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{waktu}] {format % args}")

    def _set_cors_headers(self):
        """Set header CORS agar bisa diakses dari browser web app."""
        origin = self.headers.get("Origin", "")
        # Izinkan semua origin — request ini hanya bisa datang dari
        # browser di PC lokal karena server hanya listen di 127.0.0.1
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Printer-Name")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        """Preflight CORS request dari browser."""
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Status check endpoint."""
        if self.path == "/status":
            printer = get_default_printer() or "tidak ada"
            body = (
                f'{{"status": "ok", "printer": "{printer}", '
                f'"win32print": {str(HAS_WIN32PRINT).lower()}}}'
            ).encode("utf-8")
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Terima data ESC/POS dan cetak langsung ke printer."""
        if self.path != "/print":
            self.send_response(404)
            self.end_headers()
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            raw_data = self.rfile.read(content_length)

            # Nama printer bisa di-override via header request
            printer_name = self.headers.get("X-Printer-Name", "").strip() or None

            if not raw_data:
                raise ValueError("Data cetak kosong.")

            used_printer = send_raw_to_printer(raw_data, printer_name)

            body = (
                f'{{"status": "success", "message": "Struk berhasil dicetak.", '
                f'"printer": "{used_printer}"}}'
            ).encode("utf-8")

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

            self.log_message(
                f"[CETAK OK] Printer: {used_printer} | Ukuran data: {len(raw_data)} byte"
            )

        except Exception as e:
            error_msg = str(e).replace('"', "'")
            body = (
                f'{{"status": "error", "message": "{error_msg}"}}'
            ).encode("utf-8")
            self.send_response(500)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

            self.log_message(f"[CETAK GAGAL] {e}")


def main():
    if not HAS_WIN32PRINT:
        print("=" * 50)
        print("ERROR: win32print tidak tersedia!")
        print("Jalankan: pip install pywin32")
        print("=" * 50)
        sys.exit(1)

    printer = get_default_printer()
    print("=" * 55)
    print("  LOCAL PRINT SERVER - Harmoni Agro Sistem Kasir")
    print("=" * 55)
    print(f"  Port    : {PRINT_SERVER_PORT}")
    print(f"  Printer : {printer or 'Tidak ada default printer'}")
    print(f"  Status  : http://127.0.0.1:{PRINT_SERVER_PORT}/status")
    print("-" * 55)
    print("  Server aktif. Tekan CTRL+C untuk berhenti.")
    print("=" * 55)

    server = HTTPServer(("127.0.0.1", PRINT_SERVER_PORT), PrintHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Local Print Server dihentikan.")
        server.server_close()


if __name__ == "__main__":
    main()
