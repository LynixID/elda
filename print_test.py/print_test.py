import win32print

printers = [printer[2] for printer in win32print.EnumPrinters(2)]

print("Daftar printer:")
for printer in printers:
    print("-", printer)

PRINTER_NAME = "RONGTA 80mm Series Printer"

data = (
    b"\x1b@"  # reset printer
    b"TEST PRINT RPP02N\n"
    b"========================\n"
    b"Berhasil print dari Python\n"
    b"Tanpa Chrome preview\n"
    b"========================\n"
    b"\n\n\n"
)

try:
    hprinter = win32print.OpenPrinter(PRINTER_NAME)
    try:
        job = win32print.StartDocPrinter(hprinter, 1, ("Test RPP02N", None, "RAW"))
        win32print.StartPagePrinter(hprinter)
        win32print.WritePrinter(hprinter, data)
        win32print.EndPagePrinter(hprinter)
        win32print.EndDocPrinter(hprinter)
        print("Print berhasil dikirim ke:", PRINTER_NAME)
    finally:
        win32print.ClosePrinter(hprinter)

except Exception as e:
    print("Gagal print:", e)