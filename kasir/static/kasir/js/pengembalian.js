(function () {
  "use strict";

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const body = document.body;

  const URLS = {
    list: body.dataset.pengembalianJsonUrl || "",
  };

  const state = {
    items: [],
  };

  const el = {
    toggleTop: qs("[data-pb-toggle-top]"),

    totalData: qs("#pengembalianTotalData"),
    totalRiwayat: qs("#pengembalianTotalRiwayat"),
    totalBarang: qs("#pengembalianTotalBarang"),
    totalRefund: qs("#pengembalianTotalRefund"),
    totalSelesai: qs("#pengembalianTotalSelesai"),

    btnRefresh: qs("#btnRefreshPengembalian"),
    bodyTable: qs("#pengembalianBody"),
  };

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

  function formatRupiah(value) {
    const n = angka(value);
    return n > 0 ? `Rp ${n.toLocaleString("id-ID")}` : "-";
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
      throw new Error("URL pengembalian belum tersedia. Cek data-pengembalian-json-url di HTML.");
    }

    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
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
      }
    });
  }

  function normalisasiJenis(jenis) {
    return String(jenis || "")
      .toLowerCase()
      .trim()
      .replaceAll(" ", "_")
      .replaceAll("-", "_");
  }

  function normalisasiStatus(status) {
    return String(status || "")
      .toLowerCase()
      .trim()
      .replaceAll(" ", "_")
      .replaceAll("-", "_");
  }

  function jenisLabel(jenis) {
    const value = normalisasiJenis(jenis);

    if (value === "barang_pengganti") return "Barang Pengganti";
    if (value === "refund") return "Refund";

    return "-";
  }

  function statusLabel(status) {
    const value = normalisasiStatus(status);

    if (value === "selesai") return "Selesai";
    if (value === "diproses") return "Diproses";

    return "-";
  }

  function jenisBadge(jenis) {
    const value = normalisasiJenis(jenis);

    return `
      <span class="pengembalian-badge pengembalian-jenis ${escapeHtml(value)}">
        ${escapeHtml(jenisLabel(value))}
      </span>
    `;
  }

  function statusBadge(status) {
    const value = normalisasiStatus(status);

    return `
      <span class="pengembalian-badge pengembalian-status ${escapeHtml(value)}">
        ${escapeHtml(statusLabel(value))}
      </span>
    `;
  }

  function renderSummary() {
    const items = state.items || [];

    const total = items.length;

    const totalBarang = items.filter((item) => {
      return normalisasiJenis(item.jenis_pengembalian) === "barang_pengganti";
    }).length;

    const totalRefund = items.filter((item) => {
      return normalisasiJenis(item.jenis_pengembalian) === "refund";
    }).length;

    const totalSelesai = items.filter((item) => {
      return normalisasiStatus(item.status_pengembalian) === "selesai";
    }).length;

    if (el.totalData) el.totalData.textContent = String(total);
    if (el.totalRiwayat) el.totalRiwayat.textContent = String(total);
    if (el.totalBarang) el.totalBarang.textContent = String(totalBarang);
    if (el.totalRefund) el.totalRefund.textContent = String(totalRefund);
    if (el.totalSelesai) el.totalSelesai.textContent = String(totalSelesai);
  }

  function renderTable() {
    if (!el.bodyTable) return;

    const items = state.items || [];

    renderSummary();

    if (!items.length) {
      el.bodyTable.innerHTML = `
        <tr>
          <td colspan="9" class="pengembalian-empty">
            Belum ada riwayat pengembalian.
          </td>
        </tr>
      `;
      return;
    }

    el.bodyTable.innerHTML = items.map((item) => {
      const idPengembalian = item.id_pengembalian || "-";
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
          <td>PB-${escapeHtml(idPengembalian)}</td>
          <td title="${escapeHtml(noPembelian)}">${escapeHtml(noPembelian)}</td>
          <td title="${escapeHtml(barang)}">${escapeHtml(barang)}</td>
          <td title="${escapeHtml(supplier)}">${escapeHtml(supplier)}</td>
          <td>${jenisBadge(item.jenis_pengembalian || item.jenis_label)}</td>
          <td>${escapeHtml(item.qty_pengganti || 0)}</td>
          <td>${escapeHtml(formatRupiah(item.nominal_refund || 0))}</td>
          <td>${escapeHtml(formatTanggal(item.tanggal_pengembalian))}</td>
          <td>${statusBadge(item.status_pengembalian || item.status_label)}</td>
        </tr>
      `;
    }).join("");
  }

  function setTableLoading(text = "Memuat data pengembalian...") {
    if (!el.bodyTable) return;

    el.bodyTable.innerHTML = `
      <tr>
        <td colspan="9" class="pengembalian-empty">
          ${escapeHtml(text)}
        </td>
      </tr>
    `;
  }

  async function loadPengembalian() {
    setTableLoading();

    const data = await fetchJson(URLS.list);

    state.items = Array.isArray(data.items) ? data.items : [];

    renderTable();
  }

  function bindEvents() {
    el.btnRefresh?.addEventListener("click", () => {
      loadPengembalian().catch((err) => alert(err.message));
    });
  }

  async function init() {
    initTopbarToggle();
    initDropdownTopbar();
    bindEvents();

    try {
      await loadPengembalian();
    } catch (err) {
      alert(err.message);

      if (el.bodyTable) {
        el.bodyTable.innerHTML = `
          <tr>
            <td colspan="9" class="pengembalian-empty">
              ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();