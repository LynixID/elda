(function () {
  "use strict";

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const body = document.body;

  const URLS = {
    list: body.dataset.returJsonUrl || "",
    options: body.dataset.returDetailOptionsUrl || "",
    create: body.dataset.returCreateUrl || "",
    status: body.dataset.returStatusUrl || "",
    selesai: body.dataset.returSelesaikanUrl || "",
  };

  const state = {
    detailOptions: [],
    returItems: [],
    loading: false,
    loadingSelesai: false,
  };

  const el = {
    toggleTop: qs("[data-pb-toggle-top]"),

    totalData: qs("#returTotalData"),
    totalDiproses: qs("#returTotalDiproses"),
    totalSelesai: qs("#returTotalSelesai"),
    totalBatal: qs("#returTotalBatal"),

    detailSelect: qs("#returDetailSelect"),
    jumlah: qs("#returJumlah"),
    sisaInfo: qs("#returSisaInfo"),
    alasan: qs("#returAlasan"),

    btnSimpan: qs("#btnSimpanRetur"),
    btnReset: qs("#btnResetRetur"),
    btnRefresh: qs("#btnRefreshRetur"),

    bodyTable: qs("#returBody"),

    modalSelesai: qs("#modalSelesaiRetur"),
    btnTutupModal: qs("#btnTutupModalRetur"),
    btnBatalSelesai: qs("#btnBatalSelesaiRetur"),
    btnSimpanSelesai: qs("#btnSimpanSelesaiRetur"),
    returSelesaiId: qs("#returSelesaiId"),
    jenisPenyelesaian: qs("#jenisPenyelesaianRetur"),
    fieldQtyPengganti: qs("#fieldQtyPenggantiRetur"),
    fieldRefund: qs("#fieldRefundRetur"),
    qtyPengganti: qs("#qtyPenggantiRetur"),
    nominalRefund: qs("#nominalRefundRetur"),
  };

  function csrfToken() {
    const meta = qs('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute("content") || "";

    const input = qs("input[name='csrfmiddlewaretoken']");
    if (input) return input.value || "";

    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function angka(value) {
    const n = parseInt(String(value ?? "").replace(/[^\d-]/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function angkaPositif(value) {
    const n = parseInt(String(value ?? "").replace(/[^\d]/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function rupiahKeAngka(value) {
    return angkaPositif(value);
  }

  function formatRupiah(value) {
    const n = rupiahKeAngka(value);
    return n ? `Rp ${n.toLocaleString("id-ID")}` : "";
  }

  function getReturItemById(idRetur) {
    const id = angka(idRetur);

    return (state.returItems || []).find((item) => {
      return angka(item.id_retur) === id;
    }) || null;
  }

  function ambilNominalRefundSaran(item) {
    if (!item) return 0;

    const dariServer = rupiahKeAngka(item.nominal_refund_saran);

    if (dariServer > 0) {
      return dariServer;
    }

    const jumlahRetur = angka(item.jumlah_retur);
    const hargaBeli = rupiahKeAngka(item.harga_beli);

    return jumlahRetur * hargaBeli;
  }

  function isiNominalRefundOtomatis() {
    const idRetur = angka(el.returSelesaiId?.value);
    const item = getReturItemById(idRetur);
    const nominalRefund = ambilNominalRefundSaran(item);

    if (el.nominalRefund) {
      el.nominalRefund.value = nominalRefund > 0 ? formatRupiah(nominalRefund) : "";
      el.nominalRefund.readOnly = true;
      el.nominalRefund.setAttribute(
        "title",
        "Nominal refund dihitung otomatis dari jumlah retur × harga beli."
      );
    }

    return nominalRefund;
  }
    

  function formatTanggal(value) {
    if (!value) return "-";

    const text = String(value);

    if (text.includes("T")) {
      return text.replace("T", " ").slice(0, 19);
    }

    return text.slice(0, 19);
  }

  async function fetchJson(url, options = {}) {
    if (!url) {
      throw new Error("URL belum tersedia. Cek data-url di retur.html.");
    }

    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.msg || "Terjadi kesalahan.");
    }

    return data;
  }

  /* =========================================================
     TOPBAR
  ========================================================= */

  function initTopbarToggle() {
    if (!el.toggleTop) return;

    function syncText() {
      const hidden = body.classList.contains("pb-top-hidden");
      el.toggleTop.textContent = hidden ? "Tampilkan Atas" : "Sembunyikan Atas";
    }

    el.toggleTop.addEventListener("click", () => {
      body.classList.toggle("pb-top-hidden");
      syncText();
    });

    syncText();
  }

  function tutupSemuaDropdown(kecuali = null) {
    qsa("[data-nav-dropdown]").forEach((drop) => {
      if (drop !== kecuali) {
        drop.classList.remove("open");

        const toggle = drop.querySelector("[data-nav-toggle]");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initDropdownTopbar() {
    qsa("[data-nav-toggle]").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const parent = btn.closest("[data-nav-dropdown]");
        if (!parent) return;

        const akanBuka = !parent.classList.contains("open");

        tutupSemuaDropdown(parent);

        parent.classList.toggle("open", akanBuka);
        btn.setAttribute("aria-expanded", akanBuka ? "true" : "false");
      });
    });

    qsa(".nav-dropdown-menu a[href]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");

        if (!href || href === "#") {
          e.preventDefault();
          return;
        }

        tutupSemuaDropdown();
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-nav-dropdown]")) return;
      tutupSemuaDropdown();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        tutupSemuaDropdown();
        tutupModalSelesaiRetur();
      }
    });
  }

  /* =========================================================
     OPTION ITEM PEMBELIAN
  ========================================================= */

  function getSelectedOptionData() {
    const option = el.detailSelect?.selectedOptions?.[0];
    if (!option || !option.value) return null;

    return {
      idDetail: angka(option.value),
      sisa: angka(option.dataset.sisa),
      label: option.textContent || "",
    };
  }

  function updateSisaInfo() {
    const selected = getSelectedOptionData();

    if (!selected) {
      if (el.sisaInfo) el.sisaInfo.value = "-";
      return;
    }

    if (el.sisaInfo) {
      el.sisaInfo.value = `${selected.sisa} barang`;
    }

    if (el.jumlah) {
      const jumlahSaatIni = angka(el.jumlah.value);

      if (jumlahSaatIni <= 0) {
        el.jumlah.value = "1";
      }

      if (selected.sisa > 0 && jumlahSaatIni > selected.sisa) {
        el.jumlah.value = String(selected.sisa);
      }

      el.jumlah.setAttribute("max", String(selected.sisa));
    }
  }

  function renderOptions() {
    if (!el.detailSelect) return;

    const items = state.detailOptions || [];

    if (!items.length) {
      el.detailSelect.innerHTML = `
        <option value="">Tidak ada item pembelian yang bisa diretur</option>
      `;
      updateSisaInfo();
      return;
    }

    el.detailSelect.innerHTML = [
      `<option value="">Pilih item pembelian yang akan diretur</option>`,
      ...items.map((item) => {
        const idDetail = item.id_detail_pembelian || "";
        const sisa = item.sisa_bisa_retur || 0;
        const label = item.label || [
          item.no_pembelian || "-",
          `${item.kode_barang || "-"} - ${item.nama_barang || "-"} - ${item.satuan || "-"}`,
          `Supplier: ${item.nama_supplier || "-"} / ${item.nama_perusahaan || "-"}`,
          `Sisa bisa retur ${sisa}`,
        ].join(" | ");

        return `
          <option
            value="${escapeHtml(idDetail)}"
            data-sisa="${escapeHtml(sisa)}"
          >
            ${escapeHtml(label)}
          </option>
        `;
      }),
    ].join("");

    updateSisaInfo();
  }

  /* =========================================================
     TABLE
  ========================================================= */
  function statusBadge(status) {
    const s = String(status || "").toLowerCase().trim() || "-";

    let label = "-";

    if (s === "diproses") {
      label = "Belum Selesai";
    } else if (s === "diajukan") {
      label = "Belum Selesai";
    } else if (s === "selesai") {
      label = "Selesai";
    } else if (s === "batal") {
      label = "Batal";
    } else {
      label = s;
    }

    return `
      <span class="retur-status ${escapeHtml(s)}">
        ${escapeHtml(label)}
      </span>
    `;
  }

  function aksiButtons(item) {
    const id = angka(item.id_retur);
    const status = String(item.status_retur || "").toLowerCase().trim();

    if (!id) {
      return `<span class="retur-muted">-</span>`;
    }

    if (status === "selesai" || status === "batal") {
      return `<span class="retur-muted">-</span>`;
    }

    if (status === "diproses") {
      return `
        <div class="retur-aksi">
          <button
            class="retur-icon-btn selesai"
            type="button"
            data-retur-selesai="true"
            data-id-retur="${escapeHtml(id)}"
            data-tooltip="Selesaikan"
            aria-label="Selesaikan retur"
          >
            ✓
          </button>

          <button
            class="retur-icon-btn batal"
            type="button"
            data-retur-status="batal"
            data-id-retur="${escapeHtml(id)}"
            data-tooltip="Batalkan"
            aria-label="Batalkan retur"
          >
            🗑
          </button>
        </div>
      `;
    }

    if (status === "diajukan") {
      return `
        <div class="retur-aksi">
          <button
            class="retur-icon-btn batal"
            type="button"
            data-retur-status="batal"
            data-id-retur="${escapeHtml(id)}"
            data-tooltip="Hapus Data Lama"
            aria-label="Batalkan data lama"
          >
            🗑
          </button>
        </div>
      `;
    }

    return `<span class="retur-muted">-</span>`;
  }

  function renderSummary() {
    const items = state.returItems || [];

    const total = items.length;
    const belumSelesai = items.filter((item) => {
      const status = String(item.status_retur || "").toLowerCase();
      return status === "diproses";
    }).length;

    const selesai = items.filter((item) => {
      return String(item.status_retur || "").toLowerCase() === "selesai";
    }).length;

    const batal = items.filter((item) => {
      return String(item.status_retur || "").toLowerCase() === "batal";
    }).length;

    if (el.totalData) el.totalData.textContent = String(total);
    if (el.totalDiproses) el.totalDiproses.textContent = String(belumSelesai);
    if (el.totalSelesai) el.totalSelesai.textContent = String(selesai);
    if (el.totalBatal) el.totalBatal.textContent = String(batal);
  }

  function renderTable() {
    if (!el.bodyTable) return;

    const items = state.returItems || [];

    renderSummary();

    if (!items.length) {
      el.bodyTable.innerHTML = `
        <tr>
          <td colspan="9" class="retur-empty">
            Belum ada data retur.
          </td>
        </tr>
      `;
      return;
    }

    el.bodyTable.innerHTML = items.map((item) => {
      const idRetur = item.id_retur || "-";
      const noPembelian = item.no_pembelian || "-";

      const barang = [
        item.kode_barang || "-",
        item.nama_barang || "-",
        item.satuan || "-",
      ].join(" - ");

      const supplier = [
        item.nama_supplier || "-",
        item.nama_perusahaan || "-",
      ].join(" / ");

      return `
        <tr>
          <td>RETUR-${escapeHtml(idRetur)}</td>
          <td title="${escapeHtml(noPembelian)}">${escapeHtml(noPembelian)}</td>
          <td title="${escapeHtml(barang)}">${escapeHtml(barang)}</td>
          <td title="${escapeHtml(supplier)}">${escapeHtml(supplier)}</td>
          <td>${escapeHtml(item.jumlah_retur || 0)}</td>
          <td title="${escapeHtml(item.alasan || "-")}">${escapeHtml(item.alasan || "-")}</td>
          <td>${escapeHtml(formatTanggal(item.tanggal_retur))}</td>
          <td>${statusBadge(item.status_retur)}</td>
          <td>${aksiButtons(item)}</td>
        </tr>
      `;
    }).join("");
  }

  function setTableLoading(text = "Memuat data retur...") {
    if (!el.bodyTable) return;

    el.bodyTable.innerHTML = `
      <tr>
        <td colspan="9" class="retur-empty">
          ${escapeHtml(text)}
        </td>
      </tr>
    `;
  }

  async function loadOptions() {
    const data = await fetchJson(URLS.options);
    state.detailOptions = Array.isArray(data.items) ? data.items : [];
    renderOptions();
  }

  async function loadRetur() {
    setTableLoading();

    const data = await fetchJson(URLS.list);
    state.returItems = Array.isArray(data.items) ? data.items : [];
    renderTable();
  }

  async function refreshAll() {
    await loadOptions();
    await loadRetur();
  }

  /* =========================================================
     FORM SIMPAN RETUR
  ========================================================= */

  function resetForm() {
    if (el.detailSelect) el.detailSelect.value = "";

    if (el.jumlah) {
      el.jumlah.value = "1";
      el.jumlah.removeAttribute("max");
    }

    if (el.alasan) el.alasan.value = "";

    updateSisaInfo();
  }

  function validasiForm() {
    const selected = getSelectedOptionData();
    const jumlah = angka(el.jumlah?.value);
    const alasan = String(el.alasan?.value || "").trim();

    if (!selected || !selected.idDetail) {
      alert("Pilih item pembelian terlebih dahulu.");
      return null;
    }

    if (jumlah <= 0) {
      alert("Jumlah retur harus lebih dari 0.");
      return null;
    }

    if (selected.sisa > 0 && jumlah > selected.sisa) {
      alert(`Jumlah retur melebihi sisa yang bisa diretur. Maksimal ${selected.sisa}.`);
      return null;
    }

    if (!alasan) {
      alert("Alasan retur wajib diisi.");
      return null;
    }

    return {
      id_detail_pembelian: selected.idDetail,
      jumlah_retur: jumlah,
      alasan: alasan,
    };
  }

  async function simpanRetur() {
    const payload = validasiForm();
    if (!payload) return;

    if (state.loading) return;
    state.loading = true;

    if (el.btnSimpan) {
      el.btnSimpan.disabled = true;
      el.btnSimpan.textContent = "Menyimpan...";
    }

    try {
      const data = await fetchJson(URLS.create, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert(data.message || data.msg || "Retur berhasil disimpan dan stok sudah berkurang.");

      resetForm();
      await refreshAll();
    } finally {
      state.loading = false;

      if (el.btnSimpan) {
        el.btnSimpan.disabled = false;
        el.btnSimpan.textContent = "Simpan Retur";
      }
    }
  }

  /* =========================================================
     BATAL RETUR
  ========================================================= */

  function pesanKonfirmasiStatus(status) {
    if (status === "batal") {
      return "Batalkan retur ini? Jika stok sudah berkurang, stok akan dikembalikan.";
    }

    return `Ubah status retur menjadi ${status}?`;
  }

  async function updateStatusRetur(idRetur, statusBaru) {
    if (!idRetur || !statusBaru) return;

    const yakin = confirm(pesanKonfirmasiStatus(statusBaru));
    if (!yakin) return;

    const data = await fetchJson(URLS.status, {
      method: "POST",
      body: JSON.stringify({
        id_retur: idRetur,
        status_retur: statusBaru,
      }),
    });

    if (data.message || data.msg) {
      alert(data.message || data.msg);
    }

    await refreshAll();
  }

  /* =========================================================
     MODAL SELESAIKAN RETUR
  ========================================================= */
  function syncModalJenisPenyelesaian() {
    const jenis = el.jenisPenyelesaian?.value || "barang_pengganti";

    if (jenis === "refund") {
      if (el.fieldQtyPengganti) el.fieldQtyPengganti.style.display = "none";
      if (el.fieldRefund) el.fieldRefund.style.display = "flex";

      isiNominalRefundOtomatis();
    } else {
      if (el.fieldQtyPengganti) el.fieldQtyPengganti.style.display = "flex";
      if (el.fieldRefund) el.fieldRefund.style.display = "none";

      if (el.nominalRefund) {
        el.nominalRefund.value = "";
        el.nominalRefund.readOnly = true;
      }
    }
  }

  function bukaModalSelesaiRetur(idRetur) {
    if (!el.modalSelesai) {
      alert("Modal penyelesaian belum ada di retur.html.");
      return;
    }

    const item = getReturItemById(idRetur);
    const jumlahRetur = item ? angka(item.jumlah_retur) : 1;
    const nominalRefund = ambilNominalRefundSaran(item);

    if (el.returSelesaiId) {
      el.returSelesaiId.value = String(idRetur || "");
    }

    if (el.jenisPenyelesaian) {
      el.jenisPenyelesaian.value = "barang_pengganti";
    }

    if (el.qtyPengganti) {
      el.qtyPengganti.value = jumlahRetur > 0 ? String(jumlahRetur) : "1";
    }

    if (el.nominalRefund) {
      el.nominalRefund.value = nominalRefund > 0 ? formatRupiah(nominalRefund) : "";
      el.nominalRefund.readOnly = true;
      el.nominalRefund.setAttribute(
        "title",
        "Nominal refund otomatis dari jumlah retur × harga beli."
      );
    }

    syncModalJenisPenyelesaian();

    el.modalSelesai.hidden = false;
    document.body.classList.add("retur-modal-open");
  }

  function tutupModalSelesaiRetur() {
    if (!el.modalSelesai) return;

    el.modalSelesai.hidden = true;
    document.body.classList.remove("retur-modal-open");
  }

  function validasiSelesaiRetur() {
    const idRetur = angka(el.returSelesaiId?.value);
    const jenis = el.jenisPenyelesaian?.value || "barang_pengganti";
    const qty = angka(el.qtyPengganti?.value);

    const item = getReturItemById(idRetur);
    const refundOtomatis = ambilNominalRefundSaran(item);

    if (!idRetur) {
      alert("ID retur tidak valid.");
      return null;
    }

    if (jenis !== "barang_pengganti" && jenis !== "refund") {
      alert("Jenis penyelesaian tidak valid.");
      return null;
    }

    if (jenis === "barang_pengganti" && qty <= 0) {
      alert("Qty barang pengganti harus lebih dari 0.");
      return null;
    }

    if (jenis === "refund" && refundOtomatis <= 0) {
      alert(
        "Nominal refund belum bisa dihitung. Pastikan harga beli di detail pembelian tidak kosong."
      );
      return null;
    }

    return {
      id_retur: idRetur,
      jenis_pengembalian: jenis,
      qty_pengganti: jenis === "barang_pengganti" ? qty : 0,
      nominal_refund: jenis === "refund" ? refundOtomatis : 0,
    };
  }

  async function simpanSelesaiRetur() {
    const payload = validasiSelesaiRetur();
    if (!payload) return;

    if (state.loadingSelesai) return;
    state.loadingSelesai = true;

    if (el.btnSimpanSelesai) {
      el.btnSimpanSelesai.disabled = true;
      el.btnSimpanSelesai.textContent = "Menyimpan...";
    }

    try {
      const data = await fetchJson(URLS.selesai, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert(data.message || data.msg || "Retur berhasil diselesaikan.");

      tutupModalSelesaiRetur();
      await refreshAll();
    } finally {
      state.loadingSelesai = false;

      if (el.btnSimpanSelesai) {
        el.btnSimpanSelesai.disabled = false;
        el.btnSimpanSelesai.textContent = "Simpan Penyelesaian";
      }
    }
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  function bindEvents() {
    el.detailSelect?.addEventListener("change", updateSisaInfo);

    el.jumlah?.addEventListener("input", () => {
      const selected = getSelectedOptionData();
      if (!selected) return;

      const jumlah = angka(el.jumlah.value);

      if (selected.sisa > 0 && jumlah > selected.sisa) {
        el.jumlah.value = String(selected.sisa);
      }

      if (jumlah < 0) {
        el.jumlah.value = "1";
      }
    });

    el.btnReset?.addEventListener("click", resetForm);

    el.btnRefresh?.addEventListener("click", () => {
      refreshAll().catch((err) => alert(err.message));
    });

    el.btnSimpan?.addEventListener("click", () => {
      simpanRetur().catch((err) => alert(err.message));
    });

    el.bodyTable?.addEventListener("click", (e) => {
      const btnSelesai = e.target.closest("[data-retur-selesai]");
      if (btnSelesai) {
        const idRetur = angka(btnSelesai.dataset.idRetur);
        bukaModalSelesaiRetur(idRetur);
        return;
      }

      const btn = e.target.closest("[data-retur-status]");
      if (!btn) return;

      const idRetur = angka(btn.dataset.idRetur);
      const statusBaru = btn.dataset.returStatus;

      updateStatusRetur(idRetur, statusBaru).catch((err) => alert(err.message));
    });

    el.btnTutupModal?.addEventListener("click", tutupModalSelesaiRetur);
    el.btnBatalSelesai?.addEventListener("click", tutupModalSelesaiRetur);

    el.jenisPenyelesaian?.addEventListener("change", () => {
      syncModalJenisPenyelesaian();

      if (el.jenisPenyelesaian?.value === "refund") {
        isiNominalRefundOtomatis();
      }
    });

    el.nominalRefund?.addEventListener("focus", () => {
      isiNominalRefundOtomatis();
    });

    el.btnSimpanSelesai?.addEventListener("click", () => {
      simpanSelesaiRetur().catch((err) => alert(err.message));
    });

    el.modalSelesai?.addEventListener("click", (e) => {
      if (e.target === el.modalSelesai) {
        tutupModalSelesaiRetur();
      }
    });
  }

  async function init() {
    initTopbarToggle();
    initDropdownTopbar();
    bindEvents();
    syncModalJenisPenyelesaian();

    try {
      await refreshAll();
    } catch (err) {
      alert(err.message);

      if (el.bodyTable) {
        el.bodyTable.innerHTML = `
          <tr>
            <td colspan="9" class="retur-empty">
              ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();