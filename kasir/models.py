from django.db import models


class TbUser(models.Model):
    id_user = models.AutoField(primary_key=True, db_column="id_user")

    nama = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        db_column="nama",
    )

    username = models.CharField(
        max_length=15,
        unique=True,
        db_column="username",
        db_index=True,
    )

    password = models.CharField(
        max_length=255,
        db_column="password",
    )

    ROLE_CHOICES = (
        ("pemilik", "Pemilik"),
        ("kasir", "Kasir"),
    )

    STATUS_CHOICES = (
        ("aktif", "Aktif"),
        ("tidak aktif", "Tidak Aktif"),
    )

    role = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="role",
        choices=ROLE_CHOICES,
    )

    status = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="status",
        choices=STATUS_CHOICES,
    )

    foto = models.ImageField(
        upload_to="profile/",
        blank=True,
        null=True,
        db_column="foto",
        max_length=255,
    )

    last_login = models.DateTimeField(
        blank=True,
        null=True,
        db_column="last_login",
    )

    created_at = models.DateTimeField(
        blank=True,
        null=True,
        db_column="created_at",
    )

    updated_at = models.DateTimeField(
        blank=True,
        null=True,
        db_column="updated_at",
    )

    class Meta:
        db_table = "tb_user"
        managed = False
        ordering = ["username"]

    def __str__(self):
        return self.username or f"User #{self.id_user}"


class TbKategori(models.Model):
    id_kategori = models.AutoField(
        primary_key=True,
        db_column="id_kategori",
    )

    nama_kategori = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="nama_kategori",
        db_index=True,
    )

    kode_kategori = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        db_column="kode_kategori",
        db_index=True,
    )

    class Meta:
        db_table = "tb_kategori"
        managed = False
        ordering = ["nama_kategori"]

    def __str__(self):
        return self.nama_kategori or f"Kategori #{self.id_kategori}"


class TbBarang(models.Model):
    id_barang = models.AutoField(
        primary_key=True,
        db_column="id_barang",
    )

    id_kategori = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_kategori",
        db_index=True,
    )

    id_supplier = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_supplier",
        db_index=True,
    )

    kode_barang = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="kode_barang",
        db_index=True,
    )

    jenis_barang = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="jenis_barang",
    )

    nama_barang = models.CharField(
        max_length=60,
        blank=True,
        null=True,
        db_column="nama_barang",
    )

    satuan = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        db_column="satuan",
    )

    harga_beli = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="harga_beli",
    )

    harga = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="harga_jual",
    )

    stok_minimal = models.IntegerField(
        blank=True,
        null=True,
        db_column="stok_minimal",
    )

    stok = models.IntegerField(
        blank=True,
        null=True,
        db_column="stok_saat_ini",
    )

    created_at = models.DateTimeField(
        blank=True,
        null=True,
        db_column="created_at",
    )

    updated_at = models.DateTimeField(
        blank=True,
        null=True,
        db_column="updated_at",
    )

    class Meta:
        db_table = "tb_barang"
        managed = False
        ordering = ["jenis_barang", "kode_barang"]

    def __str__(self):
        kode = self.kode_barang or "-"
        nama = self.nama_barang or "-"
        return f"{kode} - {nama}"

    @property
    def stok_safe(self):
        return int(self.stok or 0)

    @property
    def stok_minimal_safe(self):
        return int(self.stok_minimal or 0)

    @property
    def harga_safe(self):
        return int(self.harga or 0)

    @property
    def harga_beli_safe(self):
        return int(self.harga_beli or 0)
    
    @property
    def id_supplier_safe(self):
        return int(self.id_supplier or 0)


class TbSupplier(models.Model):
    id_supplier = models.AutoField(
        primary_key=True,
        db_column="id_supplier",
    )

    nama_perusahaan = models.CharField(
    max_length=30,
    blank=True,
    default="",
    db_column="nama_perusahaan"
    )

    nama_supplier = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        db_column="nama_supplier",
        db_index=True,
    )

    no_hp = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        db_column="no_hp",
    )

    alamat = models.TextField(
        blank=True,
        null=True,
        db_column="alamat",
    )

    STATUS_SUPPLIER_CHOICES = (
        ("aktif", "Aktif"),
        ("nonaktif", "Nonaktif"),
    )

    status_supplier = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="status_supplier",
        choices=STATUS_SUPPLIER_CHOICES,
    )

    class Meta:
        db_table = "tb_supplier"
        managed = False
        ordering = ["nama_supplier"]

    def __str__(self):
        return self.nama_supplier or f"Supplier #{self.id_supplier}"
    

class TbTransaksi(models.Model):
    id_transaksi = models.AutoField(
        primary_key=True,
        db_column="id_transaksi",
    )

    no_jual = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="no_jual",
    )

    tanggal_waktu = models.DateTimeField(
        blank=True,
        null=True,
        db_column="tanggal_waktu",
        db_index=True,
    )

    sumber_penjualan = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="sumber_penjualan",
    )

    metode_bayar = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        db_column="metode_bayar",
    )

    marketplace = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        db_column="marketplace",
    )


    id_kasir = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_kasir",
        db_index=True,
    )

    nama_kasir = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        db_column="nama_kasir",
    )

    no_pesanan_online = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="no_pesanan_online",
    )

    total_item = models.IntegerField(
        blank=True,
        null=True,
        db_column="total_item",
    )

    total_harga = models.IntegerField(
        blank=True,
        null=True,
        db_column="total_harga",
    )

    nominal_bayar = models.IntegerField(
        blank=True,
        null=True,
        db_column="nominal_bayar",
    )

    kembalian = models.IntegerField(
        blank=True,
        null=True,
        db_column="kembalian",
    )

    class Meta:
        db_table = "tb_penjualan"
        managed = False
        ordering = ["-id_transaksi"]

    def __str__(self):
        kode = self.no_jual or f"TRX-{self.id_transaksi}"
        return f"{kode} - Total {self.total_harga or 0}"


class TbTransaksiDetail(models.Model):
    id_detail = models.AutoField(
        primary_key=True,
        db_column="id_detail",
    )

    id_transaksi = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_transaksi",
        db_index=True,
    )

    id_barang = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_barang",
        db_index=True,
    )

    kode_barang = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="kode_barang",
    )

    nama_barang = models.CharField(
        max_length=60,
        blank=True,
        null=True,
        db_column="nama_barang",
    )

    qty = models.IntegerField(
        blank=True,
        null=True,
        db_column="qty",
    )

    harga_satuan = models.IntegerField(
        blank=True,
        null=True,
        db_column="harga_satuan",
    )

    subtotal = models.IntegerField(
        blank=True,
        null=True,
        db_column="subtotal",
    )

    kode_barang_snapshot = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="kode_barang_snapshot",
        db_index=True,
    )

    nama_barang_snapshot = models.CharField(
        max_length=60,
        blank=True,
        null=True,
        db_column="nama_barang_snapshot",
    )

    jenis_barang_snapshot = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="jenis_barang_snapshot",
        db_index=True,
    )

    satuan_snapshot = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        db_column="satuan_snapshot",
    )

    harga_beli_snapshot = models.IntegerField(
        blank=True,
        null=True,
        db_column="harga_beli_snapshot",
    )

    class Meta:
        db_table = "tb_penjualan_detail"
        managed = False
        ordering = ["id_detail"]

    def __str__(self):
        return (
            f"Detail #{self.id_detail} | "
            f"trx={self.id_transaksi} barang={self.id_barang} qty={self.qty or 0}"
        )


class TbPembelian(models.Model):
    id_pembelian = models.AutoField(
        primary_key=True,
        db_column="id_pembelian",
    )

    no_pembelian = models.CharField(
        max_length=25,
        blank=True,
        null=True,
        db_column="no_pembelian",
        db_index=True,
    )

    tanggal_pembelian = models.DateTimeField(
        blank=True,
        null=True,
        db_column="tanggal_pembelian",
        db_index=True,
    )

    id_supplier = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_supplier",
        db_index=True,
    )

    id_user = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_user",
        db_index=True,
    )

    STATUS_PEMBELIAN_CHOICES = (
        ("draft", "Draft"),
        ("dipesan", "Dipesan"),
        ("diterima", "Diterima"),
        ("batal", "Batal"),
    )

    status_pembelian = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="status_pembelian",
        choices=STATUS_PEMBELIAN_CHOICES,
    )

    total_item = models.IntegerField(
        blank=True,
        null=True,
        db_column="total_item",
    )

    total_harga = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="total_harga",
    )

    tanggal_diterima = models.DateTimeField(
        blank=True,
        null=True,
        db_column="tanggal_diterima",
    )

    class Meta:
        db_table = "tb_pembelian"
        managed = False
        ordering = ["-id_pembelian"]

    def __str__(self):
        return self.no_pembelian or f"Pembelian #{self.id_pembelian}"

    @property
    def total_harga_safe(self):
        return int(self.total_harga or 0)


class TbDetailPembelian(models.Model):
    id_detail_pembelian = models.AutoField(
        primary_key=True,
        db_column="id_detail_pembelian",
    )

    id_pembelian = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_pembelian",
        db_index=True,
    )

    id_barang = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_barang",
        db_index=True,
    )

    qty = models.IntegerField(
        blank=True,
        null=True,
        db_column="qty",
    )

    harga_beli = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="harga_beli",
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="subtotal",
    )

    class Meta:
        db_table = "tb_detail_pembelian"
        managed = False
        ordering = ["id_detail_pembelian"]

    def __str__(self):
        return (
            f"Detail Pembelian #{self.id_detail_pembelian} | "
            f"pembelian={self.id_pembelian} barang={self.id_barang} qty={self.qty or 0}"
        )

    @property
    def harga_beli_safe(self):
        return int(self.harga_beli or 0)

    @property
    def subtotal_safe(self):
        return int(self.subtotal or 0)


class TbRetur(models.Model):
    id_retur = models.AutoField(
        primary_key=True,
        db_column="id_retur",
    )

    id_detail_pembelian = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_detail_pembelian",
        db_index=True,
    )

    tanggal_retur = models.DateTimeField(
        blank=True,
        null=True,
        db_column="tanggal_retur",
        db_index=True,
    )

    jumlah_retur = models.IntegerField(
        blank=True,
        null=True,
        db_column="jumlah_retur",
    )

    alasan = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_column="alasan",
    )

    STATUS_RETUR_CHOICES = (
        ("diajukan", "Diajukan"),
        ("diproses", "Belum Selesai"),
        ("selesai", "Selesai"),
        ("batal", "Batal"),
    )

    status_retur = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="status_retur",
        choices=STATUS_RETUR_CHOICES,
    )

    class Meta:
        db_table = "tb_retur"
        managed = False
        ordering = ["-id_retur"]

    def __str__(self):
        return f"Retur #{self.id_retur}"

    @property
    def jumlah_retur_safe(self):
        return int(self.jumlah_retur or 0)

    @property
    def status_label(self):
        status = (self.status_retur or "").lower()

        if status == "diproses":
            return "Belum Selesai"
        if status == "selesai":
            return "Selesai"
        if status == "batal":
            return "Batal"
        if status == "diajukan":
            return "Belum Selesai"

        return "-"


class TbPengembalian(models.Model):
    id_pengembalian = models.AutoField(
        primary_key=True,
        db_column="id_pengembalian",
    )

    id_retur = models.IntegerField(
        blank=True,
        null=True,
        db_column="id_retur",
        db_index=True,
    )

    tanggal_pengembalian = models.DateTimeField(
        blank=True,
        null=True,
        db_column="tanggal_pengembalian",
        db_index=True,
    )

    JENIS_PENGEMBALIAN_CHOICES = (
        ("barang_pengganti", "Barang Pengganti"),
        ("refund", "Refund"),
    )

    jenis_pengembalian = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        db_column="jenis_pengembalian",
        choices=JENIS_PENGEMBALIAN_CHOICES,
    )

    qty_pengganti = models.IntegerField(
        blank=True,
        null=True,
        db_column="qty_pengganti",
    )

    nominal_refund = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        blank=True,
        null=True,
        db_column="nominal_refund",
    )

    STATUS_PENGEMBALIAN_CHOICES = (
        ("selesai", "Selesai"),
    )

    status_pengembalian = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="status_pengembalian",
        choices=STATUS_PENGEMBALIAN_CHOICES,
    )

    class Meta:
        db_table = "tb_pengembalian"
        managed = False
        ordering = ["-id_pengembalian"]

    def __str__(self):
        return f"Pengembalian #{self.id_pengembalian}"

    @property
    def qty_pengganti_safe(self):
        return int(self.qty_pengganti or 0)

    @property
    def nominal_refund_safe(self):
        return int(self.nominal_refund or 0)

    @property
    def jenis_label(self):
        jenis = (self.jenis_pengembalian or "").lower()

        if jenis == "barang_pengganti":
            return "Barang Pengganti"
        if jenis == "refund":
            return "Refund"

        return "-"

    @property
    def status_label(self):
        status = (self.status_pengembalian or "").lower()

        if status == "selesai":
            return "Selesai"

        return "-"

class TbLogAktivitas(models.Model):
    id_log = models.AutoField(
        primary_key=True,
        db_column="id_log",
    )

    nama_tabel = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_column="nama_tabel",
        db_index=True,
    )

    aksi = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        db_column="aksi",
        db_index=True,
    )

    id_data = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_column="id_data",
    )

    data_lama = models.JSONField(
        blank=True,
        null=True,
        db_column="data_lama",
    )

    data_baru = models.JSONField(
        blank=True,
        null=True,
        db_column="data_baru",
    )

    keterangan = models.TextField(
        blank=True,
        null=True,
        db_column="keterangan",
    )

    waktu = models.DateTimeField(
        blank=True,
        null=True,
        db_column="waktu",
        db_index=True,
    )

    class Meta:
        db_table = "tb_log_aktivitas"
        managed = False
        ordering = ["-waktu", "-id_log"]

    def __str__(self):
        return f"{self.aksi or '-'} {self.nama_tabel or '-'} #{self.id_data or '-'}"