import win32print
from django.conf import settings


def _rupiah(value):
    try:
        value = int(value or 0)
    except Exception:
        value = 0
    return f"Rp {value:,}".replace(",", ".")


def _text(value):
    return str(value or "").encode("cp850", errors="replace")


def _line(width=32):
    return "-" * width + "\n"


def _left_right(left, right, width=32):
    left = str(left)
    right = str(right)
    space = width - len(left) - len(right)
    if space < 1:
        space = 1
    return left + (" " * space) + right + "\n"


def raw_print(data: bytes):
    printer_name = settings.THERMAL_PRINTER_NAME

    hprinter = win32print.OpenPrinter(printer_name)
    try:
        job = win32print.StartDocPrinter(
            hprinter,
            1,
            ("Struk Transaksi", None, "RAW")
        )
        win32print.StartPagePrinter(hprinter)
        win32print.WritePrinter(hprinter, data)
        win32print.EndPagePrinter(hprinter)
        win32print.EndDocPrinter(hprinter)
    finally:
        win32print.ClosePrinter(hprinter)


def cetak_struk(transaksi, details):
    width = 32
    data = b""

    data += b"\x1b@"  # reset printer

    data += _text("Toko Pertanian Harmoni Agro\n")
    data += _text("Jl. Puspita Jaya, Krajan\n")
    data += _text("Telp. 085790727110\n")
    data += _text(_line(width))

    data += _text(f"No: {getattr(transaksi, 'no_jual', '-')}\n")
    data += _text(f"Tanggal: {getattr(transaksi, 'tanggal_waktu', '-')}\n")
    data += _text(f"Kasir: {getattr(transaksi, 'nama_kasir', '-')}\n")
    data += _text(_line(width))

    for item in details:
        nama = (
            getattr(item, "nama_barang_snapshot", None)
            or getattr(item, "nama_barang", None)
            or "-"
        )
        qty = getattr(item, "qty", 0)
        harga = getattr(item, "harga_satuan", 0)
        subtotal = getattr(item, "subtotal", 0)

        data += _text(nama[:width] + "\n")
        data += _text(_left_right(f"{qty} x {_rupiah(harga)}", _rupiah(subtotal), width))

    data += _text(_line(width))
    data += _text(_left_right("Total", _rupiah(getattr(transaksi, "total_harga", 0)), width))
    data += _text(_left_right("Bayar", _rupiah(getattr(transaksi, "nominal_bayar", 0)), width))
    data += _text(_left_right("Kembali", _rupiah(getattr(transaksi, "kembalian", 0)), width))

    data += _text(_line(width))
    data += _text("Barang yang sudah dibeli\n")
    data += _text("tidak dapat ditukar kembali.\n")
    data += _text("\nTerima kasih\n")
    data += _text("\n\n\n")

    raw_print(data)