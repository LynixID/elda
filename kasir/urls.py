from django.urls import path
from . import views

app_name = "kasir"

urlpatterns = [
    path("", views.index, name="index"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("lupapassword/", views.lupa_password, name="lupapassword"),
    path("edit/", views.akun_edit, name="akun_edit"),
    path("tambah/", views.akun_tambah, name="akun_tambah"),

    path("home/", views.home, name="home"),

    # =========================
    # TRANSAKSI PENJUALAN
    # =========================
    path("transaksi/", views.transaksi, name="transaksi"),
    path("transaksi/simpan/", views.transaksi_simpan, name="transaksi_simpan"),
    path("transaksi/midtrans-token/", views.transaksi_midtrans_token, name="transaksi_midtrans_token"),
    path(
        "transaksi/<int:id_transaksi>/cetak/",
        views.cetak_struk_transaksi,
        name="cetak_struk_transaksi"
    ),

    # =========================
    # MASTER DATA - BARANG
    # =========================
    path("barang/", views.barang, name="barang"),
    path("barang/json/", views.barang_json, name="barang_json"),
    path("barang/import/", views.barang_import, name="barang_import"),
    path("barang/export/", views.barang_export, name="barang_export"),
    path("barang/create/", views.barang_create, name="barang_create"),
    path("barang/edit/", views.barang_edit, name="barang_edit"),
    path("barang/delete/", views.barang_delete, name="barang_delete"),
    path("barang/delete-all/", views.barang_delete_all, name="barang_delete_all"),

    # =========================
    # MASTER DATA - KATEGORI
    # =========================
    path("kategori/", views.kategori, name="kategori"),
    path("kategori/json/", views.kategori_json, name="kategori_json"),
    path("kategori/create/", views.kategori_create, name="kategori_create"),
    path("kategori/edit/", views.kategori_edit, name="kategori_edit"),
    path("kategori/delete/", views.kategori_delete, name="kategori_delete"),
    path("kategori/delete-all/", views.kategori_delete_all, name="kategori_delete_all"),

    # =========================
    # RIWAYAT
    # =========================
    path("riwayat/", views.riwayat, name="riwayat"),
    path("riwayat/detail/<int:id_transaksi>/", views.riwayat_detail, name="riwayat_detail"),
    path(
        "riwayat/bulanan-detail/<int:tahun>/<int:bulan>/",
        views.riwayat_bulanan_detail,
        name="riwayat_bulanan_detail",
    ),
    path(
    "riwayat/download-bulanan/",
    views.download_riwayat_bulanan,
    name="download_riwayat_bulanan"
    ),

    # =========================
    # PENDAPATAN
    # =========================
    path("pendapatan/", views.pendapatan, name="pendapatan"),

    # =========================
    # REKOMENDASI
    # =========================
    path("rekomendasi/", views.rekomendasi_halaman, name="rekomendasi"),
    path("rekomendasi/proses/", views.rekomendasi_proses, name="rekomendasi_proses"),

    # =========================
    # SUPPLIER
    # =========================
    path("supplier/json/", views.supplier_json, name="supplier_json"),
    path("supplier/create/", views.supplier_create, name="supplier_create"),
    path("supplier/edit/", views.supplier_edit, name="supplier_edit"),
    path("supplier/delete/", views.supplier_delete, name="supplier_delete"),

    # =========================
    # PEMBELIAN
    # =========================
    path("pembelian/", views.pembelian_halaman, name="pembelian"),
    path("pembelian/json/", views.pembelian_json, name="pembelian_json"),
    path("pembelian/simpan/", views.pembelian_simpan, name="pembelian_simpan"),
    path("pembelian/terima/", views.pembelian_terima, name="pembelian_terima"),
    path("pembelian/delete/", views.pembelian_delete, name="pembelian_delete"),

    # =========================
    # RETUR
    # =========================
    path("retur/", views.retur, name="retur"),
    path("retur/json/", views.retur_json, name="retur_json"),
    path("retur/detail-options/", views.retur_detail_options, name="retur_detail_options"),
    path("retur/create/", views.retur_create, name="retur_create"),
    path("retur/status/", views.retur_update_status, name="retur_update_status"),
    path("retur/selesaikan/", views.retur_selesaikan, name="retur_selesaikan"),

    # =========================
    # PENGEMBALIAN
    # =========================
    path("pengembalian/", views.pengembalian, name="pengembalian"),
    path("pengembalian/json/", views.pengembalian_json, name="pengembalian_json"),
    path("pengembalian/retur-options/", views.pengembalian_retur_options, name="pengembalian_retur_options"),
    path("pengembalian/create/", views.pengembalian_create, name="pengembalian_create"),
    path("pengembalian/status/", views.pengembalian_update_status, name="pengembalian_update_status"),

]