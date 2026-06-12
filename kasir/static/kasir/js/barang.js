(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const qs = (s, r = document) => (r ? r.querySelector(s) : null);
    const qsa = (s, r = document) => (r ? Array.from(r.querySelectorAll(s)) : []);

    const IS_PEMILIK =
      String(document.body?.dataset?.role || "").trim().toLowerCase() === "pemilik";

    const elSearch = qs("#barangSearch");
    const elTabs = qs("#barangTabs");
    const elTbody = qs("#barangTable tbody");

    const btnExport = qs("#barangExport");
    const btnTambah = qs("#barangTambah");
    const btnDeleteAll = qs("#barangDeleteAll");
    const btnImportBtn = qs("#barangImportBtn");
    const inputImport = qs("#barangImportFile");

    const backdrop = qs("#barang-editor-backdrop");
    const form = qs("#barangEditorForm");
    const editorTitle = qs("#barangEditorTitle");
    const saveBtn = qs("#ieSaveBtn");

    const ieJenis = qs("#ieJenis");
    const ieKode = qs("#ieKode");
    const ieNama = qs("#ieNama");
    const ieSupplier = qs("#ieSupplier");
    const ieSatuanAngka = qs("#ieSatuanAngka");
    const ieSatuanUnit = qs("#ieSatuanUnit");
    const ieStok = qs("#ieStok");
    const ieStokMinimal = qs("#ieStokMinimal");
    const ieHargaBeli = qs("#ieHargaBeli");
    const ieHarga = qs("#ieHarga");

    const ieKodePreview = qs("#ieKodePreview");
    const ieSatuanPreview = qs("#ieSatuanPreview");
    const ieHargaBeliPreview = qs("#ieHargaBeliPreview");
    const ieHargaPreview = qs("#ieHargaPreview");

    const JENIS_PREFIX_MAP = {
      FUNGISIDA: "FNG",
      INSEKTISIDA: "INS",
      HERBISIDA: "HRB",
      "NUTRISI DAN ZPT": "NUT",
      PUPUK: "PPK",
    };

    const STANDARD_UNIT_OPTIONS = [
      "GR",
      "KG",
      "ML",
      "L",
      "PCS",
      "BOTOL",
      "PACK",
      "SACHET",
    ];

    let BARANG = [];
    let DAFTAR_KATEGORI = [];
    let DAFTAR_SUPPLIER = [];
    let activeKategori = "SEMUA";
    let currentEditBarang = null;
    let editorMode = "create";
    let submitting = false;
    let reloading = false;
    let lastFocusReload = 0;

    function toNum(v) {
      if (v == null) return 0;

      if (typeof v === "number") {
        return Number.isFinite(v) ? Math.round(v) : 0;
      }

      let s = String(v).trim();
      if (!s) return 0;

      s = s.replace(/rp/gi, "").replace(/\s+/g, "");

      if (/^-?\d+(?:[.,]\d+)?$/.test(s)) {
        const normalized = s.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? Math.round(n) : 0;
      }

      s = s.replace(/[^\d-]/g, "");
      if (!s || s === "-") return 0;

      const n = Number(s);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }

    function normalizeNominal(v, opts = {}) {
      const { legacySmallToThousand = false } = opts || {};
      let n = Math.max(0, Math.round(toNum(v)));

      if (legacySmallToThousand && n > 0 && n < 1000) {
        n = n * 1000;
      }

      return n;
    }

    function normalizeText(v) {
      return String(v || "").trim();
    }

    function normalizeJenisName(v) {
      return normalizeText(v).toUpperCase();
    }

    function normalizeSatuanAngka(v) {
      let s = normalizeText(v).replace(/\s+/g, "").replace(/,/g, ".");
      if (!s) return "";

      const m = s.match(/^(\d+(?:\.\d+)?)/);
      if (!m) return "";

      let out = m[1];
      if (out.includes(".")) {
        out = out.replace(/0+$/, "").replace(/\.$/, "");
      }

      return out;
    }

    function normalizeIntegerDigits(v) {
      return String(v ?? "").replace(/[^\d]/g, "");
    }

    function normalizeNominalFromInput(el) {
      const digits = normalizeIntegerDigits(el?.value || "");
      let n = digits ? parseInt(digits, 10) : 0;

      if (!Number.isFinite(n)) n = 0;

      if (el && String(el.value || "") !== String(digits)) {
        el.value = digits;
      }

      return n;
    }

    function normalizeUnitName(v) {
      let raw = normalizeText(v).toUpperCase();

      raw = raw.replace(/\./g, " ");
      raw = raw.replace(/\s+/g, " ").trim();
      raw = raw.replace(/^\d+(?:[.,]\d+)?\s*/, "").trim();
      raw = raw.replace(/\s+/g, "");

      if (!raw) return "";

      if (["G", "GR", "GRAM", "GRAMS"].includes(raw)) return "GR";
      if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(raw)) return "KG";
      if (["ML", "MILILITER", "MILLILITER"].includes(raw)) return "ML";
      if (["L", "LTR", "LITER", "LITRE"].includes(raw)) return "L";
      if (["PCS", "PC", "PIECE", "PIECES", "BUAH", "UNIT"].includes(raw)) return "PCS";
      if (["BOTOL", "BTL"].includes(raw)) return "BOTOL";
      if (["PACK", "PAK", "PK"].includes(raw)) return "PACK";
      if (["SACHET", "SASET", "SCH"].includes(raw)) return "SACHET";
      if (["OG", "0G", "O", "0"].includes(raw)) return "";

      return raw;
    }

    function splitSatuan(raw) {
      const s = normalizeText(raw);
      if (!s) return { angka: "", unit: "" };

      const m = s.match(/^([\d.,]+)\s*(.+)$/);
      if (m) {
        return {
          angka: normalizeSatuanAngka(m[1]),
          unit: normalizeUnitName(m[2]),
        };
      }

      const angkaOnly = normalizeSatuanAngka(s);
      const unitOnly = normalizeUnitName(s);

      if (angkaOnly && !unitOnly) {
        return { angka: angkaOnly, unit: "" };
      }

      return {
        angka: "",
        unit: unitOnly,
      };
    }

    function composeSatuan(angka, unit) {
      const a = normalizeSatuanAngka(angka);
      const u = normalizeUnitName(unit);

      if (a && u) return `${a} ${u}`;
      if (u) return u;
      if (a) return a;

      return "";
    }

    function getPrefixFromName(nama) {
      const jenisNorm = normalizeJenisName(nama);

      if (!jenisNorm) return "BRG";

      if (JENIS_PREFIX_MAP[jenisNorm]) {
        return JENIS_PREFIX_MAP[jenisNorm];
      }

      const clean = jenisNorm.replace(/[^A-Z0-9]/g, "");
      if (clean.length >= 3) return clean.slice(0, 3);
      if (clean.length > 0) return clean.padEnd(3, "X").slice(0, 3);

      return "BRG";
    }

    function normalizeKategoriObj(raw) {
      const nama = normalizeJenisName(
        raw?.nama_kategori ||
        raw?.kategori ||
        raw?.jenis_barang ||
        raw?.jenis ||
        raw?.nama ||
        ""
      );

      const kode = normalizeJenisName(
        raw?.kode_kategori ||
        raw?.prefix ||
        raw?.kode ||
        raw?.kode_awal ||
        getPrefixFromName(nama)
      );

      return {
        id_kategori: Number(raw?.id_kategori || raw?.id || 0),
        nama_kategori: nama,
        kategori: nama,
        jenis_barang: nama,
        kode_kategori: kode || getPrefixFromName(nama),
        prefix: kode || getPrefixFromName(nama),
      };
    }

    function mergeKategoriLists(...lists) {
      const map = new Map();

      lists.forEach((list) => {
        if (!Array.isArray(list)) return;

        list.forEach((raw) => {
          const item = normalizeKategoriObj(raw);
          if (!item.nama_kategori) return;
          if (item.nama_kategori === "PILIH KATEGORI") return;
          if (item.nama_kategori === "PILIH JENIS") return;
          if (item.nama_kategori === "PILIH") return;

          const key = item.nama_kategori;

          if (!map.has(key)) {
            map.set(key, item);
          } else {
            const old = map.get(key);
            map.set(key, {
              ...old,
              ...item,
              id_kategori: item.id_kategori || old.id_kategori || 0,
              kode_kategori: item.kode_kategori || old.kode_kategori || getPrefixFromName(key),
              prefix: item.prefix || old.prefix || getPrefixFromName(key),
            });
          }
        });
      });

      return Array.from(map.values()).sort((a, b) =>
        a.nama_kategori.localeCompare(b.nama_kategori)
      );
    }

    function getKategoriMetaForJenis(jenis) {
      const jenisNorm = normalizeJenisName(jenis);

      if (!jenisNorm) {
        return {
          id_kategori: 0,
          nama_kategori: "",
          kode_kategori: "BRG",
          prefix: "BRG",
        };
      }

      const found = DAFTAR_KATEGORI.find(
        (item) => normalizeJenisName(item.nama_kategori) === jenisNorm
      );

      if (found) {
        return {
          id_kategori: Number(found.id_kategori || 0),
          nama_kategori: found.nama_kategori,
          kode_kategori: normalizeJenisName(found.kode_kategori || found.prefix || getPrefixFromName(jenisNorm)),
          prefix: normalizeJenisName(found.prefix || found.kode_kategori || getPrefixFromName(jenisNorm)),
        };
      }

      return {
        id_kategori: 0,
        nama_kategori: jenisNorm,
        kode_kategori: getPrefixFromName(jenisNorm),
        prefix: getPrefixFromName(jenisNorm),
      };
    }

    function getPrefixForJenis(jenis) {
      const meta = getKategoriMetaForJenis(jenis);
      return normalizeJenisName(meta.kode_kategori || meta.prefix || getPrefixFromName(jenis));
    }

    function normalizeBarang(raw) {
      const idKategori = Number(raw?.id_kategori ?? raw?.kategori_id ?? 0);
      const idSupplier = Number(raw?.id_supplier ?? raw?.supplier_id ?? 0);

      const supplierLabel = normalizeText(
        raw?.supplier_label ??
        raw?.nama_perusahaan ??
        raw?.nama_supplier ??
        ""
      );

      let jenis = normalizeJenisName(
        raw?.kategori ??
        raw?.jenis ??
        raw?.jenis_barang ??
        raw?.nama_kategori ??
        ""
      );

      if (!jenis && idKategori) {
        const found = DAFTAR_KATEGORI.find(
          (k) => Number(k.id_kategori || 0) === Number(idKategori)
        );

        if (found) jenis = normalizeJenisName(found.nama_kategori);
      }

      const kode = normalizeText(raw?.kode ?? raw?.kode_barang ?? "").toUpperCase();
      const nama = normalizeText(raw?.nama ?? raw?.nama_barang ?? "");
      const stok = Math.max(0, Math.floor(toNum(raw?.stok ?? raw?.stok_saat_ini ?? 0)));
      const stokMinimal = Math.max(0, Math.floor(toNum(raw?.stok_minimal ?? 0)));

      const satuanRaw = raw?.berat ?? raw?.satuan ?? raw?.satuan_barang ?? "";
      const satuanParts = splitSatuan(satuanRaw);
      const satuanFinal = composeSatuan(satuanParts.angka, satuanParts.unit);

      return {
        ...raw,
        id: Number(raw?.id_barang ?? raw?.id ?? 0),
        id_barang: Number(raw?.id_barang ?? raw?.id ?? 0),
        id_kategori: idKategori,
        id_supplier: idSupplier,
        supplier_id: idSupplier,
        supplier_label: supplierLabel || getSupplierLabelById(idSupplier),
        nama_supplier: normalizeText(raw?.nama_supplier ?? ""),
        nama_perusahaan: normalizeText(raw?.nama_perusahaan ?? ""),

                kode,
        kode_barang: kode,

        nama,
        nama_barang: nama,

        kategori: jenis,
        jenis,
        jenis_barang: jenis,

        berat: satuanFinal,
        satuan: satuanFinal,

        stok,
        stok_saat_ini: stok,
        stok_minimal: stokMinimal,

        harga_beli: normalizeNominal(raw?.harga_beli ?? raw?.harga_modal ?? 0, {
          legacySmallToThousand: true,
        }),

        harga_modal: normalizeNominal(raw?.harga_beli ?? raw?.harga_modal ?? 0, {
          legacySmallToThousand: true,
        }),

        harga: normalizeNominal(raw?.harga ?? raw?.harga_jual ?? 0, {
          legacySmallToThousand: true,
        }),

        harga_jual: normalizeNominal(raw?.harga ?? raw?.harga_jual ?? 0, {
          legacySmallToThousand: true,
        }),
      };
    }

    function normalizeSupplier(raw) {
      const idSupplier = Number(raw?.id_supplier ?? raw?.id ?? 0);

      const namaPerusahaan = normalizeText(
        raw?.nama_perusahaan ??
        raw?.perusahaan ??
        ""
      );

      const namaSupplier = normalizeText(
        raw?.nama_supplier ??
        raw?.nama ??
        ""
      );

      const statusSupplier = normalizeText(
        raw?.status_supplier ??
        raw?.status ??
        "aktif"
      ).toLowerCase();

      const label = namaPerusahaan
        ? `${namaPerusahaan} - ${namaSupplier || "Contact Person"}`
        : namaSupplier || `Supplier #${idSupplier}`;

      return {
        id_supplier: idSupplier,
        nama_supplier: namaSupplier,
        nama_perusahaan: namaPerusahaan,
        status_supplier: statusSupplier,
        supplier_label: label,
      };
    }

    function getSupplierLabelById(idSupplier) {
      const id = Number(idSupplier || 0);

      if (!id) return "-";

      const found = DAFTAR_SUPPLIER.find((s) => {
        return Number(s.id_supplier || 0) === id;
      });

      return found?.supplier_label || `Supplier #${id}`;
    }

    function populateSupplierOptions(selectedValue = "") {
      if (!ieSupplier) return;

      const selected = Number(selectedValue || ieSupplier.value || 0);

      const aktif = DAFTAR_SUPPLIER.filter((s) => {
        const status = String(s.status_supplier || "aktif").toLowerCase();
        return status === "aktif" || status === "";
      });

      ieSupplier.innerHTML = `<option value="">Pilih Supplier Utama</option>`;

      aktif.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = String(s.id_supplier || "");
        opt.textContent = s.supplier_label || `Supplier #${s.id_supplier}`;
        ieSupplier.appendChild(opt);
      });

      if (selected) {
        ieSupplier.value = String(selected);
      }
    }

    async function loadSupplierFromServer() {
      const url = String(window.TX_SUPPLIER_JSON_URL || "").trim();

      if (!url) {
        console.warn("Endpoint supplier JSON belum tersedia.");
        DAFTAR_SUPPLIER = [];
        populateSupplierOptions();
        return;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal memuat data supplier.");
      }

      DAFTAR_SUPPLIER = Array.isArray(data.data)
        ? data.data.map(normalizeSupplier)
        : [];

      populateSupplierOptions();
    }

    function formatRp(n) {
      const x = Math.max(0, Math.round(toNum(n)));
      return "Rp " + x.toLocaleString("id-ID");
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function getCSRFToken() {
      const meta = qs('meta[name="csrf-token"]');
      return meta ? meta.getAttribute("content") : "";
    }

    async function readJsonSafe(res) {
      const text = await res.text().catch(() => "");

      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch (_) {
        return { ok: false, msg: text };
      }
    }

    function setVal(el, v) {
      if (el) el.value = v;
    }

    function setText(el, v) {
      if (el) el.textContent = v;
    }

    function sanitizeDigitsOnlyInput(el) {
      if (!el || el.dataset.sanitizeDigitsBound === "1") return;

      el.dataset.sanitizeDigitsBound = "1";

      el.addEventListener("input", () => {
        const cleaned = String(el.value || "").replace(/[^\d]/g, "");
        if (el.value !== cleaned) el.value = cleaned;
      });
    }

    function sanitizeSatuanAngkaInput(el) {
      if (!el || el.dataset.sanitizeSatuanBound === "1") return;

      el.dataset.sanitizeSatuanBound = "1";

      el.addEventListener("input", () => {
        let cleaned = String(el.value || "")
          .replace(/,/g, ".")
          .replace(/[^\d.]/g, "");

        const parts = cleaned.split(".");
        if (parts.length > 2) {
          cleaned = `${parts.shift()}.${parts.join("")}`;
        }

        if (el.value !== cleaned) el.value = cleaned;
      });
    }

    function preventNumberWheelChange(el) {
      if (!el || el.dataset.preventWheelBound === "1") return;

      el.dataset.preventWheelBound = "1";

      el.addEventListener(
        "wheel",
        (e) => {
          if (document.activeElement === el) {
            e.preventDefault();
            el.blur();
          }
        },
        { passive: false }
      );
    }

    function preventNumberStepKeys(el) {
      if (!el || el.dataset.preventStepKeyBound === "1") return;

      el.dataset.preventStepKeyBound = "1";

      el.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
        }
      });
    }

    function initInitialKategori() {
      const fromWindow = Array.isArray(window.TX_INITIAL_KATEGORI)
        ? window.TX_INITIAL_KATEGORI
        : [];

      const fromHtmlTabs = qsa("#barangTabs .tab")
        .map((btn) => ({
          id_kategori: btn.dataset.idKategori || 0,
          nama_kategori: btn.dataset.kategori || btn.dataset.jenis || btn.dataset.tab || "",
          kode_kategori: btn.dataset.kodeKategori || btn.dataset.prefix || "",
        }))
        .filter((x) => {
          const nama = normalizeJenisName(x.nama_kategori);
          return nama && nama !== "SEMUA" && nama !== "PILIH KATEGORI";
        });

      const fromSelect = qsa("#ieJenis option")
        .filter((opt) => String(opt.value || "").trim() !== "")
        .map((opt) => ({
          id_kategori: opt.dataset.idKategori || 0,
          nama_kategori: opt.value || "",
          kode_kategori: opt.dataset.kodeKategori || opt.dataset.prefix || "",
        }))
        .filter((x) => {
          const nama = normalizeJenisName(x.nama_kategori);
          return nama && nama !== "SEMUA" && nama !== "PILIH KATEGORI";
        });

      DAFTAR_KATEGORI = mergeKategoriLists(fromWindow, fromHtmlTabs, fromSelect)
        .filter((item) => {
          const nama = normalizeJenisName(item.nama_kategori);
          return nama && nama !== "SEMUA" && nama !== "PILIH KATEGORI";
        });
    }

    function initBarangTopbarToggle() {
      const btn = qs("#barangNavToggle");

      if (!btn) return;

      function updateButton() {
        const hidden =
          document.body.classList.contains("barang-nav-collapsed") ||
          document.body.classList.contains("top-hidden");

        btn.textContent = hidden ? "Tampilkan Atas" : "Sembunyikan Atas";
        btn.setAttribute("aria-expanded", hidden ? "false" : "true");
      }

      function showTopbar() {
        document.body.classList.remove("barang-nav-collapsed");
        document.body.classList.remove("top-hidden");
        updateButton();
      }

      function hideTopbar() {
        document.body.classList.add("barang-nav-collapsed");
        document.body.classList.add("top-hidden");
        updateButton();
      }

      hideTopbar();

      btn.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();

        const hidden =
          document.body.classList.contains("barang-nav-collapsed") ||
          document.body.classList.contains("top-hidden");

        if (hidden) {
          showTopbar();
        } else {
          hideTopbar();
        }
      };

      updateButton();
    }

    function bindDisabledLinks() {
      qsa('a[aria-disabled="true"], a[href="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const title = normalizeText(a.querySelector(".nav-item-title")?.textContent || a.textContent);

          if (a.getAttribute("aria-disabled") === "true" || a.getAttribute("href") === "#") {
            e.preventDefault();

            if (/data kategori/i.test(title)) {
              alert("Halaman Data Kategori belum dibuat.");
            }
          }
        });
      });
    }

    async function reloadBarangFromServer() {
      if (reloading) return;

      const url = window.TX_BARANG_JSON_URL;

      if (!url) {
        throw new Error("Endpoint JSON barang belum tersedia.");
      }

      try {
        reloading = true;

        const res = await fetch(url, {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          credentials: "same-origin",
        });

        const data = await readJsonSafe(res);

        if (!res.ok || !data.ok) {
          throw new Error(data.msg || "Gagal memuat data barang dari server.");
        }

        const kategoriServer = Array.isArray(data.daftar_kategori)
          ? data.daftar_kategori
          : Array.isArray(data.kategori)
            ? data.kategori
            : [];

        const kategoriDariBarang = Array.isArray(data.data)
          ? data.data.map((item) => ({
              id_kategori: item.id_kategori || 0,
              nama_kategori: item.jenis_barang || item.kategori || "",
              kode_kategori: item.kode_kategori || item.prefix || "",
            }))
          : [];

        DAFTAR_KATEGORI = mergeKategoriLists(
          DAFTAR_KATEGORI,
          kategoriServer,
          kategoriDariBarang
        );

        BARANG = Array.isArray(data.data) ? data.data.map(normalizeBarang) : [];

        if (
          activeKategori !== "SEMUA" &&
          !DAFTAR_KATEGORI.some((x) => x.nama_kategori === activeKategori)
        ) {
          const adaDiBarang = BARANG.some((b) => normalizeJenisName(b.jenis_barang) === activeKategori);
          if (!adaDiBarang) activeKategori = "SEMUA";
        }

        buildKategoriTabs();
        renderBarangTable();
        populateJenisOptions();
        populateSatuanUnitOptions();
      } finally {
        reloading = false;
      }
    }

    async function reloadBarangSilent() {
      try {
        await reloadBarangFromServer();
      } catch (err) {
        console.warn("Reload Data Barang gagal:", err);
      }
    }

    function getJenisMetaMap() {
      const kategoriDariBarang = BARANG.map((b) => ({
        id_kategori: b.id_kategori || 0,
        nama_kategori: b.jenis_barang || b.kategori || "",
        kode_kategori: "",
      })).filter((x) => normalizeJenisName(x.nama_kategori));

      return mergeKategoriLists(DAFTAR_KATEGORI, kategoriDariBarang);
    }

    function getNextKodeForJenis(jenis, excludeId = null) {
      const jenisNorm = normalizeJenisName(jenis);
      const prefix = getPrefixForJenis(jenisNorm);
      let maxNum = 0;

      BARANG.forEach((b) => {
        const bJenis = normalizeJenisName(b.jenis_barang || b.kategori || "");
        if (bJenis !== jenisNorm) return;

        if (excludeId && Number(b.id_barang) === Number(excludeId)) return;

        const kode = normalizeText(b.kode_barang || b.kode || "").toUpperCase();

        if (!kode.startsWith(prefix)) return;

        const m = kode.match(/(\d+)$/);
        if (!m) return;

        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxNum) maxNum = n;
      });

      return `${prefix}${String(maxNum + 1).padStart(5, "0")}`;
    }

    function buildKategoriTabs() {
      if (!elTabs) return;

      const jenisList = getJenisMetaMap();

      elTabs.innerHTML = "";

      const btnAll = document.createElement("button");
      btnAll.type = "button";
      btnAll.className = "tab";
      btnAll.dataset.kategori = "SEMUA";
      btnAll.dataset.tab = "SEMUA";
      btnAll.dataset.jenis = "SEMUA";
      btnAll.textContent = "Semua";
      btnAll.classList.toggle("active", activeKategori === "SEMUA");
      btnAll.addEventListener("click", () => {
        activeKategori = "SEMUA";
        buildKategoriTabs();
        renderBarangTable();
      });
      elTabs.appendChild(btnAll);

      jenisList.forEach((item) => {
        const jenis = normalizeJenisName(item.nama_kategori);
        if (!jenis) return;

        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "tab";
        btn.dataset.kategori = jenis;
        btn.dataset.tab = jenis;
        btn.dataset.jenis = jenis;
        btn.dataset.idKategori = String(item.id_kategori || "");
        btn.dataset.kodeKategori = item.kode_kategori || item.prefix || getPrefixFromName(jenis);

        btn.textContent = jenis;
        btn.classList.toggle("active", activeKategori === jenis);

        btn.addEventListener("click", () => {
          activeKategori = jenis;
          buildKategoriTabs();
          renderBarangTable();
        });

        elTabs.appendChild(btn);
      });
    }

    function getFilteredBarang() {
      const q = String(elSearch?.value || "").trim().toLowerCase();

      return BARANG.filter((b) => {
        const jenis = normalizeJenisName(b.jenis_barang || b.kategori || "");
        const matchKategori = activeKategori === "SEMUA" || jenis === activeKategori;

        const hay = [
          b.kode,
          b.nama,
          b.satuan,
          b.kategori,
          b.jenis_barang,
          b.supplier_label,
          b.nama_supplier,
          b.nama_perusahaan,
          b.harga_jual,
          b.harga_beli,
        ]
          .join(" ")
          .toLowerCase();

        const matchSearch = !q || hay.includes(q);

        return matchKategori && matchSearch;
      });
    }

    function makeAksiCell(b) {
      const td = document.createElement("td");
      td.className = "tx-aksi-col";

      const wrap = document.createElement("div");
      wrap.className = "tx-aksi-wrap";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "tx-aksi-btn edit";
      btnEdit.setAttribute("title", "Edit");
      btnEdit.setAttribute("aria-label", `Edit ${b.kode || b.nama || "barang"}`);
      btnEdit.setAttribute("data-tooltip", "Edit");
      btnEdit.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path
            d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3L18.3 4.3a2.1 2.1 0 0 0-3 0L4 15.6V20Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            d="M13.8 5.8l4.4 4.4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      `;
      btnEdit.addEventListener("click", () => openEditorEdit(b));

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "tx-aksi-btn delete";
      btnDelete.setAttribute("title", "Hapus");
      btnDelete.setAttribute("aria-label", `Hapus ${b.kode || b.nama || "barang"}`);
      btnDelete.setAttribute("data-tooltip", "Hapus");
      btnDelete.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M5 7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path
            d="M8 7l.7 12.2A2 2 0 0 0 10.7 21h2.6a2 2 0 0 0 2-1.8L16 7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>
      `;
      btnDelete.addEventListener("click", async () => {
        try {
          await handleDeleteBarang(b);
        } catch (err) {
          console.error(err);
          alert(err.message || "Gagal hapus barang.");
        }
      });

      wrap.appendChild(btnEdit);
      wrap.appendChild(btnDelete);
      td.appendChild(wrap);

      return td;
    }

    function renderBarangTable() {
      if (!elTbody) return;

      const rows = getFilteredBarang();
      elTbody.innerHTML = "";

      if (!rows.length) {
        const tr = document.createElement("tr");

        const msg =
          activeKategori === "SEMUA"
            ? "Data barang tidak ditemukan."
            : `Belum ada barang untuk kategori ${activeKategori}.`;

        tr.innerHTML = `
          <td colspan="${IS_PEMILIK ? 10 : 8}">
            ${escapeHtml(msg)}
          </td>
        `;
        elTbody.appendChild(tr);
        return;
      }

      rows.forEach((b) => {
        const tr = document.createElement("tr");

        const cells = [
          b.kode || "-",
          b.kategori || "-",
          b.supplier_label || getSupplierLabelById(b.id_supplier) || "-",
          b.nama || "-",
          b.satuan || "-",
          String(b.stok_saat_ini ?? b.stok ?? 0),
          String(b.stok_minimal ?? 0),
        ];
        
        cells.forEach((value) => {
          const td = document.createElement("td");
          td.textContent = value;
          tr.appendChild(td);
        });

        if (IS_PEMILIK) {
          const tdBeli = document.createElement("td");
          tdBeli.className = "num";
          tdBeli.textContent = formatRp(b.harga_beli || 0);
          tr.appendChild(tdBeli);
        }

        const tdJual = document.createElement("td");
        tdJual.className = "num";
        tdJual.textContent = formatRp(b.harga_jual || b.harga || 0);
        tr.appendChild(tdJual);

        if (IS_PEMILIK) {
          tr.appendChild(makeAksiCell(b));
        }

        elTbody.appendChild(tr);
      });
    }

    function populateJenisOptions(selectedValue = "") {
      if (!ieJenis) return;

      const current = normalizeJenisName(selectedValue || ieJenis.value);
      const metas = getJenisMetaMap();

      ieJenis.innerHTML = `<option value="">Pilih Kategori</option>`;

      metas.forEach((item) => {
        const jenis = normalizeJenisName(item.nama_kategori);
        if (!jenis) return;

        const opt = document.createElement("option");
        opt.value = jenis;
        opt.textContent = jenis;
        opt.dataset.idKategori = String(item.id_kategori || "");
        opt.dataset.kodeKategori = item.kode_kategori || item.prefix || getPrefixFromName(jenis);
        opt.dataset.prefix = item.prefix || item.kode_kategori || getPrefixFromName(jenis);
        ieJenis.appendChild(opt);
      });

      if (current) ieJenis.value = current;
    }

    function populateSatuanUnitOptions(selectedValue = "") {
      if (!ieSatuanUnit) return;

      const set = new Set(STANDARD_UNIT_OPTIONS);

      BARANG.forEach((b) => {
        const parts = splitSatuan(b.satuan || b.berat || "");
        if (parts.unit) set.add(parts.unit);
      });

      const units = Array.from(set)
        .filter(Boolean)
        .filter((u) => !["OG", "0G", "O G", "0 G"].includes(String(u).toUpperCase()))
        .sort((a, b) => a.localeCompare(b));

      ieSatuanUnit.innerHTML = `<option value="">Pilih satuan</option>`;

      units.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = u;
        ieSatuanUnit.appendChild(opt);
      });

      if (selectedValue) {
        ieSatuanUnit.value = normalizeUnitName(selectedValue);
      }
    }

    function refreshPreview() {
      const satuanGabungan = composeSatuan(
        ieSatuanAngka?.value || "",
        ieSatuanUnit?.value || ""
      );

      setText(ieHargaPreview, formatRp(ieHarga?.value || 0));
      setText(ieHargaBeliPreview, formatRp(ieHargaBeli?.value || 0));
      setText(ieSatuanPreview, satuanGabungan || "-");
      setText(ieKodePreview, normalizeText(ieKode?.value) || "-");
    }

    function refreshKodeOtomatis() {
      if (!ieJenis || !ieKode) return;

      const jenis = normalizeJenisName(ieJenis.value);

      if (!jenis) {
        ieKode.value = "";
        refreshPreview();
        return;
      }

      const excludeId =
        editorMode === "edit" ? Number(currentEditBarang?.id_barang || 0) : null;

      const currentJenisEdit = normalizeJenisName(
        currentEditBarang?.jenis_barang || currentEditBarang?.kategori || ""
      );

      if (
        editorMode === "edit" &&
        currentEditBarang &&
        jenis === currentJenisEdit &&
        currentEditBarang.kode
      ) {
        ieKode.value = currentEditBarang.kode;
        refreshPreview();
        return;
      }

      ieKode.value = getNextKodeForJenis(jenis, excludeId);
      refreshPreview();
    }

    function setEditorMode(mode) {
      editorMode = mode === "edit" ? "edit" : "create";

      if (editorTitle) {
        editorTitle.textContent = editorMode === "create" ? "Tambah Barang" : "Edit Barang";
      }

      if (saveBtn) {
        saveBtn.textContent = editorMode === "create" ? "Simpan Barang" : "Simpan Perubahan";
      }
    }

    function openEditorCreate() {
      if (!IS_PEMILIK || !backdrop) return;

      currentEditBarang = null;
      setEditorMode("create");

      populateJenisOptions();
      populateSatuanUnitOptions();

      setVal(ieJenis, "");
      populateSupplierOptions();
      setVal(ieSupplier, "");
      setVal(ieKode, "");
      setVal(ieNama, "");
      setVal(ieSatuanAngka, "");
      setVal(ieSatuanUnit, "");
      setVal(ieStok, "0");
      setVal(ieStokMinimal, "0");
      setVal(ieHargaBeli, "0");
      setVal(ieHarga, "0");

      refreshPreview();

      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      setTimeout(() => ieJenis?.focus(), 50);
    }

    function openEditorEdit(b) {
      if (!IS_PEMILIK || !backdrop) return;

      currentEditBarang = normalizeBarang(b);
      setEditorMode("edit");

      const parts = splitSatuan(currentEditBarang.satuan || currentEditBarang.berat || "");

      populateJenisOptions(currentEditBarang.kategori || currentEditBarang.jenis_barang || "");
      populateSatuanUnitOptions(parts.unit || "");

      populateSupplierOptions(currentEditBarang.id_supplier || 0);

      setVal(
        ieJenis,
        normalizeJenisName(currentEditBarang.kategori || currentEditBarang.jenis_barang || "")
      );
      setVal(ieSupplier, String(currentEditBarang.id_supplier || ""));
      setVal(ieKode, currentEditBarang.kode || "");
      setVal(ieNama, currentEditBarang.nama || "");
      setVal(ieSatuanAngka, parts.angka || "");
      setVal(ieSatuanUnit, parts.unit || "");
      setVal(ieStok, Math.max(0, Math.floor(toNum(currentEditBarang.stok_saat_ini || currentEditBarang.stok))));
      setVal(ieStokMinimal, Math.max(0, Math.floor(toNum(currentEditBarang.stok_minimal || 0))));
      setVal(ieHargaBeli, String(Math.max(0, Math.round(toNum(currentEditBarang.harga_beli)))));
      setVal(ieHarga, String(Math.max(0, Math.round(toNum(currentEditBarang.harga_jual || currentEditBarang.harga)))));

      refreshPreview();

      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      setTimeout(() => ieNama?.focus(), 50);
    }

    function closeEditor() {
      if (!backdrop || !backdrop.classList.contains("show")) return false;

      backdrop.classList.remove("show");
      backdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      currentEditBarang = null;
      setEditorMode("create");

      return true;
    }

    async function submitCreateBarang(payload) {
      const createUrl = String(window.TX_BARANG_CREATE_URL || "").trim();

      if (!createUrl) {
        throw new Error("Endpoint tambah barang belum tersambung.");
      }

      const res = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id_kategori: payload.id_kategori,
          id_supplier: payload.id_supplier,
          kode_kategori: payload.kode_kategori,
          kode_barang: payload.kode_barang,
          jenis_barang: payload.jenis_barang,
          nama_barang: payload.nama_barang,
          satuan: payload.satuan,
          stok_saat_ini: payload.stok_saat_ini,
          stok_minimal: payload.stok_minimal,
          harga_beli: payload.harga_beli,
          harga_jual: payload.harga_jual,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal menambah barang.");
      }

      if (data.msg) alert(data.msg);
      return data;
    }

    async function submitEditBarang(payload, oldBarang) {
      const editUrl = String(window.TX_BARANG_EDIT_URL || "").trim();

      if (!editUrl) {
        throw new Error("Endpoint edit barang belum tersambung.");
      }

      const res = await fetch(editUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id_barang: payload.id_barang,
          id_kategori: payload.id_kategori,
          id_supplier: payload.id_supplier,
          kode_kategori: payload.kode_kategori,
          kode_barang: payload.kode_barang,
          jenis_barang: payload.jenis_barang,
          nama_barang: payload.nama_barang,
          satuan: payload.satuan,
          stok_saat_ini: payload.stok_saat_ini,
          stok_minimal: payload.stok_minimal,
          harga_beli: payload.harga_beli,
          harga_jual: payload.harga_jual,
          old_kode_barang: oldBarang?.kode || "",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal edit barang.");
      }

      if (data.msg) alert(data.msg);
      return data;
    }

    async function handleDeleteBarang(b) {
      if (!IS_PEMILIK) return;

      const deleteUrl = String(window.TX_BARANG_DELETE_URL || "").trim();

      if (!deleteUrl) {
        throw new Error("Endpoint hapus barang belum tersambung.");
      }

      const ok = confirm(`Hapus barang ${b.kode} - ${b.nama}?`);
      if (!ok) return;

      const res = await fetch(deleteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id_barang: Number(b.id_barang || 0),
          kode_barang: b.kode || "",
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        let msg = data.msg || "Gagal hapus barang.";

        if (/foreign key|constraint|protected|terhubung|dipakai|transaksi/i.test(String(msg))) {
          msg = "Barang tidak bisa dihapus karena sudah dipakai di transaksi / data lain.";
        }

        throw new Error(msg);
      }

      alert(data.msg || "Barang berhasil dihapus.");
      await reloadBarangFromServer();
    }

    async function handleDeleteAllBarang() {
      if (!IS_PEMILIK) return;

      if (!BARANG.length) {
        alert("Data barang sudah kosong.");
        return;
      }

      const ok = confirm("Yakin ingin menghapus semua data barang?");
      if (!ok) return;

      const deleteAllUrl = String(window.TX_BARANG_DELETE_ALL_URL || "").trim();

      if (!deleteAllUrl) {
        throw new Error("Endpoint hapus semua barang belum tersambung.");
      }

      const res = await fetch(deleteAllUrl, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal hapus semua barang.");
      }

      alert(data.msg || "Semua data barang berhasil dihapus.");
      await reloadBarangFromServer();
    }

    function exportBarang() {
      const url = String(window.TX_BARANG_EXPORT_URL || "").trim();

      if (!url) {
        alert("Endpoint export barang belum tersambung.");
        return;
      }

      window.location.href = url;
    }

    async function importBarangFile(file) {
      const url = String(window.TX_BARANG_IMPORT_URL || "").trim();

      if (!url) {
        throw new Error("Endpoint import barang belum tersambung.");
      }

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: fd,
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal import barang.");
      }

      alert(data.msg || "Import berhasil.");
      await reloadBarangFromServer();
    }

    function bindEditor() {
      if (!IS_PEMILIK || !backdrop || !form) return;

      backdrop.addEventListener("mousedown", (e) => {
        const card = qs(".barang-editor-card", backdrop);
        if (card && !card.contains(e.target)) closeEditor();
      });

      qsa("[data-barang-editor-close]", backdrop).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          closeEditor();
        });
      });

      sanitizeSatuanAngkaInput(ieSatuanAngka);
      sanitizeDigitsOnlyInput(ieStok);
      sanitizeDigitsOnlyInput(ieStokMinimal);
      sanitizeDigitsOnlyInput(ieHargaBeli);
      sanitizeDigitsOnlyInput(ieHarga);

      preventNumberWheelChange(ieStok);
      preventNumberWheelChange(ieStokMinimal);
      preventNumberWheelChange(ieHargaBeli);
      preventNumberWheelChange(ieHarga);

      preventNumberStepKeys(ieStok);
      preventNumberStepKeys(ieStokMinimal);
      preventNumberStepKeys(ieHargaBeli);
      preventNumberStepKeys(ieHarga);

      ieJenis?.addEventListener("change", refreshKodeOtomatis);
      ieJenis?.addEventListener("input", refreshKodeOtomatis);

      ieHarga?.addEventListener("input", refreshPreview);
      ieHargaBeli?.addEventListener("input", refreshPreview);
      ieSatuanAngka?.addEventListener("input", refreshPreview);
      ieSatuanUnit?.addEventListener("input", refreshPreview);
      ieSatuanUnit?.addEventListener("change", refreshPreview);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (submitting) return;

        const submitMode = editorMode;

        const satuanAngkaFinal = normalizeSatuanAngka(ieSatuanAngka?.value || "");
        const satuanUnitFinal = normalizeUnitName(ieSatuanUnit?.value || "");
        const satuanFinal = composeSatuan(satuanAngkaFinal, satuanUnitFinal);

        const jenisFinal = normalizeJenisName(ieJenis?.value);
        const kategoriMeta = getKategoriMetaForJenis(jenisFinal);

        const payload = {
          id_barang: Number(currentEditBarang?.id_barang || 0),
          id_kategori: Number(kategoriMeta.id_kategori || 0),
          id_supplier: Number(ieSupplier?.value || 0),
          kode_kategori: normalizeJenisName(kategoriMeta.kode_kategori || kategoriMeta.prefix || getPrefixFromName(jenisFinal)),
          kode_barang: normalizeText(ieKode?.value).toUpperCase(),
          jenis_barang: jenisFinal,
          nama_barang: normalizeText(ieNama?.value),
          satuan: satuanFinal,
          stok_saat_ini: Math.max(0, Math.floor(toNum(ieStok?.value))),
          stok_minimal: Math.max(0, Math.floor(toNum(ieStokMinimal?.value))),
          harga_beli: normalizeNominalFromInput(ieHargaBeli),
          harga_jual: normalizeNominalFromInput(ieHarga),
        };

        if (!payload.jenis_barang) {
          alert("Kategori barang wajib dipilih.");
          ieJenis?.focus();
          return;
        }

        if (!payload.id_supplier) {
          alert("Supplier utama wajib dipilih.");
          ieSupplier?.focus();
          return;
        }
        
        if (!payload.kode_barang) {
          alert("Kode barang belum terbentuk.");
          return;
        }

        if (!payload.nama_barang) {
          alert("Nama barang wajib diisi.");
          ieNama?.focus();
          return;
        }

        try {
          submitting = true;

          if (saveBtn) saveBtn.textContent = "Menyimpan...";

          if (submitMode === "create") {
            await submitCreateBarang(payload);
          } else {
            if (!currentEditBarang) return;
            await submitEditBarang(payload, currentEditBarang);
          }

          closeEditor();
          await reloadBarangFromServer();
        } catch (err) {
          console.error(err);
          alert(err.message || "Gagal menyimpan barang.");
        } finally {
          submitting = false;

          if (saveBtn) {
            saveBtn.textContent =
              submitMode === "create" ? "Simpan Barang" : "Simpan Perubahan";
          }
        }
      });
    }

    function bindPageActions() {
      elSearch?.addEventListener("input", renderBarangTable);

      if (IS_PEMILIK) {
        btnExport?.addEventListener("click", exportBarang);
        btnTambah?.addEventListener("click", openEditorCreate);

        btnDeleteAll?.addEventListener("click", async () => {
          try {
            await handleDeleteAllBarang();
          } catch (err) {
            console.error(err);
            alert(err.message || "Gagal hapus semua barang.");
          }
        });

        btnImportBtn?.addEventListener("click", () => inputImport?.click());

        inputImport?.addEventListener("change", async (e) => {
          const file = e.target.files?.[0];

          if (!file) return;

          try {
            await importBarangFile(file);
          } catch (err) {
            console.error(err);
            alert(err.message || "Gagal import file.");
          } finally {
            e.target.value = "";
          }
        });

        bindEditor();
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeEditor();
      });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          const now = Date.now();
          if (now - lastFocusReload > 800) {
            lastFocusReload = now;
            reloadBarangSilent();
          }
        }
      });

      window.addEventListener("focus", () => {
        const now = Date.now();
        if (now - lastFocusReload > 800) {
          lastFocusReload = now;
          reloadBarangSilent();
        }
      });
    }

    async function init() {
      initInitialKategori();
      initBarangTopbarToggle();
      bindDisabledLinks();
      bindPageActions();

      buildKategoriTabs();
      populateJenisOptions();
      populateSatuanUnitOptions();
      populateSupplierOptions();

      try {
        await loadSupplierFromServer();
        await reloadBarangFromServer();
      } catch (err) {
        console.error("Init Data Barang error:", err);

        if (elTbody) {
          elTbody.innerHTML = `
            <tr>
              <td colspan="${IS_PEMILIK ? 10 : 8}">
                Gagal memuat data barang. ${escapeHtml(err.message || "")}
              </td>
            </tr>
          `;
        }
      }
    }

    init();

      function initBarangFixedHeaderFinal() {
        const tableWrap = document.querySelector(".table-wrap");
        const table = document.querySelector("#barangTable");
        const thead = table ? table.querySelector("thead") : null;

        if (!tableWrap || !table || !thead) return;

        document.querySelectorAll(".barang-fixed-header-final").forEach((el) => {
          el.remove();
        });

        const fixedBox = document.createElement("div");
        fixedBox.className = "barang-fixed-header-final";
        document.body.appendChild(fixedBox);

        fixedBox.style.position = "fixed";
        fixedBox.style.display = "none";
        fixedBox.style.overflow = "hidden";
        fixedBox.style.zIndex = "800";
        fixedBox.style.pointerEvents = "none";
        fixedBox.style.background = "transparent";
        fixedBox.style.boxSizing = "border-box";

        function getSourceCells() {
          const firstBodyRow = table.querySelector("tbody tr");
          const bodyCells = firstBodyRow ? Array.from(firstBodyRow.children) : [];
          const headCells = Array.from(thead.querySelectorAll("th"));

          if (bodyCells.length === headCells.length) {
            return bodyCells;
          }

          return headCells;
        }

        function syncFixedHeader() {
          if (document.body.classList.contains("modal-open")) {
            fixedBox.style.display = "none";
            return;
          }
          
          const wrapRect = tableWrap.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          const headCells = Array.from(thead.querySelectorAll("th"));
          const sourceCells = getSourceCells();

          const visible =
            wrapRect.bottom > 0 &&
            wrapRect.top < window.innerHeight &&
            tableRect.bottom > wrapRect.top &&
            tableRect.top < wrapRect.bottom;

          if (!visible) {
            fixedBox.style.display = "none";
            return;
          }

          const headerHeight = Math.round(thead.getBoundingClientRect().height || 46);

          fixedBox.style.display = "block";
          fixedBox.style.top = wrapRect.top + "px";
          fixedBox.style.left = wrapRect.left + "px";
          fixedBox.style.width = tableWrap.clientWidth + "px";
          fixedBox.style.height = headerHeight + "px";

          fixedBox.innerHTML = "";

          headCells.forEach((th, index) => {
            const source = sourceCells[index] || th;
            const sourceRect = source.getBoundingClientRect();
            const thStyle = window.getComputedStyle(th);

            const cell = document.createElement("div");
            cell.textContent = th.textContent.trim();

            cell.style.position = "absolute";

            // INI YANG MEMPERBAIKI GESER KIRI/KANAN
            cell.style.left = Math.round(sourceRect.left - wrapRect.left) + "px";

            cell.style.top = "0px";
            cell.style.width = Math.round(sourceRect.width) + "px";
            cell.style.height = headerHeight + "px";

            cell.style.boxSizing = "border-box";
            cell.style.display = "flex";
            cell.style.alignItems = "center";
            cell.style.justifyContent = "center";

            cell.style.padding = thStyle.padding;
            cell.style.textAlign = thStyle.textAlign;
            cell.style.fontFamily = thStyle.fontFamily;
            cell.style.fontSize = thStyle.fontSize;
            cell.style.fontWeight = thStyle.fontWeight;
            cell.style.color = thStyle.color;
            cell.style.whiteSpace = "nowrap";

            cell.style.background =
              "linear-gradient(180deg, #f5f4f0 0%, #e6dfcf 100%)";
            cell.style.borderBottom = "1px solid rgba(0,0,0,0.10)";
            cell.style.boxShadow =
              "0 2px 0 rgba(0,0,0,0.08), 0 8px 14px rgba(0,0,0,0.08)";

            fixedBox.appendChild(cell);
          });
        }

        const onScroll = () => {
          window.requestAnimationFrame(syncFixedHeader);
        };

        const onResize = () => {
          window.requestAnimationFrame(syncFixedHeader);
        };

        tableWrap.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, true);

        const tbody = table.querySelector("tbody");

        if (tbody) {
          const observer = new MutationObserver(() => {
            setTimeout(syncFixedHeader, 50);
            setTimeout(syncFixedHeader, 250);
          });

          observer.observe(tbody, {
            childList: true,
            subtree: true,
          });
        }

        setTimeout(syncFixedHeader, 50);
        setTimeout(syncFixedHeader, 300);
        setTimeout(syncFixedHeader, 800);
        setTimeout(syncFixedHeader, 1500);
      }

      async function initFinalBarangPage() {
        await init();

        initBarangFixedHeaderFinal();

        setTimeout(initBarangFixedHeaderFinal, 800);
        setTimeout(initBarangFixedHeaderFinal, 1500);
        setTimeout(initBarangFixedHeaderFinal, 2500);
      }

      initFinalBarangPage();
    });
  })();