(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    body.classList.add("rekom-top-hidden");

    const qs = (selector, root = document) => root.querySelector(selector);
    const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
   /* =========================================================
      NAVBAR DROPDOWN HOVER MODE FINAL FIX
    ========================================================= */

    function tutupSemuaDropdownNavbar() {
      qsa("[data-nav-dropdown]").forEach((drop) => {
        drop.classList.remove("open");

        const toggle = drop.querySelector("[data-nav-toggle]");
        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    /* Tombol Transaksi / Master Data:
      Hover dari CSS yang menampilkan submenu.
      Klik tombol hanya membersihkan class open yang nyangkut. */
    qsa("[data-nav-toggle]").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        tutupSemuaDropdownNavbar();
      });
    });

    /* Link submenu:
      Jangan pakai preventDefault.
      Jangan pakai window.location.assign.
      Biarkan href dari HTML/Django berjalan normal.
      Ini supaya sekali klik langsung pindah halaman. */
    qsa(".nav-dropdown-menu a[href]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    });

    /* Saat kursor keluar dari navbar, tutup class open yang tersisa */
    const navMenuUtama = qs(".nav-menu");

    if (navMenuUtama) {
      navMenuUtama.addEventListener("mouseleave", () => {
        tutupSemuaDropdownNavbar();
      });
    }

    /* Klik luar dropdown baru tutup */
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-nav-dropdown]")) return;
      tutupSemuaDropdownNavbar();
    });

    /* ESC tutup semua dropdown */
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        tutupSemuaDropdownNavbar();
      }
    });
    /* =========================================================
       TOGGLE TOPBAR
    ========================================================= */
    const btnToggleTop = qs("[data-rekom-toggle-top]");

    function syncRekomTopbarButton() {
      if (!btnToggleTop) return;

      btnToggleTop.textContent = body.classList.contains("rekom-top-hidden")
        ? "Tampilkan Atas"
        : "Sembunyikan Atas";
    }

    if (btnToggleTop) {
      syncRekomTopbarButton();

      btnToggleTop.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        body.classList.toggle("rekom-top-hidden");
        syncRekomTopbarButton();
      });
    }

    /* =========================================================
       STATE
    ========================================================= */
    const state = {
      response: null,
      items: [],
      itemsTampil: [],
      itemsFinalBeli: [],
      lastPayload: null,
    };

    const endpoint = window.REKOMENDASI_PROSES_URL || "/rekomendasi/proses/";

    const el = {
      tanggalMulai: qs("#tanggalMulaiRekomendasi"),
      tanggalSelesai: qs("#tanggalSelesaiRekomendasi"),
      jenisBarang: qs("#jenisBarangRekomendasi"),
      danaMaksimal: qs("#danaMaksimal"),

      btnProses: qs("#tombolProsesRekomendasi"),
      btnReset: qs("#tombolResetRekomendasi"),
      btnBuatPembelian: qs("#btnBuatPembelianDariRekomendasi"),

      popupHasil: qs("#popupHasilRekomendasi"),
      popupDetail: qs("#popupDetailPerhitungan"),

      ringkasPeriode: qs("#ringkasPeriode"),
      ringkasJenis: qs("#ringkasJenis"),
      ringkasDana: qs("#ringkasDana"),

      ringkasTotalRekomendasi: qs("#ringkasTotalRekomendasi"),
      totalDanaDigunakan: qs("#totalDanaDigunakan"),
      sisaDana: qs("#sisaDana"),
      barangPrioritasUtama: qs("#barangPrioritasUtama"),
      keteranganPrioritasUtama: qs("#keteranganPrioritasUtama"),

      isiTabel: qs("#isiTabelRekomendasi"),

      judulDetailItem: qs("#judulDetailItem"),
      detailKodeBarang: qs("#detailKodeBarang"),
      detailNamaBarang: qs("#detailNamaBarang"),
      detailSatuanBarang: qs("#detailSatuanBarang"),
      detailStokSaatIni: qs("#detailStokSaatIni"),
      detailStokMinimal: qs("#detailStokMinimal"),
      detailTerjualPeriode: qs("#detailTerjualPeriode"),
      detailStatusKebutuhan: qs("#detailStatusKebutuhan"),

      detailRekomendasiIdeal: qs("#detailRekomendasiIdeal"),
      detailQtyFinalBeli: qs("#detailQtyFinalBeli"),
      detailHargaBeliSatuan: qs("#detailHargaBeliSatuan"),
      detailDanaFinalBeli: qs("#detailDanaFinalBeli"),

      detailPenjelasanSederhana: qs("#detailPenjelasanSederhana"),
    };

    [el.popupHasil, el.popupDetail].forEach((popup) => {
      if (popup && popup.parentElement !== document.body) {
        document.body.appendChild(popup);
      }
    });

    /* =========================================================
       HELPER DASAR
    ========================================================= */
    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function parseNominal(value) {
      if (value === null || value === undefined) return 0;
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;

      const raw = String(value).trim();
      if (!raw) return 0;

      const cleaned = raw
        .replace(/Rp/gi, "")
        .replace(/\s+/g, "")
        .replace(/\./g, "")
        .replace(/,/g, "");

      const num = Number(cleaned);
      return Number.isFinite(num) ? num : 0;
    }

    function formatRupiah(value) {
      const n = Math.max(0, parseNominal(value));
      return `Rp ${n.toLocaleString("id-ID")}`;
    }

    function formatAngka(value, fractionDigits = 4) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "0";
      if (Number.isInteger(n)) return n.toString();

      return n
        .toFixed(fractionDigits)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
    }

    function angkaBulat(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.round(n);
    }

    function formatJumlahBarang(value) {
      return `${angkaBulat(value || 0)} barang`;
    }

    function formatTanggalIndonesia(isoDate) {
      if (!isoDate) return "";

      const parts = String(isoDate).split("-");
      if (parts.length !== 3) return String(isoDate);

      const [year, month, day] = parts;
      return `${day}-${month}-${year}`;
    }

    function labelJenisBarang(value) {
      const raw = String(value || "").trim();

      if (!raw || raw.toUpperCase() === "SEMUA") {
        return "Semua jenis";
      }

      return raw;
    }

    function ambilNilaiPertama(item, daftarKey, fallback = 0) {
      for (const key of daftarKey) {
        if (
          item &&
          item[key] !== undefined &&
          item[key] !== null &&
          item[key] !== ""
        ) {
          return item[key];
        }
      }

      return fallback;
    }

    function ambilRekomendasiIdeal(item) {
      return ambilNilaiPertama(
        item,
        [
          "rekomendasi_beli",
          "rekomendasi_ideal",
          "target_restock",
          "rekomendasi_fuzzy",
          "nilai_rekomendasi_fuzzy",
          "rekomendasi_item"
        ],
        0
      );
    }

    function ambilQtyFinal(item) {
      const ideal = parseNominal(ambilRekomendasiIdeal(item));

      const qty = parseNominal(
        ambilNilaiPertama(
          item,
          [
            "qty_final_beli",
            "qty_final",
            "jumlah_dibeli",
            "jumlahDibeli",
            "qty_beli"
          ],
          0
        )
      );

      if (ideal > 0) {
        return Math.min(qty, ideal);
      }

      return qty;
    }

    function ambilDanaFinal(item) {
      const qtyFinal = parseNominal(ambilQtyFinal(item));

      const hargaBeli = parseNominal(
        ambilNilaiPertama(
          item,
          [
            "harga_beli",
            "harga_beli_satuan",
            "harga_satuan",
            "harga",
            "harga_beli_snapshot",
            "harga_modal"
          ],
          0
        )
      );

      const danaBackend = parseNominal(
        ambilNilaiPertama(
          item,
          [
            "dana_final_beli",
            "dana_final",
            "dana_dibutuhkan",
            "total_dana",
            "totalDana"
          ],
          0
        )
      );

      if (qtyFinal > 0 && hargaBeli > 0) {
        return qtyFinal * hargaBeli;
      }

      return danaBackend;
    }

    function getKodeBarang(item) {
      return String(item?.kode_barang ?? item?.kode ?? "-");
    }

    function getNamaBarang(item) {
      return String(item?.nama_barang ?? item?.nama ?? "-");
    }

    function getSatuanBarang(item) {
      return String(
        item?.satuan ??
        item?.satuan_barang ??
        item?.ukuran ??
        item?.besaran ??
        "-"
      );
    }

    function getNamaBarangLabel(item) {
      const label = String(item?.nama_barang_label || "").trim();
      if (label) return label;

      const nama = getNamaBarang(item);
      const satuan = getSatuanBarang(item);

      if (satuan && satuan !== "-") {
        return `${nama} - ${satuan}`;
      }

      return nama;
    }

    function ambilHargaBeli(item, qtyFinal = 0, danaFinal = 0) {
      const hargaLangsung = parseNominal(
        ambilNilaiPertama(
          item,
          [
            "harga_beli",
            "harga_beli_satuan",
            "harga_satuan",
            "harga",
            "harga_beli_snapshot",
            "harga_modal",
          ],
          0
        )
      );

      if (hargaLangsung > 0) return hargaLangsung;

      const qty = Number(qtyFinal || 0);
      const dana = parseNominal(danaFinal || 0);

      if (qty > 0 && dana > 0) {
        return dana / qty;
      }

      return 0;
    }

    function getCsrfToken() {
      const meta = qs('meta[name="csrf-token"]');
      if (meta && meta.content) return meta.content;

      const cookie = document.cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("csrftoken="));

      return cookie ? decodeURIComponent(cookie.split("=")[1]) : "";
    }

    function setupInputRupiah(input) {
      if (!input) return;

      input.addEventListener("input", () => {
        const angka = parseNominal(input.value);
        input.value = angka > 0 ? formatRupiah(angka) : "";
      });

      input.addEventListener("blur", () => {
        const angka = parseNominal(input.value);
        input.value = angka > 0 ? formatRupiah(angka) : "";
      });
    }

    function bukaPopup(node) {
      if (!node) return;

      node.classList.add("show");
      node.setAttribute("aria-hidden", "false");
      body.classList.add("modal-open");
    }

    function tutupPopup(node) {
      if (!node) return;

      node.classList.remove("show");
      node.setAttribute("aria-hidden", "true");

      const adaPopupAktif = qsa(".popup-latar-rekomendasi.show").length > 0;
      if (!adaPopupAktif) body.classList.remove("modal-open");
    }

    /* =========================================================
       STATUS & ALASAN
    ========================================================= */
    function labelStatusKebutuhan(item) {
      const labelBackend = String(item?.status_kebutuhan_label || "").trim();
      if (labelBackend) return labelBackend;

      const statusBackend = String(item?.status_kebutuhan || "").trim().toLowerCase();

      if (statusBackend === "aman") return "Aman";
      if (statusBackend === "belum_terbeli") return "Belum Terbeli";
      if (statusBackend === "sangat_perlu_restock") return "Sangat Perlu Restock";
      if (statusBackend === "perlu_restock") return "Perlu Restock";

      const stok = Number(item?.stok_saat_ini ?? item?.stok ?? 0);
      const stokMinimal = Number(item?.stok_minimal ?? item?.stok_pengaman ?? 0);
      const terjual = Number(item?.terjual_periode ?? item?.terjual ?? item?.total_terjual ?? 0);

      const rekomendasiIdeal = Number(ambilRekomendasiIdeal(item) || 0);
      const qtyFinal = Number(ambilQtyFinal(item) || 0);

      if (rekomendasiIdeal <= 0) return "Aman";
      if (qtyFinal <= 0) return "Belum Terbeli";

      if (stok <= 0 && (terjual > 0 || stokMinimal > 0)) {
        return "Sangat Perlu Restock";
      }

      if (stokMinimal > 0 && stok <= stokMinimal) {
        return "Perlu Restock";
      }

      if (qtyFinal > 0 || rekomendasiIdeal > 0) {
        return "Perlu Restock";
      }

      return "Aman";
    }

    function badgeStatusKebutuhan(status) {
      const raw = String(status || "").trim().toLowerCase();

      if (raw === "aman") {
        return `<span class="badge-status status-aman">Aman</span>`;
      }

      if (raw.includes("belum")) {
        return `<span class="badge-status status-belum-terbeli">Belum Terbeli</span>`;
      }

      if (raw.includes("sangat")) {
        return `<span class="badge-status status-sangat-perlu-restock">Sangat Perlu Restock</span>`;
      }

      return `<span class="badge-status status-perlu-restock">Perlu Restock</span>`;
    }

    function alasanSingkat(item) {
      const alasanBackend = String(
        item?.penjelasan_prioritas ||
        item?.penjelasan ||
        item?.alasan_singkat ||
        item?.penjelasan_sederhana ||
        item?.alasan ||
        ""
      ).trim();

      if (alasanBackend) return alasanBackend;

      const stok = Number(item?.stok_saat_ini ?? item?.stok ?? 0);
      const stokMinimal = Number(item?.stok_minimal ?? item?.stok_pengaman ?? 0);
      const terjual = Number(item?.terjual_periode ?? item?.terjual ?? item?.total_terjual ?? 0);

      const rekomendasiIdeal = Number(ambilRekomendasiIdeal(item) || 0);
      const qtyFinal = Number(ambilQtyFinal(item) || 0);

      if (rekomendasiIdeal <= 0) {
        return "Stok barang masih aman pada periode yang dipilih.";
      }

      if (qtyFinal <= 0) {
        return `Barang membutuhkan pembelian ${rekomendasiIdeal} barang, tetapi belum masuk pembelian karena dana tidak mencukupi.`;
      }

      if (stok <= 0 && terjual > 0) {
        return `Stok habis dan masih terjual ${terjual} barang pada periode ini. Barang menjadi prioritas restock.`;
      }

      if (stokMinimal > 0 && stok < stokMinimal) {
        return `Stok saat ini ${stok} berada di bawah stok minimal ${stokMinimal}. Barang perlu direstock.`;
      }

      if (qtyFinal < rekomendasiIdeal) {
        return `Sistem menyarankan ${rekomendasiIdeal} barang, tetapi final beli menjadi ${qtyFinal} barang karena menyesuaikan batas dana.`;
      }

      if (stok <= 0) {
        return `Stok barang sudah habis. Sistem menyarankan pembelian ${qtyFinal} barang agar stok tersedia kembali.`;
      }

      if (terjual > 0) {
        return `Barang ini terjual ${terjual} pada periode yang dipilih. Sistem menyarankan pembelian ${qtyFinal} barang untuk menjaga ketersediaan stok.`;
      }

     return "Prioritas dihitung berdasarkan stok saat ini, stok minimal, penjualan periode, dan hasil rekomendasi sistem.";
    }

    function ambilPrioritasBackend(response) {
      const ringkasan = response?.ringkasan || {};

      if (ringkasan.barang_prioritas && typeof ringkasan.barang_prioritas === "object") {
        const p = ringkasan.barang_prioritas;

        const kode = String(p.kode_barang || "").trim();
        const nama = String(p.nama_barang || p.nama_barang_label || "").trim();
        const penjelasan = String(p.penjelasan || p.penjelasan_prioritas || "").trim();

        if (kode || nama || penjelasan) {
          return {
            kode_barang: kode,
            nama_barang: nama,
            nama_barang_label: nama,
            prioritas: p.prioritas || 0,
            penjelasan_prioritas: penjelasan,
            penjelasan: penjelasan,
          };
        }
      }

      const label = String(ringkasan.barang_prioritas_utama_label || "").trim();
      const alasan = String(ringkasan.barang_prioritas_utama_alasan || "").trim();

      if (label || alasan) {
        let kode = "";
        let nama = label;

        if (label.includes(" - ")) {
          const parts = label.split(" - ");
          kode = parts.shift() || "";
          nama = parts.join(" - ") || "";
        }

        return {
          kode_barang: kode,
          nama_barang: nama,
          nama_barang_label: nama,
          penjelasan_prioritas: alasan,
          penjelasan: alasan,
        };
      }

      return null;
    }

    /* =========================================================
       TANGGAL
    ========================================================= */
    function toISODateLocal(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function setPeriodeDefault30Hari() {
      if (!el.tanggalMulai || !el.tanggalSelesai) return;

      if (el.tanggalMulai.value && el.tanggalSelesai.value) return;

      const hariIni = new Date();
      const mulai = new Date(hariIni);
      mulai.setDate(hariIni.getDate() - 29);

      el.tanggalMulai.value = toISODateLocal(mulai);
      el.tanggalSelesai.value = toISODateLocal(hariIni);
    }

    /* =========================================================
       DRAFT PEMBELIAN
    ========================================================= */
    function getIdBarang(item) {
      return Number(item?.id_barang ?? item?.id ?? item?.pk ?? 0);
    }

    function getHargaBeliBarang(item) {
      return parseNominal(
        item?.harga_beli ??
        item?.harga_beli_satuan ??
        item?.harga_modal ??
        item?.harga ??
        0
      );
    }

    function getIdSupplierBarang(item) {
      return Number(
        item?.id_supplier ??
        item?.supplier_id ??
        item?.idSupplier ??
        0
      );
    }

    function getSupplierLabelBarang(item) {
      const namaPerusahaan = String(item?.nama_perusahaan || "").trim();
      const namaSupplier = String(item?.nama_supplier || "").trim();

      if (item?.supplier_label) return String(item.supplier_label).trim();
      if (namaPerusahaan && namaSupplier) return `${namaPerusahaan} - ${namaSupplier}`;
      if (namaPerusahaan) return namaPerusahaan;
      if (namaSupplier) return namaSupplier;

      const idSupplier = getIdSupplierBarang(item);
      return idSupplier ? `Supplier #${idSupplier}` : "";
    }

    function buatDraftPembelianDariRekomendasi() {
      const items = Array.isArray(state.itemsFinalBeli) ? state.itemsFinalBeli : [];

      const itemsFinal = items
        .map((row) => {
          const item = row.item || row;

          const idBarang = getIdBarang(item);
          const idSupplier = getIdSupplierBarang(item);
          const qty = parseNominal(ambilQtyFinal(item));
          const hargaBeli = getHargaBeliBarang(item);
          const danaFinal = parseNominal(ambilDanaFinal(item));

          if (!idBarang || qty <= 0 || hargaBeli <= 0) {
            return null;
          }

          return {
            id_barang: idBarang,
            id_supplier: idSupplier,
            supplier_id: idSupplier,
            supplier_label: getSupplierLabelBarang(item),

            kode: getKodeBarang(item),
            nama: getNamaBarang(item),
            nama_barang: getNamaBarang(item),
            nama_barang_label: getNamaBarangLabel(item),
            satuan: getSatuanBarang(item),
            satuan_barang: getSatuanBarang(item),

            qty: qty,
            harga_beli: hargaBeli,
            subtotal: qty * hargaBeli,
            dana_final_beli: danaFinal || qty * hargaBeli,
          };
        })
        .filter(Boolean);

      if (!itemsFinal.length) {
        alert("Belum ada barang yang bisa dibuat pembelian. Pastikan batas dana mencukupi.");
        return;
      }

      const tanpaSupplier = itemsFinal.filter((item) => !Number(item.id_supplier || 0));

      if (tanpaSupplier.length) {
        alert(
          "Ada barang rekomendasi yang belum punya Supplier Utama di Data Barang. " +
          "Silakan edit barang tersebut dan pilih Supplier Utama dulu."
        );
        return;
      }

      const supplierIds = Array.from(
        new Set(itemsFinal.map((item) => Number(item.id_supplier || 0)).filter(Boolean))
      );

      const idSupplierDraft = supplierIds[0] || 0;

      const supplierLabelDraft =
        itemsFinal.find((item) => Number(item.id_supplier) === idSupplierDraft)?.supplier_label || "";

      const totalDanaDraft = itemsFinal.reduce((sum, item) => {
        return sum + Number(item.subtotal || 0);
      }, 0);

      const input = state.response?.input || {};
      const ringkasan = state.response?.ringkasan || {};

      const draft = {
        sumber: "rekomendasi",
        auto_terima: false,
        multi_supplier: supplierIds.length > 1,
        supplier_ids: supplierIds,
        tanggal_dibuat: new Date().toISOString(),

        id_supplier: idSupplierDraft,
        supplier_id: idSupplierDraft,
        supplier_label: supplierLabelDraft,

        periode_label: input.periode_label || "",
        jenis_barang: labelJenisBarang(
          input.jenis_barang ||
          state.lastPayload?.jenis_barang ||
          "SEMUA"
        ),

        dana_maksimal: parseNominal(
          input.dana_maksimal ??
          input.dana_maksimal_format ??
          state.response?.dana_maksimal ??
          0
        ),

        total_dana_digunakan: totalDanaDraft,
        sisa_dana: parseNominal(ringkasan.sisa_dana ?? 0),

        items: itemsFinal,
      };

      sessionStorage.setItem(
        "ha_draft_pembelian_rekomendasi",
        JSON.stringify(draft)
      );

      const url = window.PEMBELIAN_URL || "/pembelian/";
      window.location.href = `${url}?from=rekomendasi`;
    }

    /* =========================================================
       RESET
    ========================================================= */
    function resetDetail() {
      if (el.judulDetailItem) el.judulDetailItem.textContent = "-";
      if (el.detailKodeBarang) el.detailKodeBarang.textContent = "-";
      if (el.detailNamaBarang) el.detailNamaBarang.textContent = "-";
      if (el.detailSatuanBarang) el.detailSatuanBarang.textContent = "-";
      if (el.detailStokSaatIni) el.detailStokSaatIni.textContent = "0";
      if (el.detailStokMinimal) el.detailStokMinimal.textContent = "0";
      if (el.detailTerjualPeriode) el.detailTerjualPeriode.textContent = "0";
      if (el.detailStatusKebutuhan) el.detailStatusKebutuhan.textContent = "-";

      if (el.detailRekomendasiIdeal) el.detailRekomendasiIdeal.textContent = "0 barang";
      if (el.detailQtyFinalBeli) el.detailQtyFinalBeli.textContent = "0 barang";
      if (el.detailHargaBeliSatuan) el.detailHargaBeliSatuan.textContent = "Rp 0";
      if (el.detailDanaFinalBeli) el.detailDanaFinalBeli.textContent = "Rp 0";

      if (el.detailPenjelasanSederhana) el.detailPenjelasanSederhana.textContent = "-";
    }

    function resetHasil() {
      state.response = null;
      state.items = [];
      state.itemsTampil = [];
      state.itemsFinalBeli = [];

      if (el.isiTabel) {
        el.isiTabel.innerHTML = `
          <tr>
            <td colspan="10" class="sel-kosong-rekomendasi">Belum ada hasil rekomendasi.</td>
          </tr>
        `;
      }

      if (el.ringkasPeriode) el.ringkasPeriode.textContent = "-";
      if (el.ringkasJenis) el.ringkasJenis.textContent = "-";
      if (el.ringkasDana) el.ringkasDana.textContent = "-";

      if (el.ringkasTotalRekomendasi) el.ringkasTotalRekomendasi.textContent = "0 barang";
      if (el.totalDanaDigunakan) el.totalDanaDigunakan.textContent = "Rp 0";
      if (el.sisaDana) el.sisaDana.textContent = "Rp 0";
      if (el.barangPrioritasUtama) el.barangPrioritasUtama.textContent = "-";
      if (el.keteranganPrioritasUtama) el.keteranganPrioritasUtama.textContent = "-";

      resetDetail();
    }

    function resetForm() {
      if (el.jenisBarang) {
        el.jenisBarang.value = "SEMUA";

        if (el.jenisBarang.value !== "SEMUA" && el.jenisBarang.options.length) {
          el.jenisBarang.selectedIndex = 0;
        }
      }
      
      if (el.danaMaksimal) el.danaMaksimal.value = "";

      if (el.tanggalMulai) el.tanggalMulai.value = "";
      if (el.tanggalSelesai) el.tanggalSelesai.value = "";
      setPeriodeDefault30Hari();

      resetHasil();
      tutupPopup(el.popupDetail);
      tutupPopup(el.popupHasil);
    }

    /* =========================================================
       NORMALISASI RESPONSE
    ========================================================= */
    function ambilItemsDariResponse(response) {
      if (!response) return [];

      if (Array.isArray(response.items)) return response.items;
      if (Array.isArray(response.hasil)) return response.hasil;
      if (Array.isArray(response.data)) return response.data;
      if (Array.isArray(response.rekomendasi)) return response.rekomendasi;
      if (Array.isArray(response.daftar_rekomendasi)) return response.daftar_rekomendasi;

      return [];
    }

    /* =========================================================
       RENDER HASIL
    ========================================================= */
    function renderHasil(response) {
      state.response = response || {};
      state.items = ambilItemsDariResponse(state.response);

      const input = state.response.input || {};
      const ringkasan = state.response.ringkasan || {};
      const lastPayload = state.lastPayload || {};

      state.itemsTampil = state.items
        .map((item, indexAsli) => ({ item, indexAsli }))
        .filter((row) => {
          const rekomendasiIdeal = Number(ambilRekomendasiIdeal(row.item) || 0);
          return rekomendasiIdeal > 0;
        });

      state.itemsFinalBeli = state.itemsTampil.filter((row) => {
        const qtyFinal = Number(ambilQtyFinal(row.item) || 0);
        const danaFinal = parseNominal(ambilDanaFinal(row.item) || 0);
        return qtyFinal > 0 && danaFinal > 0;
      });

      const periodeLabel =
        input.periode_label ||
        state.response.periode_label ||
        (
          lastPayload.tanggal_mulai && lastPayload.tanggal_selesai
            ? `${formatTanggalIndonesia(lastPayload.tanggal_mulai)} s/d ${formatTanggalIndonesia(lastPayload.tanggal_selesai)}`
            : "-"
        );

      const jenisLabel = labelJenisBarang(
        input.jenis_barang ||
        state.response.jenis_barang ||
        lastPayload.jenis_barang ||
        "SEMUA"
      );
      const danaMaksimal = parseNominal(
        input.dana_maksimal ||
        state.response.dana_maksimal ||
        lastPayload.dana_maksimal ||
        0
      );

      if (el.ringkasPeriode) {
        el.ringkasPeriode.textContent = periodeLabel;
      }

      if (el.ringkasJenis) {
        el.ringkasJenis.textContent = jenisLabel;
      }

      if (el.ringkasDana) {
        el.ringkasDana.textContent =
          input.dana_maksimal_format ||
          state.response.dana_maksimal_format ||
          formatRupiah(danaMaksimal);
      }

      const totalFinalBeli =
        ringkasan.total_final_beli !== undefined && ringkasan.total_final_beli !== null
          ? Number(ringkasan.total_final_beli || 0)
          : state.itemsFinalBeli.reduce((sum, row) => {
              return sum + Number(ambilQtyFinal(row.item) || 0);
            }, 0);

      const totalDanaDigunakan =
        ringkasan.total_dana_digunakan !== undefined && ringkasan.total_dana_digunakan !== null
          ? parseNominal(ringkasan.total_dana_digunakan)
          : state.itemsFinalBeli.reduce((sum, row) => {
              return sum + parseNominal(ambilDanaFinal(row.item) || 0);
            }, 0);

      const sisaDana =
        ringkasan.sisa_dana !== undefined && ringkasan.sisa_dana !== null
          ? parseNominal(ringkasan.sisa_dana)
          : Math.max(0, danaMaksimal - totalDanaDigunakan);

      if (el.ringkasTotalRekomendasi) {
        el.ringkasTotalRekomendasi.textContent = formatJumlahBarang(totalFinalBeli);
      }

      if (el.totalDanaDigunakan) {
        el.totalDanaDigunakan.textContent =
          ringkasan.total_dana_digunakan_format ||
          formatRupiah(totalDanaDigunakan);
      }

      if (el.sisaDana) {
        el.sisaDana.textContent =
          ringkasan.sisa_dana_format ||
          formatRupiah(sisaDana);
      }

      const prioritasBackend = ambilPrioritasBackend(state.response);

      const prioritasUtama =
        prioritasBackend ||
        state.itemsFinalBeli[0]?.item ||
        state.itemsTampil[0]?.item ||
        null;

      if (el.barangPrioritasUtama) {
        if (prioritasUtama) {
          const kode = getKodeBarang(prioritasUtama);
          const namaLabel = getNamaBarangLabel(prioritasUtama);

          if (kode && kode !== "-") {
            el.barangPrioritasUtama.textContent = `${kode} - ${namaLabel}`;
          } else {
            el.barangPrioritasUtama.textContent = namaLabel;
          }
        } else {
          el.barangPrioritasUtama.textContent = "-";
        }
      }

      if (el.keteranganPrioritasUtama) {
        el.keteranganPrioritasUtama.textContent = prioritasUtama
          ? (
              prioritasUtama.penjelasan_prioritas ||
              prioritasUtama.penjelasan ||
              prioritasUtama.alasan_singkat ||
              alasanSingkat(prioritasUtama)
            )
          : "Belum ada barang yang membutuhkan pembelian pada periode ini.";
      }

      if (!el.isiTabel) return;

      if (!state.itemsTampil.length) {
        el.isiTabel.innerHTML = `
          <tr>
            <td colspan="10" class="sel-kosong-rekomendasi">
              Tidak ada barang yang perlu direkomendasikan pada periode ini.
            </td>
          </tr>
        `;
        return;
      }

      el.isiTabel.innerHTML = state.itemsTampil.map((row) => {
        const item = row.item;
        const indexAsli = row.indexAsli;

        const kodeBarang = getKodeBarang(item);
        const namaBarangLabel = getNamaBarangLabel(item);

        const stokSaatIni = item.stok_saat_ini ?? item.stok ?? 0;
        const stokMinimal = item.stok_minimal ?? item.stok_pengaman ?? 0;
        const terjualPeriode = item.terjual_periode ?? item.terjual ?? item.total_terjual ?? 0;

        const rekomendasiIdeal = ambilRekomendasiIdeal(item);
        const qtyFinal = ambilQtyFinal(item);
        const danaFinal = ambilDanaFinal(item);
        const status = labelStatusKebutuhan(item);

        return `
          <tr>
            <td>${escapeHtml(kodeBarang)}</td>

            <td class="sel-nama">${escapeHtml(namaBarangLabel)}</td>

            <td>${escapeHtml(formatAngka(stokSaatIni))}</td>

            <td>${escapeHtml(formatAngka(stokMinimal))}</td>

            <td>${escapeHtml(formatAngka(terjualPeriode))}</td>

            <td>
              <strong>${escapeHtml(formatJumlahBarang(rekomendasiIdeal))}</strong>
            </td>

            <td>
              <strong>${escapeHtml(formatJumlahBarang(qtyFinal))}</strong>
            </td>

            <td>
              <strong>${escapeHtml(formatRupiah(danaFinal))}</strong>
            </td>

            <td>${badgeStatusKebutuhan(status)}</td>

            <td>
              <button type="button" class="btn-aksi-detail" data-lihat-detail="${indexAsli}">
                Detail
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }

    /* =========================================================
       DETAIL
    ========================================================= */
    function tampilkanDetail(index) {
      const item = state.items[index];
      if (!item) return;

      const kode = getKodeBarang(item);
      const nama = getNamaBarang(item);
      const namaLabel = getNamaBarangLabel(item);
      const satuan = getSatuanBarang(item);

      const stokSaatIni = item.stok_saat_ini ?? item.stok ?? 0;
      const stokMinimal = item.stok_minimal ?? item.stok_pengaman ?? 0;
      const terjualPeriode = item.terjual_periode ?? item.terjual ?? item.total_terjual ?? 0;

      const rekomendasiIdeal = ambilRekomendasiIdeal(item);
      const qtyFinal = ambilQtyFinal(item);
      const danaFinal = ambilDanaFinal(item);
      const hargaBeli = ambilHargaBeli(item, qtyFinal, danaFinal);
      const status = labelStatusKebutuhan(item);

      if (el.judulDetailItem) el.judulDetailItem.textContent = `${kode} - ${namaLabel}`;
      if (el.detailKodeBarang) el.detailKodeBarang.textContent = kode;
      if (el.detailNamaBarang) el.detailNamaBarang.textContent = nama;
      if (el.detailSatuanBarang) el.detailSatuanBarang.textContent = satuan;
      if (el.detailStokSaatIni) el.detailStokSaatIni.textContent = formatAngka(stokSaatIni);
      if (el.detailStokMinimal) el.detailStokMinimal.textContent = formatAngka(stokMinimal);
      if (el.detailTerjualPeriode) el.detailTerjualPeriode.textContent = formatAngka(terjualPeriode);
      if (el.detailStatusKebutuhan) el.detailStatusKebutuhan.textContent = status;

      if (el.detailRekomendasiIdeal) {
        el.detailRekomendasiIdeal.textContent = formatJumlahBarang(rekomendasiIdeal);
      }

      if (el.detailQtyFinalBeli) {
        el.detailQtyFinalBeli.textContent = formatJumlahBarang(qtyFinal);
      }

      if (el.detailHargaBeliSatuan) {
        el.detailHargaBeliSatuan.textContent = formatRupiah(hargaBeli);
      }

      if (el.detailDanaFinalBeli) {
        el.detailDanaFinalBeli.textContent = formatRupiah(danaFinal);
      }

      if (el.detailPenjelasanSederhana) {
        el.detailPenjelasanSederhana.textContent = alasanSingkat(item);
      }

      bukaPopup(el.popupDetail);
    }

    /* =========================================================
       PROSES
    ========================================================= */
    async function prosesRekomendasi() {
      const tanggalMulai = el.tanggalMulai ? el.tanggalMulai.value : "";
      const tanggalSelesai = el.tanggalSelesai ? el.tanggalSelesai.value : "";
      const jenisBarang = el.jenisBarang ? el.jenisBarang.value : "SEMUA";
      const danaMaksimal = parseNominal(el.danaMaksimal ? el.danaMaksimal.value : 0);

      if (!tanggalMulai) {
        alert("Tanggal mulai wajib diisi.");
        return;
      }

      if (!tanggalSelesai) {
        alert("Tanggal selesai wajib diisi.");
        return;
      }

      if (tanggalMulai > tanggalSelesai) {
        alert("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
        return;
      }

      if (danaMaksimal <= 0) {
        alert("Batas maksimal dana wajib diisi.");
        return;
      }

      const payload = {
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        jenis_barang: jenisBarang,
        dana_maksimal: danaMaksimal,
      };

      state.lastPayload = payload;

      const csrf = getCsrfToken();
      const labelAwal = el.btnProses ? el.btnProses.textContent : "Proses Rekomendasi";

      try {
        if (el.btnProses) {
          el.btnProses.disabled = true;
          el.btnProses.textContent = "Memproses...";
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrf,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(payload),
        });

        let data = null;

        try {
          data = await res.json();
        } catch (_) {
          data = { ok: false, msg: "Respons server tidak valid." };
        }

        if (!res.ok || !data.ok) {
          throw new Error(data.msg || "Terjadi error saat memproses rekomendasi.");
        }

        renderHasil(data);
        bukaPopup(el.popupHasil);
      } catch (err) {
        alert(err.message || "Terjadi error saat memproses rekomendasi.");
      } finally {
        if (el.btnProses) {
          el.btnProses.disabled = false;
          el.btnProses.textContent = labelAwal;
        }
      }
    }

    /* =========================================================
       EVENT
    ========================================================= */
    setupInputRupiah(el.danaMaksimal);
    setPeriodeDefault30Hari();
    resetHasil();

    if (el.btnProses) {
      el.btnProses.addEventListener("click", prosesRekomendasi);
    }

    if (el.btnReset) {
      el.btnReset.addEventListener("click", resetForm);
    }

    document.addEventListener("click", (e) => {
      const btnBuatPembelian = e.target.closest("#btnBuatPembelianDariRekomendasi");
      if (!btnBuatPembelian) return;

      e.preventDefault();
      e.stopPropagation();

      buatDraftPembelianDariRekomendasi();
    });

    if (el.isiTabel) {
      el.isiTabel.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-lihat-detail]");
        if (!btn) return;

        const index = Number(btn.getAttribute("data-lihat-detail"));
        if (!Number.isFinite(index)) return;

        tampilkanDetail(index);
      });
    }

    qsa("[data-tutup-popup]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipe = btn.getAttribute("data-tutup-popup");

        if (tipe === "hasil") tutupPopup(el.popupHasil);
        if (tipe === "detail") tutupPopup(el.popupDetail);
      });
    });

    [el.popupHasil, el.popupDetail].forEach((popup) => {
      if (!popup) return;

      popup.addEventListener("click", (e) => {
        if (e.target === popup) {
          tutupPopup(popup);
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      tutupPopup(el.popupDetail);
      tutupPopup(el.popupHasil);
    });
  });
})();