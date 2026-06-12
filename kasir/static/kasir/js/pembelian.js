(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const csrfToken =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const URLS = {
      supplierJson: body.dataset.supplierJsonUrl || "",
      supplierCreate: body.dataset.supplierCreateUrl || "",
      supplierEdit: body.dataset.supplierEditUrl || "",
      supplierDelete: body.dataset.supplierDeleteUrl || "",
      barangJson: body.dataset.barangJsonUrl || "",
      pembelianDelete: body.dataset.pembelianDeleteUrl || "",
      pembelianJson: body.dataset.pembelianJsonUrl || "",
      pembelianSimpan: body.dataset.pembelianSimpanUrl || "",
      pembelianTerima: body.dataset.pembelianTerimaUrl || "",
    };

    const WILAYAH_API = "https://www.emsifa.com/api-wilayah-indonesia/api";
    const JATIM_PROVINCE_ID = "35";

    const state = {
      suppliers: [],
      barang: [],
      detail: [],
      pembelianRows: [],
      editSupplierId: null,
      kabKotaLoaded: false,
      draftRekomendasi: null,
      autoTerima: false,
    };

    const qs = (selector, root = document) => root.querySelector(selector);
    const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatRp(value) {
      const n = Number(value || 0);
      return "Rp " + n.toLocaleString("id-ID");
    }

    function formatTanggalIndonesia(value) {
      if (!value) return "-";

      const raw = String(value).trim();
      
      const tanggalOnly = raw.split(" ")[0];
      const parts = tanggalOnly.split("-");

      if (parts.length === 3) {
        const [tahun, bulan, hari] = parts;
        return `${hari}-${bulan}-${tahun}`;
      }

      return raw;
    }

    function formatTanggalWaktuIndonesia(value) {
      if (!value) return "-";

      const raw = String(value).trim();
      const [tanggal, waktu] = raw.split(" ");

      const tanggalIndo = formatTanggalIndonesia(tanggal);

      if (waktu) {
        return `${tanggalIndo} ${waktu}`;
      }

      return tanggalIndo;
    }

    function formatAlamatTabel(alamat) {
      const text = String(alamat || "-")
        .trim()
        .replace(/\s+/g, " ");

      if (!text || text === "-") return "-";

      const parts = text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const hasil = parts.map((part) => {
        let item = part.trim();

        item = item
          .replace(/^Kecamatan\s+/i, "KEC. ")
          .replace(/^Kec\.\s*/i, "KEC. ")
          .replace(/^KABUPATEN\s+/i, "KAB. ")
          .replace(/^Kabupaten\s+/i, "KAB. ")
          .replace(/^KOTA\s+/i, "KOTA ")
          .replace(/^Jawa Timur$/i, "JAWA TIMUR");

        const isWilayah =
          /^KEC\./i.test(item) ||
          /^KAB\./i.test(item) ||
          /^KOTA\s/i.test(item) ||
          /^JAWA TIMUR$/i.test(item);

        if (isWilayah) {
          return `<span class="alamat-line alamat-wilayah">${escapeHtml(item.toUpperCase())}</span>`;
        }

        return `<span class="alamat-line alamat-detail">${escapeHtml(item.toUpperCase())}</span>`;
      });

      return hasil.join("");
    }

    function todayISO() {
      const d = new Date();
      return d.toISOString().slice(0, 10);
    }

    function genNoPembelian() {
      const d = new Date();
      const pad = (x) => String(x).padStart(2, "0");

      return (
        "PO-" +
        pad(d.getDate()) +
        pad(d.getMonth() + 1) +
        String(d.getFullYear()).slice(-2) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
      );
    }

    function optionHtml(value, label) {
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }

    function getSelectedText(selectEl) {
      if (!selectEl || !selectEl.value) return "";

      const opt = selectEl.options[selectEl.selectedIndex];
      return opt ? opt.textContent.trim() : "";
    }

    function normalizeWilayahText(text) {
      return String(text || "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .replace(/^KABUPATEN\s+/, "KAB. ")
        .replace(/^KAB\.\s+/, "KAB. ")
        .replace(/^KOTA\s+/, "KOTA ")
        .replace(/^KECAMATAN\s+/, "")
        .replace(/^KEC\.\s+/, "")
        .replace(/^DESA\s+/, "")
        .replace(/^KELURAHAN\s+/, "")
        .trim();
    }

    function pilihOptionBerdasarkanTeks(selectEl, targetText) {
      if (!selectEl || !targetText) return false;

      const target = normalizeWilayahText(targetText);

      const found = Array.from(selectEl.options).find((opt) => {
        return normalizeWilayahText(opt.textContent) === target;
      });

      if (!found) return false;

      selectEl.value = found.value;
      return true;
    }

    function parseAlamatSupplier(alamat) {
      const parts = String(alamat || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      let detail = [];
      let desa = "";
      let kecamatan = "";
      let kabKota = "";

      parts.forEach((part) => {
        const upper = part.toUpperCase();

        if (upper === "JAWA TIMUR") {
          return;
        }

        if (upper.startsWith("KEC.") || upper.startsWith("KECAMATAN ")) {
          kecamatan = part
            .replace(/^KEC\.\s*/i, "")
            .replace(/^KECAMATAN\s*/i, "")
            .trim();
          return;
        }

        if (
          upper.startsWith("KAB.") ||
          upper.startsWith("KABUPATEN ") ||
          upper.startsWith("KOTA ")
        ) {
          kabKota = part
            .replace(/^KAB\.\s*/i, "KABUPATEN ")
            .replace(/^KABUPATEN\s*/i, "KABUPATEN ")
            .replace(/^KOTA\s*/i, "KOTA ")
            .trim();
          return;
        }

        if (!desa && detail.length > 0) {
          desa = part;
          return;
        }

        detail.push(part);
      });

      return {
        detail: detail.join(", "),
        desa,
        kecamatan,
        kabKota,
      };
    }

    async function isiAlamatEditKeFieldMasingMasing(alamat) {
      const parsed = parseAlamatSupplier(alamat);

      const inputDetail = qs("#supplierDetailAlamat");
      const selectKab = qs("#supplierKabKota");
      const selectKec = qs("#supplierKecamatan");
      const selectDesa = qs("#supplierDesa");
      const supplierAlamat = qs("#supplierAlamat");

      if (supplierAlamat) {
        supplierAlamat.value = alamat || "";
      }

      if (inputDetail) {
        inputDetail.value = parsed.detail || alamat || "";
      }

      if (!parsed.kabKota || !selectKab) {
        return;
      }

      await loadKabKotaJawaTimur();

      const kabTerpilih = pilihOptionBerdasarkanTeks(selectKab, parsed.kabKota);

      if (!kabTerpilih) {
        return;
      }

      await loadKecamatanByKabKota(selectKab.value);

      if (parsed.kecamatan && selectKec) {
        const kecTerpilih = pilihOptionBerdasarkanTeks(selectKec, parsed.kecamatan);

        if (kecTerpilih) {
          await loadDesaByKecamatan(selectKec.value);
        }
      }

      if (parsed.desa && selectDesa) {
        pilihOptionBerdasarkanTeks(selectDesa, parsed.desa);
      }

      composeAlamatSupplier();
    }

    function getBarangId(b) {
      return b.id_barang || b.id || b.pk || "";
    }

    function getBarangKode(b) {
      return b.kode_barang || b.kode || b.kode_produk || "-";
    }

    function getBarangNama(b) {
      return b.nama_barang || b.nama || b.nama_produk || "-";
    }

    function getBarangSatuan(b) {
      return (
        b.satuan ||
        b.satuan_barang ||
        b.satuan_display ||
        b.ukuran ||
        b.besaran ||
        b.kemasan ||
        b.isi ||
        b.volume ||
        b.berat ||
        ""
      );
    }

    function getBarangHargaBeli(b) {
      return (
        b.harga_beli ||
        b.harga_beli_satuan ||
        b.harga_modal ||
        b.harga_pokok ||
        b.harga ||
        b.harga_jual ||
        0
      );
    }

    function getBarangSupplierId(b) {
      return Number(
        b.id_supplier ??
        b.supplier_id ??
        b.idSupplier ??
        b.supplier ??
        b.supplier_barang_id ??
        b.id_supplier_barang ??
        0
      );
    }

    function getBarangSupplierLabel(b) {
      const idSupplier = getBarangSupplierId(b);

      const dariBarang =
        b.supplier_label ||
        b.nama_supplier_lengkap ||
        b.nama_perusahaan_supplier ||
        b.nama_perusahaan ||
        b.supplier_perusahaan ||
        b.nama_supplier ||
        b.supplier_nama ||
        b.supplier ||
        "";

      const text = String(dariBarang || "").trim();

      if (text && text !== "[object Object]") {
        return text;
      }

      return getSupplierLabelById(idSupplier);
    }

    function syncSupplierAutoText(label = "") {
      const inputAuto = qs("#pbSupplierAutoText");

      if (!inputAuto) return;

      const text = String(label || "").trim();

      inputAuto.value =
        text && text !== "-"
          ? text
          : "Supplier belum terdata pada barang";
    }

    function getSupplierLabelById(idSupplier) {
      const id = Number(idSupplier || 0);

      if (!id) return "-";

      const supplier = state.suppliers.find((item) => {
        return Number(item.id_supplier) === id;
      });

      if (!supplier) {
        return `Supplier #${id}`;
      }

      const perusahaan = String(supplier.nama_perusahaan || "").trim();
      const contact = String(supplier.nama_supplier || "").trim();

      if (perusahaan && contact) {
        return `${perusahaan} - ${contact}`;
      }

      if (perusahaan) return perusahaan;
      if (contact) return contact;

      return `Supplier #${id}`;
    }

    function getBarangStok(b) {
      return Number(
        b.stok_saat_ini ??
        b.stok ??
        b.jumlah_stok ??
        b.stok_barang ??
        0
      );
    }

    function getBarangStokMinimal(b) {
      return Number(
        b.stok_minimal ??
        b.min_stok ??
        b.minimum_stok ??
        0
      );
    }

    function isBarangPerluRestock(b) {
      const stok = getBarangStok(b);
      const stokMinimal = getBarangStokMinimal(b);

      if (stokMinimal > 0) {
        return stok <= stokMinimal;
      }

      return stok <= 0;
    }

    function hitungQtyRestock(b) {
      const stok = getBarangStok(b);
      const stokMinimal = getBarangStokMinimal(b);

      if (stokMinimal > 0) {
        return Math.max(1, stokMinimal - stok);
      }

      return 1;
    }

    async function fetchWilayah(url) {
      const res = await fetch(url);
      const data = await res.json().catch(() => []);

      if (!res.ok || !Array.isArray(data)) {
        throw new Error("Gagal memuat data wilayah.");
      }

      return data;
    }

    async function api(url, method = "GET", bodyData = null) {
      if (!url) {
        throw new Error("URL endpoint belum tersedia.");
      }

      const opts = {
        method,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": csrfToken,
        },
        credentials: "same-origin",
      };

      if (bodyData) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(bodyData);
      }

      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Terjadi kesalahan.");
      }

      return data;
    }

    function initTopbarToggle() {
      const btn = qs("[data-pb-toggle-top]");
      if (!btn) return;

      const syncButton = () => {
        const hidden = body.classList.contains("pb-top-hidden");
        btn.textContent = hidden ? "Tampilkan Atas" : "Sembunyikan Atas";
        btn.setAttribute("aria-expanded", hidden ? "false" : "true");
      };

      syncButton();

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        body.classList.toggle("pb-top-hidden");
        body.classList.toggle("top-hidden", body.classList.contains("pb-top-hidden"));
        syncButton();
      });
    }

    function initDropdownTopbar() {
      const dropdowns = qsa("[data-nav-dropdown]");
      const toggles = qsa("[data-nav-toggle]");
      const navbar = qs(".main-navbar");

      function tutupSemuaDropdown(kecuali = null) {
        dropdowns.forEach((dropdown) => {
          if (dropdown !== kecuali) {
            dropdown.classList.remove("open");
          }
        });
      }

      function bukaDropdown(dropdown) {
        if (!dropdown) return;

        tutupSemuaDropdown(dropdown);
        dropdown.classList.add("open");
      }

      function toggleDropdown(dropdown) {
        if (!dropdown) return;

        const sudahTerbuka = dropdown.classList.contains("open");

        tutupSemuaDropdown();

        if (!sudahTerbuka) {
          dropdown.classList.add("open");
        }
      }

      dropdowns.forEach((dropdown) => {
        dropdown.addEventListener("mouseenter", () => {
          bukaDropdown(dropdown);
        });
      });

      toggles.forEach((toggle) => {
        toggle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const dropdownAktif = toggle.closest("[data-nav-dropdown]");
          toggleDropdown(dropdownAktif);
        });
      });

      if (navbar) {
        navbar.addEventListener("mouseleave", () => {
          tutupSemuaDropdown();
        });
      }

      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-nav-dropdown]")) return;
        tutupSemuaDropdown();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        tutupSemuaDropdown();
      });
    }

    function openModal(selector) {
      const modal = qs(selector);
      if (!modal) return;

      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      body.classList.add("modal-open");
    }

    function closeModal(selector) {
      const modal = qs(selector);
      if (!modal) return;

      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");

      if (!qs(".pb-modal.show")) {
        body.classList.remove("modal-open");
      }
    }

    function bindModalClose() {
      qsa("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => {
          closeModal(btn.getAttribute("data-close"));
        });
      });

      qsa(".pb-modal").forEach((modal) => {
        modal.addEventListener("mousedown", (event) => {
          if (event.target === modal) {
            closeModal("#" + modal.id);
          }
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        qsa(".pb-modal.show").forEach((modal) => {
          closeModal("#" + modal.id);
        });
      });
    }

    async function loadKabKotaJawaTimur() {
      const selectKab = qs("#supplierKabKota");
      if (!selectKab) return;

      if (state.kabKotaLoaded) return;

      selectKab.innerHTML = `<option value="">Memuat kabupaten/kota...</option>`;

      try {
        const data = await fetchWilayah(`${WILAYAH_API}/regencies/${JATIM_PROVINCE_ID}.json`);

        selectKab.innerHTML =
          `<option value="">Pilih kabupaten/kota</option>` +
          data.map((item) => optionHtml(item.id, item.name)).join("");

        state.kabKotaLoaded = true;
      } catch (err) {
        console.error(err);
        selectKab.innerHTML = `<option value="">Gagal memuat kabupaten/kota</option>`;
      }
    }

    async function loadKecamatanByKabKota(regencyId) {
      const selectKec = qs("#supplierKecamatan");
      const selectDesa = qs("#supplierDesa");

      if (!selectKec || !selectDesa) return;

      selectKec.disabled = true;
      selectDesa.disabled = true;

      selectKec.innerHTML = `<option value="">Memuat kecamatan...</option>`;
      selectDesa.innerHTML = `<option value="">Pilih kecamatan dulu</option>`;

      if (!regencyId) {
        selectKec.innerHTML = `<option value="">Pilih kabupaten/kota dulu</option>`;
        composeAlamatSupplier();
        return;
      }

      try {
        const data = await fetchWilayah(`${WILAYAH_API}/districts/${regencyId}.json`);

        selectKec.innerHTML =
          `<option value="">Pilih kecamatan</option>` +
          data.map((item) => optionHtml(item.id, item.name)).join("");

        selectKec.disabled = false;
        composeAlamatSupplier();
      } catch (err) {
        console.error(err);
        selectKec.innerHTML = `<option value="">Gagal memuat kecamatan</option>`;
      }
    }

    async function loadDesaByKecamatan(districtId) {
      const selectDesa = qs("#supplierDesa");

      if (!selectDesa) return;

      selectDesa.disabled = true;
      selectDesa.innerHTML = `<option value="">Memuat desa/kelurahan...</option>`;

      if (!districtId) {
        selectDesa.innerHTML = `<option value="">Pilih kecamatan dulu</option>`;
        composeAlamatSupplier();
        return;
      }

      try {
        const data = await fetchWilayah(`${WILAYAH_API}/villages/${districtId}.json`);

        selectDesa.innerHTML =
          `<option value="">Pilih desa/kelurahan</option>` +
          data.map((item) => optionHtml(item.id, item.name)).join("");

        selectDesa.disabled = false;
        composeAlamatSupplier();
      } catch (err) {
        console.error(err);
        selectDesa.innerHTML = `<option value="">Gagal memuat desa/kelurahan</option>`;
      }
    }

    function composeAlamatSupplier() {
      const kabKota = getSelectedText(qs("#supplierKabKota"));
      const kecamatan = getSelectedText(qs("#supplierKecamatan"));
      const desa = getSelectedText(qs("#supplierDesa"));
      const detail = qs("#supplierDetailAlamat")?.value.trim() || "";

      const parts = [];

      if (detail) parts.push(detail);
      if (desa) parts.push(desa);
      if (kecamatan) parts.push(`KEC. ${kecamatan}`);

      if (kabKota) {
        const kabKotaRapi = kabKota
          .replace(/^KABUPATEN\s+/i, "KAB. ")
          .replace(/^KOTA\s+/i, "KOTA ");
        parts.push(kabKotaRapi);
      }

      parts.push("JAWA TIMUR");

      const alamatFinal = parts
        .filter(Boolean)
        .join(", ")
        .replace(/\s+/g, " ")
        .trim();

      const supplierAlamat = qs("#supplierAlamat");
      if (supplierAlamat) supplierAlamat.value = alamatFinal;

      return alamatFinal;
    }

    function resetWilayahSupplier() {
      const supplierKabKota = qs("#supplierKabKota");
      const supplierKecamatan = qs("#supplierKecamatan");
      const supplierDesa = qs("#supplierDesa");
      const supplierDetailAlamat = qs("#supplierDetailAlamat");
      const supplierAlamat = qs("#supplierAlamat");

      if (supplierKabKota) supplierKabKota.value = "";

      if (supplierKecamatan) {
        supplierKecamatan.innerHTML = `<option value="">Pilih kabupaten/kota dulu</option>`;
        supplierKecamatan.disabled = true;
      }

      if (supplierDesa) {
        supplierDesa.innerHTML = `<option value="">Pilih kecamatan dulu</option>`;
        supplierDesa.disabled = true;
      }

      if (supplierDetailAlamat) supplierDetailAlamat.value = "";
      if (supplierAlamat) supplierAlamat.value = "";
    }

    function bindAlamatSupplierDropdown() {
      const selectKab = qs("#supplierKabKota");
      const selectKec = qs("#supplierKecamatan");
      const selectDesa = qs("#supplierDesa");
      const detailAlamat = qs("#supplierDetailAlamat");

      if (!selectKab || !selectKec || !selectDesa) return;

      selectKab.addEventListener("change", async () => {
        await loadKecamatanByKabKota(selectKab.value);
      });

      selectKec.addEventListener("change", async () => {
        await loadDesaByKecamatan(selectKec.value);
      });

      selectDesa.addEventListener("change", () => {
        composeAlamatSupplier();
      });

      detailAlamat?.addEventListener("input", () => {
        composeAlamatSupplier();
      });
    }

    function resetSupplierForm() {
      state.editSupplierId = null;

      const supplierId = qs("#supplierId");
      const supplierNama = qs("#supplierNama");
      const supplierPerusahaan = qs("#supplierPerusahaan");
      const supplierNoHp = qs("#supplierNoHp");
      const supplierStatus = qs("#supplierStatus");

      if (supplierId) supplierId.value = "";
      if (supplierNama) supplierNama.value = "";
      if (supplierPerusahaan) supplierPerusahaan.value = "";
      if (supplierNoHp) supplierNoHp.value = "";
      if (supplierStatus) supplierStatus.value = "aktif";

      resetWilayahSupplier();
    }

    async function loadSuppliers(selectedSupplierId = "") {
      const data = await api(URLS.supplierJson);

      state.suppliers = Array.isArray(data.data) ? data.data : [];

      renderSuppliers();
      renderSupplierSelect(selectedSupplierId);
    }

    function renderSuppliers() {
      const tbody = qs("#supplierBody");
      if (!tbody) return;

      if (!state.suppliers.length) {
        tbody.innerHTML = `<tr><td colspan="6">Belum ada supplier.</td></tr>`;
        return;
      }

      tbody.innerHTML = state.suppliers
        .map((s) => {
          return `
            <tr>
              <td>${escapeHtml(s.nama_supplier || "-")}</td>
              <td>${escapeHtml(s.nama_perusahaan || "-")}</td>
              <td>${escapeHtml(s.no_hp || "-")}</td>
              <td class="pb-address-cell">${formatAlamatTabel(s.alamat || "-")}</td>
              <td>${escapeHtml(s.status_supplier || "-")}</td>
              <td class="pb-aksi-col">
                <div class="pb-action-buttons">
                  <button
                    class="pb-icon-btn pb-edit-btn"
                    type="button"
                    data-edit-supplier="${escapeHtml(s.id_supplier)}"
                    data-tooltip="Edit supplier"
                    title="Edit supplier"
                    aria-label="Edit supplier"
                  >
                    <svg class="pb-action-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 20h4L18.5 9.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>

                  <button
                    class="pb-icon-btn pb-delete-btn"
                    type="button"
                    data-delete-supplier="${escapeHtml(s.id_supplier)}"
                    data-tooltip="Hapus supplier"
                    title="Hapus supplier"
                    aria-label="Hapus supplier"
                  >
                    <svg class="pb-action-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 4h6l1 2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M6 6h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                      <path d="M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      qsa("[data-edit-supplier]", tbody).forEach((btn) => {
        btn.addEventListener("click", async () => {
          await editSupplier(Number(btn.dataset.editSupplier || 0));
        });
      });

      qsa("[data-delete-supplier]", tbody).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.dataset.deleteSupplier || 0);
          await hapusSupplier(id);
        });
      });
    }

    function renderSupplierSelect(selectedSupplierId = "") {
      const select = qs("#pbSupplierSelect");
      if (!select) return;

      const aktif = state.suppliers.filter(
        (s) => (s.status_supplier || "").toLowerCase() === "aktif"
      );

      select.innerHTML =
        `<option value="">Pilih Supplier</option>` +
        aktif
          .map((s) => {
            const label = s.nama_perusahaan
              ? `${s.nama_perusahaan} - ${s.nama_supplier || "Contact Person"}`
              : s.nama_supplier || `Supplier #${s.id_supplier}`;
            return `<option value="${s.id_supplier}">${label}</option>`;
          })
          .join("");

      if (selectedSupplierId) select.value = selectedSupplierId;
    }

    async function editSupplier(id) {
      const supplier = state.suppliers.find((item) => {
        return Number(item.id_supplier) === Number(id);
      });

      if (!supplier) return;

      state.editSupplierId = supplier.id_supplier;

      const supplierId = qs("#supplierId");
      const supplierNama = qs("#supplierNama");
      const supplierPerusahaan = qs("#supplierPerusahaan");
      const supplierNoHp = qs("#supplierNoHp");
      const supplierStatus = qs("#supplierStatus");
      const supplierAlamat = qs("#supplierAlamat");

      if (supplierId) supplierId.value = supplier.id_supplier || "";
      if (supplierNama) supplierNama.value = supplier.nama_supplier || "";
      if (supplierPerusahaan) supplierPerusahaan.value = supplier.nama_perusahaan || "";
      if (supplierNoHp) supplierNoHp.value = supplier.no_hp || "";
      if (supplierStatus) supplierStatus.value = supplier.status_supplier || "aktif";

      resetWilayahSupplier();

      if (supplierAlamat) supplierAlamat.value = supplier.alamat || "";

      await isiAlamatEditKeFieldMasingMasing(supplier.alamat || "");
    }

    async function simpanSupplier() {
      const supplierKabKota = qs("#supplierKabKota");
      const supplierKecamatan = qs("#supplierKecamatan");
      const supplierDesa = qs("#supplierDesa");
      const supplierAlamat = qs("#supplierAlamat");
      const supplierDetailAlamat = qs("#supplierDetailAlamat");

      const adaPilihanWilayah =
        Boolean(supplierKabKota?.value) ||
        Boolean(supplierKecamatan?.value) ||
        Boolean(supplierDesa?.value);

      let alamatFinal = "";

      if (adaPilihanWilayah) {
        if (!supplierKabKota?.value) {
          alert("Kabupaten / kota wajib dipilih.");
          return;
        }

        if (!supplierKecamatan?.value) {
          alert("Kecamatan wajib dipilih.");
          return;
        }

        if (!supplierDesa?.value) {
          alert("Desa / kelurahan wajib dipilih.");
          return;
        }

        alamatFinal = composeAlamatSupplier();
      } else {
        alamatFinal =
          supplierDetailAlamat?.value.trim() ||
          supplierAlamat?.value.trim() ||
          "";
      }

      const payload = {
        id_supplier: qs("#supplierId")?.value || "",
        nama_supplier: qs("#supplierNama")?.value.trim() || "",
        nama_perusahaan: qs("#supplierPerusahaan")?.value.trim() || "",
        no_hp: qs("#supplierNoHp")?.value.trim() || "",
        alamat: alamatFinal,
        status_supplier: qs("#supplierStatus")?.value || "aktif",
      };

      if (!payload.nama_supplier) {
        alert("Nama supplier / contact person wajib diisi.");
        return;
      }

      if (!payload.nama_perusahaan) {
        alert("Nama perusahaan / mitra wajib diisi.");
        return;
      }

      if (!payload.alamat) {
        alert("Alamat supplier wajib diisi.");
        return;
      }

      if (state.editSupplierId) {
        await api(URLS.supplierEdit, "POST", payload);
      } else {
        await api(URLS.supplierCreate, "POST", payload);
      }

      resetSupplierForm();
      await loadSuppliers();

      alert("Data supplier berhasil disimpan.");
    }

    async function hapusSupplier(idSupplier) {
      if (!idSupplier) return;

      const ok = confirm("Yakin ingin menghapus supplier ini?");
      if (!ok) return;

      try {
        await api(URLS.supplierDelete, "POST", {
          id_supplier: idSupplier,
        });

        if (state.editSupplierId === idSupplier) {
          resetSupplierForm();
        }

        await loadSuppliers();

        alert("Supplier berhasil dihapus.");
      } catch (err) {
        alert(err.message || "Gagal menghapus supplier.");
      }
    }

    async function loadBarang() {
      const data = await api(URLS.barangJson);

      state.barang = Array.isArray(data.data) ? data.data : [];

      const select = qs("#pbBarangSelect");
      if (!select) return;

      if (!state.barang.length) {
        select.innerHTML = `<option value="">Belum ada barang</option>`;
        syncSupplierAutoText("");
        return;
      }

      select.innerHTML = state.barang
        .map((b) => {
          const idBarang = getBarangId(b);
          const kode = getBarangKode(b);
          const nama = getBarangNama(b);
          const satuan = getBarangSatuan(b);
          const harga = getBarangHargaBeli(b);

          const idSupplier = getBarangSupplierId(b);
          const supplierLabel = getBarangSupplierLabel(b);

          const label = satuan
            ? `${kode} - ${nama} - ${satuan}`
            : `${kode} - ${nama}`;

          return `
            <option
              value="${escapeHtml(idBarang)}"
              data-harga="${escapeHtml(harga)}"
              data-kode="${escapeHtml(kode)}"
              data-nama="${escapeHtml(nama)}"
              data-satuan="${escapeHtml(satuan)}"
              data-supplier-id="${escapeHtml(idSupplier)}"
              data-supplier-label="${escapeHtml(supplierLabel)}"
            >
              ${escapeHtml(label)}
            </option>
          `;
        })
        .join("");

      syncHargaBarang();
    }

    function syncHargaBarang() {
      const select = qs("#pbBarangSelect");
      const hargaInput = qs("#pbHargaBeli");
      const supplierSelect = qs("#pbSupplierSelect");

      if (!select || !hargaInput) return;

      const opt = select.options[select.selectedIndex];

      const harga = Number(opt?.dataset?.harga || 0);
      const idSupplier = Number(opt?.dataset?.supplierId || 0);
      const supplierLabel =
        opt?.dataset?.supplierLabel ||
        getSupplierLabelById(idSupplier);

      hargaInput.value = harga;

      if (supplierSelect && idSupplier) {
        supplierSelect.value = String(idSupplier);
      }

      syncSupplierAutoText(supplierLabel);
    }

    function resetPembelianForm() {
      state.detail = [];

      const noPembelian = qs("#pbNoPembelian");
      const tanggal = qs("#pbTanggal");
      const qty = qs("#pbQty");
      const harga = qs("#pbHargaBeli");

      if (noPembelian) noPembelian.value = genNoPembelian();
      if (tanggal) tanggal.value = todayISO();
      if (qty) qty.value = 1;
      if (harga) harga.value = 0;

      renderDetailPembelian();
      syncHargaBarang();
    }

    function tambahDetailPembelian() {
      const idBarang = Number(qs("#pbBarangSelect")?.value || 0);

      const barang = state.barang.find((item) => {
        return Number(getBarangId(item)) === idBarang;
      });

      if (!barang) {
        alert("Pilih barang dulu.");
        return;
      }

      const qty = Math.max(1, Number(qs("#pbQty")?.value || 1));
      const hargaBeli = Math.max(0, Number(qs("#pbHargaBeli")?.value || 0));

      const kode = getBarangKode(barang);
      const nama = getBarangNama(barang);
      const satuan = getBarangSatuan(barang);

      const idSupplierBarang = getBarangSupplierId(barang);
      const supplierLabelBarang = getBarangSupplierLabel(barang);

      if (!idSupplierBarang) {
        alert("Supplier barang belum terdata. Lengkapi supplier di Data Barang dulu.");
        return;
      }

      const index = state.detail.findIndex((item) => {
        return Number(item.id_barang) === idBarang;
      });

      if (index >= 0) {
        state.detail[index].qty += qty;
        state.detail[index].id_supplier = idSupplierBarang;
        state.detail[index].supplier_id = idSupplierBarang;
        state.detail[index].supplier_label = supplierLabelBarang;
        state.detail[index].satuan = satuan;
        state.detail[index].harga_beli = hargaBeli;
        state.detail[index].subtotal = state.detail[index].qty * hargaBeli;
      } else {
        state.detail.push({
          id_barang: idBarang,
          id_supplier: idSupplierBarang,
          supplier_id: idSupplierBarang,
          supplier_label: supplierLabelBarang,

          kode,
          nama,
          satuan,
          qty,
          harga_beli: hargaBeli,
          subtotal: qty * hargaBeli,
        });
      }

      const supplierSelect = qs("#pbSupplierSelect");
      if (supplierSelect) {
        supplierSelect.value = String(idSupplierBarang);
      }

      syncSupplierAutoText(supplierLabelBarang);
      renderDetailPembelian();
    }

    function autoIsiBarangMenipisKePembelian() {
      const barangMenipis = state.barang.filter(isBarangPerluRestock);

      if (!barangMenipis.length) {
        alert("Belum ada barang yang masuk kategori perlu restock. Cek stok minimal di Data Barang.");
        return;
      }

      state.detail = barangMenipis.map((barang) => {
        const idBarang = Number(getBarangId(barang));
        const kode = getBarangKode(barang);
        const nama = getBarangNama(barang);
        const satuan = getBarangSatuan(barang);
        const hargaBeli = Math.max(0, Number(getBarangHargaBeli(barang) || 0));
        const qty = hitungQtyRestock(barang);

        return {
          id_barang: idBarang,
          kode,
          nama,
          satuan,
          qty,
          harga_beli: hargaBeli,
          subtotal: qty * hargaBeli,
        };
      });

      renderDetailPembelian();
    }

    function renderDetailPembelian() {
      const tbody = qs("#pbDetailBody");
      const totalText = qs("#pbTotalText");

      if (!state.detail.length) {
        tbody.innerHTML = `<tr><td colspan="8">Belum ada item.</td></tr>`;
        if (totalText) totalText.textContent = formatRp(0);
        return;
      }

      tbody.innerHTML = state.detail.map((d, i) => {
        const supplierLabel = getSupplierLabelById(d.id_supplier);
        return `
          <tr>
            <td>${escapeHtml(d.kode)}</td>
            <td>${escapeHtml(d.nama)}</td>
            <td>${escapeHtml(supplierLabel)}</td>
            <td>${escapeHtml(d.satuan)}</td>
            <td class="num">${escapeHtml(d.qty)}</td>
            <td class="num">${escapeHtml(formatRp(d.harga_beli))}</td>
            <td class="num">${escapeHtml(formatRp(d.subtotal))}</td>
            <td class="pb-aksi-col">
              <button class="pb-edit-btn" data-edit-detail="${i}">✎</button>
              <button class="pb-delete-btn" data-hapus-detail="${i}">🗑️</button>
            </td>
          </tr>
        `;
      }).join("");

      qsa(".pb-edit-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => editDetailPembelian(Number(btn.dataset.editDetail)));
      });

      qsa(".pb-delete-btn", tbody).forEach((btn) => {
        btn.addEventListener("click", () => hapusDetail(Number(btn.dataset.hapusDetail)));
      });

      const total = state.detail.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
      if (totalText) totalText.textContent = formatRp(total);
    }

    function editDetailPembelian(index) {
      const item = state.detail[index];

      if (!item) {
        alert("Item tidak ditemukan.");
        return;
      }

      const qtyLama = Number(item.qty || 1);

      const inputQty = prompt("Masukkan jumlah baru:", qtyLama);

      if (inputQty === null) return;

      const qtyBaru = Math.max(1, Number(inputQty || 0));

      if (!Number.isFinite(qtyBaru) || qtyBaru <= 0) {
        alert("Jumlah item tidak valid.");
        return;
      }

      item.qty = qtyBaru;
      item.subtotal = qtyBaru * Number(item.harga_beli || 0);

      renderDetailPembelian();
    }

    function hapusDetail(index) {
      state.detail.splice(index, 1);
      renderDetailPembelian();
    }

    async function simpanPembelian() {
      const payload = {
        no_pembelian: qs("#pbNoPembelian")?.value.trim() || "",
        tanggal_pembelian: qs("#pbTanggal")?.value || "",
        id_supplier: Number(qs("#pbSupplierSelect")?.value || 0),
        langsung_terima: Boolean(state.autoTerima),
        sumber: state.draftRekomendasi ? "rekomendasi" : "manual",
        items: state.detail.map((item) => ({
          id_barang: item.id_barang,
          id_supplier: item.id_supplier || 0,
          supplier_id: item.id_supplier || 0,
          qty: item.qty,
          harga_beli: item.harga_beli,
        })),
      };

      if (!payload.no_pembelian) {
        alert("No pembelian wajib diisi.");
        return;
      }

      if (!payload.tanggal_pembelian) {
        alert("Tanggal pembelian wajib diisi.");
        return;
      }

      if (!payload.id_supplier) {
        alert("Supplier wajib dipilih.");
        return;
      }

      if (!payload.items.length) {
        alert("Detail pembelian masih kosong.");
        return;
      }

      const result = await api(URLS.pembelianSimpan, "POST", payload);

      if (state.draftRekomendasi) {
        hapusDraftRekomendasi();
        state.autoTerima = false;
        state.draftRekomendasi = null;
      }

      closeModal("#pembelianModal");
      await loadPembelian();

      alert(
        result.msg ||
        (payload.langsung_terima
          ? "Pembelian berhasil disimpan dan stok langsung bertambah."
          : "Pembelian berhasil disimpan.")
      );
    }

    function tampilkanDetailPembelian(idPembelian) {
      const row = state.pembelianRows.find((item) => {
        return Number(item.id_pembelian) === Number(idPembelian);
      });

      if (!row) {
        alert("Detail pembelian tidak ditemukan.");
        return;
      }

      const supplierLabel = row.nama_perusahaan
        ? `${row.nama_perusahaan} - ${row.nama_supplier || "Contact Person"}`
        : row.nama_supplier || "-";

      const detailNo = qs("#detailNoPembelian");
      const detailSupplier = qs("#detailSupplierPembelian");
      const detailTanggal = qs("#detailTanggalPembelian");
      const detailStatus = qs("#detailStatusPembelian");
      const detailTotalItem = qs("#detailTotalItemPembelian");
      const detailTotalHarga = qs("#detailTotalHargaPembelian");
      const detailBody = qs("#detailItemPembelianBody");

      if (detailNo) detailNo.textContent = row.no_pembelian || "-";
      if (detailSupplier) detailSupplier.textContent = supplierLabel;
      if (detailTanggal) detailTanggal.textContent = formatTanggalIndonesia(row.tanggal_pembelian);
      if (detailStatus) detailStatus.textContent = row.status_pembelian || "-";
      if (detailTotalItem) detailTotalItem.textContent = row.total_item || 0;
      if (detailTotalHarga) detailTotalHarga.textContent = formatRp(row.total_harga || 0);

      const detailItems = Array.isArray(row.items) ? row.items : [];

      if (!detailBody) {
        openModal("#detailPembelianModal");
        return;
      }

      if (!detailItems.length) {
        detailBody.innerHTML = `
          <tr>
            <td colspan="6">Belum ada detail item untuk pembelian ini.</td>
          </tr>
        `;
      } else {
        detailBody.innerHTML = detailItems
          .map((item) => {
            const kode = item.kode_barang || item.kode || "-";
            const nama = item.nama_barang || item.nama || "-";
            const satuan = item.satuan || item.satuan_barang || "-";
            const qty = Number(item.qty || item.jumlah || 0);
            const harga = Number(item.harga_beli || item.harga || 0);
            const subtotal = Number(item.subtotal || qty * harga || 0);

            return `
              <tr>
                <td>${escapeHtml(kode)}</td>
                <td>${escapeHtml(nama)}</td>
                <td>${escapeHtml(satuan)}</td>
                <td class="num">${escapeHtml(qty)}</td>
                <td class="num">${escapeHtml(formatRp(harga))}</td>
                <td class="num">${escapeHtml(formatRp(subtotal))}</td>
              </tr>
            `;
          })
          .join("");
      }

      openModal("#detailPembelianModal");
    }

    async function loadPembelian() {
      const tbody = qs("#pbBody");
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="8">Memuat data...</td></tr>`;

      let data;

      try {
        data = await api(URLS.pembelianJson);
      } catch (err) {
        console.error(err);

        tbody.innerHTML = `
          <tr>
            <td colspan="8">
              Gagal memuat data pembelian: ${escapeHtml(err.message || "Terjadi kesalahan.")}
            </td>
          </tr>
        `;

        return;
      }

      const rows = Array.isArray(data.data) ? data.data : [];
      state.pembelianRows = rows;

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8">Belum ada data pembelian.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows
        .map((p) => {
          const status = String(p.status_pembelian || "").toLowerCase();

          const namaPerusahaan = String(p.nama_perusahaan || "").trim();
          const namaSupplier = String(p.nama_supplier || "").trim();

          const supplierLabel = namaPerusahaan
            ? `${namaPerusahaan} - ${namaSupplier || "Contact Person"}`
            : namaSupplier || "-";

          return `
            <tr>
              <td>${escapeHtml(p.no_pembelian || "-")}</td>

              <td>${escapeHtml(supplierLabel)}</td>

              <td>${escapeHtml(formatTanggalIndonesia(p.tanggal_pembelian))}</td>

              <td>
                <span class="pb-badge ${escapeHtml(status)}">
                  ${escapeHtml(p.status_pembelian || "-")}
                </span>
              </td>

              <td class="num">${escapeHtml(p.total_item || 0)}</td>

              <td class="num">${escapeHtml(formatRp(p.total_harga || 0))}</td>

              <td>${escapeHtml(formatTanggalWaktuIndonesia(p.tanggal_diterima))}</td>

              <td class="pb-aksi-col">
                <div class="pb-icon-actions">
                  <button
                    class="pb-icon-action pb-icon-detail"
                    type="button"
                    data-detail-pembelian="${escapeHtml(p.id_pembelian)}"
                    title="Lihat detail pembelian"
                    aria-label="Lihat detail pembelian"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 5h16M4 12h16M4 19h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>

                  ${
                    status === "dipesan"
                      ? `
                        <button
                          class="pb-icon-action pb-icon-terima"
                          type="button"
                          data-terima="${escapeHtml(p.id_pembelian)}"
                          title="Terima pesanan"
                          aria-label="Terima pesanan"
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>

                        <button
                          class="pb-icon-action pb-icon-hapus"
                          type="button"
                          data-hapus-pembelian="${escapeHtml(p.id_pembelian)}"
                          title="Batalkan pesanan"
                          aria-label="Batalkan pesanan"
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M9 4h6l1 2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <path d="M6 6h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                            <path d="M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </button>
                      `
                      : ""
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      qsa("[data-detail-pembelian]", tbody).forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = Number(btn.dataset.detailPembelian || 0);
          tampilkanDetailPembelian(id);
        });
      });

      qsa("[data-terima]", tbody).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.dataset.terima || 0);

          const ok = confirm("Yakin barang sudah diterima?");
          if (!ok) return;

          try {
            await api(URLS.pembelianTerima, "POST", {
              id_pembelian: id,
            });

            await loadPembelian();

            alert("Status pembelian berhasil diubah menjadi diterima dan stok sudah ditambah.");
          } catch (err) {
            alert(err.message || "Gagal menerima barang.");
          }
        });
      });

      qsa("[data-hapus-pembelian]", tbody).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.dataset.hapusPembelian || 0);

          const ok = confirm(
            "Yakin ingin membatalkan pembelian ini? Pembelian yang dibatalkan tidak akan masuk stok."
          );

          if (!ok) return;

          try {
            await api(URLS.pembelianDelete, "POST", {
              id_pembelian: id,
            });

            await loadPembelian();

            alert("Pembelian berhasil dibatalkan.");
          } catch (err) {
            alert(err.message || "Gagal membatalkan pembelian.");
          }
        });
      });
    }

    async function openSupplierModal() {
      await loadKabKotaJawaTimur();
      await loadSuppliers();
      openModal("#supplierModal");
    }

    function bacaDraftRekomendasi() {
      try {
        const raw = sessionStorage.getItem("ha_draft_pembelian_rekomendasi");
        if (!raw) return null;

        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.items)) return null;

        return data;
      } catch (err) {
        console.error(err);
        return null;
      }
    }

    function hapusDraftRekomendasi() {
      sessionStorage.removeItem("ha_draft_pembelian_rekomendasi");
    }

    function isiDetailDariDraftRekomendasi(draft) {
      if (!draft || !Array.isArray(draft.items)) return false;

      const idSupplierDraft = Number(
        draft.id_supplier ||
        draft.supplier_id ||
        draft.items?.[0]?.id_supplier ||
        draft.items?.[0]?.supplier_id ||
        0
      );

      const selectSupplier = qs("#pbSupplierSelect");

      if (selectSupplier) {
        selectSupplier.disabled = false;

        if (idSupplierDraft) {
          selectSupplier.value = String(idSupplierDraft);
        }
      }

      const items = draft.items
        .map((item) => {
          const idBarang = Number(item.id_barang || 0);

          const idSupplier = Number(
            item.id_supplier ||
            item.supplier_id ||
            idSupplierDraft ||
            0
          );

          const qty = Number(item.qty || 0);
          const hargaBeli = Number(item.harga_beli || 0);

          const kode = item.kode || item.kode_barang || "-";
          const nama = item.nama || item.nama_barang || "-";
          const satuan = item.satuan || item.satuan_barang || "";

          if (!idBarang || !idSupplier || qty <= 0 || hargaBeli <= 0) {
            return null;
          }

          return {
            id_barang: idBarang,
            id_supplier: idSupplier,
            supplier_id: idSupplier,
            supplier_label: item.supplier_label || getSupplierLabelById(idSupplier),

            kode,
            nama,
            satuan,

            qty,
            harga_beli: hargaBeli,
            subtotal: qty * hargaBeli,
          };
        })
        .filter(Boolean);

      if (!items.length) return false;

      state.detail = items;
      state.draftRekomendasi = draft;
      state.autoTerima = Boolean(draft.auto_terima);

      const supplierIds = Array.from(
        new Set(items.map((item) => Number(item.id_supplier || 0)).filter(Boolean))
      );

      if (selectSupplier) {
        if (supplierIds.length === 1) {
          selectSupplier.value = String(supplierIds[0]);
          selectSupplier.disabled = true;
        } else {
          selectSupplier.value = String(idSupplierDraft || supplierIds[0] || "");
          selectSupplier.disabled = true;
        }
      }

      renderDetailPembelian();

      const btnSave = qs("#btnSavePembelian");
      if (btnSave) {
        btnSave.textContent = state.autoTerima
          ? "Simpan & Tambah Stok"
          : "Simpan Pembelian";
      }

      return true;
    }

    function tampilkanInfoDraftRekomendasi() {
      const draft = state.draftRekomendasi;
      if (!draft) return;

      const totalText = qs("#pbTotalText");
      const infoLama = qs("#pbInfoDraftRekomendasi");
      if (infoLama) infoLama.remove();

      const modalCard = qs("#pembelianModal .pb-modal-card");
      if (!modalCard) return;

      const info = document.createElement("div");
      info.id = "pbInfoDraftRekomendasi";
      info.className = "pb-info-rekomendasi";
      info.innerHTML = `
      <strong>Pembelian dari hasil rekomendasi</strong>
      <span>Item sudah disesuaikan dengan batas dana rekomendasi. Saat disimpan, status menjadi dipesan. Stok baru bertambah setelah barang diterima.</span>
    `;

      const detailTable = qs("#pbDetailBody");
      const tableWrap = detailTable?.closest(".pb-table-wrap");

      if (tableWrap) {
        tableWrap.parentNode.insertBefore(info, tableWrap);
      } else if (totalText) {
        totalText.parentNode.insertBefore(info, totalText);
      }
    }

    async function openPembelianModal(draftRekomendasi = null) {
      const idSupplierDraft = Number(
        draftRekomendasi?.id_supplier ||
        draftRekomendasi?.supplier_id ||
        draftRekomendasi?.items?.[0]?.id_supplier ||
        draftRekomendasi?.items?.[0]?.supplier_id ||
        0
      );

      await loadSuppliers(idSupplierDraft);
      await loadBarang();

      resetPembelianForm();

      const selectSupplier = qs("#pbSupplierSelect");
      if (selectSupplier) {
        selectSupplier.disabled = false;
      }

      if (idSupplierDraft) {
        const selectSupplier = qs("#pbSupplierSelect");
        if (selectSupplier) {
          selectSupplier.value = String(idSupplierDraft);
        }
      }

      if (draftRekomendasi) {
        const berhasil = isiDetailDariDraftRekomendasi(draftRekomendasi);

        if (!berhasil) {
          alert("Draft rekomendasi kosong, tidak valid, atau supplier barang belum sesuai.");
        } else {
          tampilkanInfoDraftRekomendasi();
        }
      }

      openModal("#pembelianModal");
    }

    function bindActions() {
      qs("#btnOpenSupplier")?.addEventListener("click", async () => {
        try {
          await openSupplierModal();
        } catch (err) {
          alert(err.message || "Gagal membuka data supplier.");
        }
      });

      qs("#btnOpenPembelian")?.addEventListener("click", async () => {
        try {
          state.autoTerima = false;
          state.draftRekomendasi = null;
          await openPembelianModal(null);
        } catch (err) {
          alert(err.message || "Gagal membuka form pembelian.");
        }
      });

      qs("#btnResetSupplier")?.addEventListener("click", resetSupplierForm);

      qs("#btnSaveSupplier")?.addEventListener("click", async () => {
        try {
          await simpanSupplier();
        } catch (err) {
          alert(err.message || "Gagal menyimpan supplier.");
        }
      });

      qs("#pbBarangSelect")?.addEventListener("change", syncHargaBarang);

      qs("#btnTambahDetail")?.addEventListener("click", tambahDetailPembelian);

      qs("#btnSavePembelian")?.addEventListener("click", async () => {
        try {
          await simpanPembelian();
        } catch (err) {
          alert(err.message || "Gagal menyimpan pembelian.");
        }
      });

      window.addEventListener("hashchange", async () => {
        if (window.location.hash === "#supplier") {
          try {
            await openSupplierModal();
          } catch (err) {
            alert(err.message || "Gagal membuka data supplier.");
          }
        }
      });
    }

    async function init() {
      initTopbarToggle();
      initDropdownTopbar();
      bindModalClose();
      bindAlamatSupplierDropdown();
      bindActions();

      try {
        await loadKabKotaJawaTimur();
        await loadSuppliers();
        await loadPembelian();

        const params = new URLSearchParams(window.location.search);

        if (params.get("from") === "rekomendasi") {
          const draft = bacaDraftRekomendasi();

          if (draft) {
            await openPembelianModal(draft);
          } else {
            alert("Data rekomendasi tidak ditemukan. Silakan proses rekomendasi ulang.");
          }

          return;
        }

        if (window.location.hash === "#supplier") {
          await openSupplierModal();
        }
      } catch (err) {
        alert(err.message || "Gagal memuat halaman pembelian.");
      }
    }

    init();
  });
})();