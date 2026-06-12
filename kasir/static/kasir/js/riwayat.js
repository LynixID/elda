(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    const qs = (sel, root = document) => (root ? root.querySelector(sel) : null);
    const qsa = (sel, root = document) => (root ? Array.from(root.querySelectorAll(sel)) : []);

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function normalizeText(value, fallback = "-") {
      const s = String(value ?? "").trim();

      if (!s) return fallback;

      const lower = s.toLowerCase();

      if (["null", "none", "undefined"].includes(lower)) return fallback;

      return s;
    }

    function normalizeJenisTransaksi(value) {
      const s = String(value ?? "").trim();
      const lower = s.toLowerCase().replaceAll("_", " ");

      if (!s || ["null", "none", "undefined", "-"].includes(lower)) return "-";

      if (lower === "offline") return "Offline Tunai";
      if (lower === "offline tunai") return "Offline Tunai";
      if (lower === "offline qris") return "Offline QRIS";

      if (lower === "online") return "Online Marketplace";
      if (lower === "online marketplace") return "Online Marketplace";
      if (lower === "online shopee") return "Online Shopee";
      if (lower === "online tiktok") return "Online TikTok Shop";
      if (lower === "online tiktok shop") return "Online TikTok Shop";
      if (lower === "online tokopedia") return "Online Tokopedia";
      if (lower === "online lazada") return "Online Lazada";

      return s;
    }

    function jenisTransaksiClass(value) {
      const label = normalizeJenisTransaksi(value).toLowerCase();

      if (label.includes("qris")) return "badge-jenis-qris";
      if (label.includes("tunai")) return "badge-jenis-tunai";
      if (label.includes("online")) return "badge-jenis-online";

      return "badge-jenis-default";
    }

    function jenisTransaksiBadge(value) {
      const label = normalizeJenisTransaksi(value);

      return `
        <span class="badge-jenis ${jenisTransaksiClass(label)}">
          ${escapeHtml(label)}
        </span>
      `;
    }

    function normalizeMarketplace(value) {
      const s = String(value ?? "").trim();

      if (!s) return "-";

      const lower = s.toLowerCase();

      if (["null", "none", "undefined", "0", "-"].includes(lower)) return "-";
      if (lower === "shopee") return "Shopee";
      if (lower === "tiktok") return "TikTok";
      if (lower === "tokopedia") return "Tokopedia";
      if (lower === "lazada") return "Lazada";

      return s;
    }

    function normalizeNumber(value, fallback = "0") {
      const s = String(value ?? "").trim();

      if (!s) return fallback;

      const lower = s.toLowerCase();

      if (["null", "none", "undefined"].includes(lower)) return fallback;

      return s;
    }

    function normalizeMoney(value) {
      const s = String(value ?? "").trim();

      if (!s) return "Rp 0";

      const lower = s.toLowerCase();

      if (["null", "none", "undefined"].includes(lower)) return "Rp 0";

      return s;
    }

    function getBesaran(item) {
      return normalizeText(
        item?.besaran ??
        item?.satuan ??
        item?.berat ??
        item?.unit_satuan ??
        item?.ukuran ??
        "-"
      );
    }

    /* =========================================================
       TOGGLE TAMPILKAN / SEMBUNYIKAN ATAS
    ========================================================= */

    const topbarToggleBtn = qs("[data-topbar-toggle]");

    function syncTopbarToggleText() {
      if (!topbarToggleBtn) return;

      const isHidden = body.classList.contains("topbar-hidden");

      topbarToggleBtn.textContent = isHidden ? "Tampilkan Atas" : "Sembunyikan Atas";
      topbarToggleBtn.setAttribute("aria-expanded", isHidden ? "false" : "true");
    }

    function bindTopbarToggle() {
      if (!topbarToggleBtn) return;

      syncTopbarToggleText();

      topbarToggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        body.classList.toggle("topbar-hidden");
        syncTopbarToggleText();

        closeAllDropdowns();
      });
    }

    /* =========================================================
       NAVBAR DROPDOWN
    ========================================================= */

    function closeAllDropdowns(except = null) {
      qsa(".nav-dropdown").forEach((dd) => {
        if (except && dd === except) return;

        dd.classList.remove("open");

        const btn = qs(".nav-toggle", dd);
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    function bindNavbarDropdowns() {
      qsa(".nav-dropdown").forEach((dropdown) => {
        const toggle = qs(".nav-toggle", dropdown);

        if (!toggle) return;

        if (toggle.dataset.boundDropdown === "1") return;
        toggle.dataset.boundDropdown = "1";

        toggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const willOpen = !dropdown.classList.contains("open");

          closeAllDropdowns(dropdown);

          dropdown.classList.toggle("open", willOpen);
          toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
      });

      document.addEventListener("click", () => {
        closeAllDropdowns();
      });

      qsa(".nav-dropdown-menu").forEach((menu) => {
        menu.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      });
    }

    /* =========================================================
       MODAL LOCK
    ========================================================= */

    const modalHarian = qs("#modalRiwayat");
    const modalBulanan = qs("#modalBulanan");

    function hasOpenModal() {
      const harianOpen = modalHarian && !modalHarian.hidden;
      const bulananOpen = modalBulanan && !modalBulanan.hidden;

      return Boolean(harianOpen || bulananOpen);
    }

    function syncModalLock() {
      body.classList.toggle("modal-open", hasOpenModal());
    }

    function forceCloseAllModals() {
      if (modalHarian) {
        modalHarian.hidden = true;
        modalHarian.setAttribute("aria-hidden", "true");
      }

      if (modalBulanan) {
        modalBulanan.hidden = true;
        modalBulanan.setAttribute("aria-hidden", "true");
      }

      syncModalLock();
    }

    /* =========================================================
       FILTER HARIAN
    ========================================================= */

    const selectKasir = qs("#selectKasir");
    const kasirIdHidden = qs("#kasirIdHidden");
    const formFilter = qs("#formFilterHarian");

    if (selectKasir && kasirIdHidden && formFilter) {
      selectKasir.addEventListener("change", () => {
        const val = String(selectKasir.value || "").trim();
        kasirIdHidden.value = val || "0";
        formFilter.submit();
      });
    }

    /* =========================================================
       FILTER BULANAN
    ========================================================= */

    const selectTahunBulanan = qs("#selectTahunBulanan");
    const formFilterBulanan = qs("#formFilterBulanan");

    if (selectTahunBulanan && formFilterBulanan) {
      selectTahunBulanan.addEventListener("change", () => {
        formFilterBulanan.submit();
      });
    }

    /* =========================================================
       MODAL DETAIL HARIAN
    ========================================================= */

    const detailLoading = qs("#detailLoading");
    const detailError = qs("#detailError");
    const detailContent = qs("#detailContent");

    const dKode = qs("#dKode");
    const dTanggal = qs("#dTanggal");
    const dJam = qs("#dJam");
    const dKasir = qs("#dKasir");
    const dJenisTransaksi = qs("#dJenisTransaksi");
    const dMarketplace = qs("#dMarketplace");
    const dItemsBody = qs("#dItemsBody");
    const dTotalItem = qs("#dTotalItem");
    const dTotalBelanja = qs("#dTotalBelanja");
    const dNominalBayar = qs("#dNominalBayar");
    const dKembalian = qs("#dKembalian");

    function openModalHarian() {
      if (!modalHarian) return;

      modalHarian.hidden = false;
      modalHarian.setAttribute("aria-hidden", "false");

      syncModalLock();
    }

    function closeModalHarian() {
      if (!modalHarian) return;

      modalHarian.hidden = true;
      modalHarian.setAttribute("aria-hidden", "true");

      syncModalLock();
    }

    qsa("[data-modal-close]", modalHarian || document).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeModalHarian();
      });
    });

    function clearDetailContent() {
      if (dKode) dKode.textContent = "-";
      if (dTanggal) dTanggal.textContent = "-";
      if (dJam) dJam.textContent = "-";
      if (dKasir) dKasir.textContent = "-";
      if (dJenisTransaksi) dJenisTransaksi.textContent = "-";
      if (dMarketplace) dMarketplace.textContent = "-";
      if (dTotalItem) dTotalItem.textContent = "0";
      if (dTotalBelanja) dTotalBelanja.textContent = "Rp 0";
      if (dNominalBayar) dNominalBayar.textContent = "Rp 0";
      if (dKembalian) dKembalian.textContent = "Rp 0";

      if (dItemsBody) {
        dItemsBody.innerHTML =
          `<tr><td colspan="5" class="muted"><em>Tidak ada item.</em></td></tr>`;
      }
    }

    function setDetailLoading(on) {
      if (detailLoading) detailLoading.hidden = !on;
      if (detailError) detailError.hidden = true;
      if (detailContent) detailContent.hidden = true;

      if (on) clearDetailContent();
    }

    function setDetailError(msg) {
      if (detailLoading) detailLoading.hidden = true;
      if (detailContent) detailContent.hidden = true;

      if (detailError) {
        detailError.hidden = false;
        detailError.textContent = msg || "Gagal memuat detail transaksi.";
      }
    }

    function setDetailContent(data) {
      if (detailLoading) detailLoading.hidden = true;
      if (detailError) detailError.hidden = true;
      if (detailContent) detailContent.hidden = false;

      if (dKode) dKode.textContent = normalizeText(data.kode_transaksi);
      if (dTanggal) dTanggal.textContent = normalizeText(data.tanggal);
      if (dJam) dJam.textContent = normalizeText(data.jam);
      if (dKasir) dKasir.textContent = normalizeText(data.kasir);
      if (dJenisTransaksi) {
        dJenisTransaksi.innerHTML = jenisTransaksiBadge(data.jenis_transaksi);
      }
      if (dMarketplace) dMarketplace.textContent = normalizeMarketplace(data.marketplace);

      if (dTotalItem) dTotalItem.textContent = normalizeNumber(data.total_item, "0");
      if (dTotalBelanja) dTotalBelanja.textContent = normalizeMoney(data.total_belanja);
      if (dNominalBayar) dNominalBayar.textContent = normalizeMoney(data.nominal_bayar);
      if (dKembalian) dKembalian.textContent = normalizeMoney(data.kembalian);

      if (!dItemsBody) return;

      dItemsBody.innerHTML = "";

      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) {
        dItemsBody.innerHTML =
          `<tr><td colspan="5" class="muted"><em>Tidak ada item.</em></td></tr>`;
        return;
      }

      items.forEach((it) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${escapeHtml(normalizeText(it.nama_barang))}</td>
          <td style="text-align:center">${escapeHtml(getBesaran(it))}</td>
          <td style="text-align:center">${escapeHtml(normalizeNumber(it.qty, "0"))}</td>
          <td style="text-align:right">${escapeHtml(normalizeMoney(it.harga_satuan))}</td>
          <td style="text-align:right">${escapeHtml(normalizeMoney(it.subtotal))}</td>
        `;

        dItemsBody.appendChild(tr);
      });
    }

    function buildDetailUrl(id) {
      const base = String(document.body?.dataset?.riwayatDetailBase || "").trim();

      if (!base) return "";

      if (/\/0\/?$/.test(base)) {
        return base.replace(/\/0\/?$/, `/${id}/`);
      }

      return `${base.replace(/\/$/, "")}/${id}/`;
    }

    async function fetchDetail(id) {
      const url = buildDetailUrl(id);

      if (!url) {
        throw new Error("URL detail belum terpasang.");
      }

      const finalUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;

      const res = await fetch(finalUrl, {
        method: "GET",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(json.msg || "Gagal memuat detail transaksi.");
      }

      return json.data || {};
    }

    qsa("[data-rw-detail]").forEach((btn) => {
      if (btn.dataset.boundDetail === "1") return;

      btn.dataset.boundDetail = "1";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();

        const id = Number(btn.getAttribute("data-rw-detail") || 0);

        if (!id) return;

        closeAllDropdowns();
        openModalHarian();
        setDetailLoading(true);

        try {
          const data = await fetchDetail(id);
          setDetailContent(data);
        } catch (err) {
          console.error(err);
          setDetailError(err.message || "Gagal memuat detail transaksi.");
        }
      });
    });

    /* =========================================================
       MODAL DETAIL BULANAN
    ========================================================= */

    const bulanLoading = qs("#bulanLoading");
    const bulanError = qs("#bulanError");
    const bulanContent = qs("#bulanContent");

    const bNamaBulan = qs("#bNamaBulan");
    const bJumlahTransaksi = qs("#bJumlahTransaksi");
    const bTotalItem = qs("#bTotalItem");
    const bKasir = qs("#bKasir");
    const bTotalPenjualan = qs("#bTotalPenjualan");
    const bTransaksiBody = qs("#bTransaksiBody");

    function openModalBulanan() {
      if (!modalBulanan) return;

      modalBulanan.hidden = false;
      modalBulanan.setAttribute("aria-hidden", "false");

      syncModalLock();
    }

    function closeModalBulanan() {
      if (!modalBulanan) return;

      modalBulanan.hidden = true;
      modalBulanan.setAttribute("aria-hidden", "true");

      syncModalLock();
    }

    qsa('[data-modal-close="bulanan"], [data-modal-bulanan-close]', modalBulanan || document).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeModalBulanan();
      });
    });

    function clearBulanContent() {
      if (bNamaBulan) bNamaBulan.textContent = "-";
      if (bJumlahTransaksi) bJumlahTransaksi.textContent = "0";
      if (bTotalItem) bTotalItem.textContent = "0";
      if (bKasir) bKasir.textContent = "-";
      if (bTotalPenjualan) bTotalPenjualan.textContent = "Rp 0";

      if (bTransaksiBody) {
        bTransaksiBody.innerHTML =
          `<tr><td colspan="12" class="muted"><em>Tidak ada transaksi.</em></td></tr>`;
      }
    }

    function setBulanLoading(on) {
      if (bulanLoading) bulanLoading.hidden = !on;
      if (bulanError) bulanError.hidden = true;
      if (bulanContent) bulanContent.hidden = true;

      if (on) clearBulanContent();
    }

    function setBulanError(msg) {
      if (bulanLoading) bulanLoading.hidden = true;
      if (bulanContent) bulanContent.hidden = true;

      if (bulanError) {
        bulanError.hidden = false;
        bulanError.textContent = msg || "Gagal memuat detail bulanan.";
      }
    }

    function setBulanContent(data) {
      if (bulanLoading) bulanLoading.hidden = true;
      if (bulanError) bulanError.hidden = true;
      if (bulanContent) bulanContent.hidden = false;

      if (bNamaBulan) bNamaBulan.textContent = normalizeText(data.nama_bulan);
      if (bJumlahTransaksi) bJumlahTransaksi.textContent = normalizeNumber(data.jumlah_transaksi, "0");
      if (bTotalItem) bTotalItem.textContent = normalizeNumber(data.total_item, "0");
      if (bKasir) bKasir.textContent = normalizeText(data.kasir);
      if (bTotalPenjualan) bTotalPenjualan.textContent = normalizeMoney(data.total_penjualan);

      const transaksi = Array.isArray(data.transaksi) ? data.transaksi : [];

      if (!bTransaksiBody) return;

      bTransaksiBody.innerHTML = "";

      if (!transaksi.length) {
        bTransaksiBody.innerHTML =
          `<tr><td colspan="12" class="muted"><em>Tidak ada transaksi.</em></td></tr>`;
        return;
      }

      transaksi.forEach((trx) => {
        const detailItems = Array.isArray(trx.items) ? trx.items : [];

        let namaBarangHtml = "-";
        let besaranHtml = "-";

        if (detailItems.length) {
          namaBarangHtml = detailItems.map((it) => {
            const nama = escapeHtml(normalizeText(it.nama_barang));
            const qty = escapeHtml(normalizeNumber(it.qty, "0"));

            return `<div class="bulan-item-row">${nama} <span class="bulan-item-qty">(x${qty})</span></div>`;
          }).join("");

          besaranHtml = detailItems.map((it) => {
            const besaran = escapeHtml(getBesaran(it));

            return `<div class="bulan-item-row bulan-besaran-row">${besaran}</div>`;
          }).join("");
        } else {
          const namaBarangList = Array.isArray(trx.nama_barang_list) ? trx.nama_barang_list : [];
          const besaranList = Array.isArray(trx.besaran_list) ? trx.besaran_list : [];

          const namaBarangText = namaBarangList.length ? namaBarangList.join(", ") : "-";
          const besaranText = besaranList.length ? besaranList.join(", ") : "-";

          namaBarangHtml = `<div class="bulan-item-row">${escapeHtml(normalizeText(namaBarangText))}</div>`;
          besaranHtml = `<div class="bulan-item-row bulan-besaran-row">${escapeHtml(normalizeText(besaranText))}</div>`;
        }

        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${escapeHtml(normalizeText(trx.kode_transaksi))}</td>
          <td>${escapeHtml(normalizeText(trx.tanggal))}</td>
          <td>${escapeHtml(normalizeText(trx.jam))}</td>
          <td>${escapeHtml(normalizeText(trx.kasir))}</td>
          <td>${jenisTransaksiBadge(trx.jenis_transaksi)}</td>
          <td>${escapeHtml(normalizeMarketplace(trx.marketplace))}</td>
          <td class="bulan-barang-cell">${namaBarangHtml}</td>
          <td class="bulan-besaran-cell">${besaranHtml}</td>
          <td style="text-align:center">${escapeHtml(normalizeNumber(trx.total_item, "0"))}</td>
          <td style="text-align:right">${escapeHtml(normalizeMoney(trx.total_belanja))}</td>
          <td style="text-align:right">${escapeHtml(normalizeMoney(trx.nominal_bayar))}</td>
          <td style="text-align:right">${escapeHtml(normalizeMoney(trx.kembalian))}</td>
        `;

        bTransaksiBody.appendChild(tr);
      });
    }

    function buildBulananUrl(tahun, bulan, kasirId = "") {
      const base = String(document.body?.dataset?.riwayatBulananBase || "").trim();

      if (!base) return "";

      let pathUrl = base;

      if (/\/\d+\/\d+\/?$/.test(base)) {
        pathUrl = base.replace(/\/\d+\/\d+\/?$/, `/${tahun}/${bulan}/`);
      } else {
        pathUrl = `${base.replace(/\/$/, "")}/${tahun}/${bulan}/`;
      }

      if (!kasirId || String(kasirId) === "0") return pathUrl;

      return `${pathUrl}?kasir_id=${encodeURIComponent(String(kasirId))}`;
    }

    async function fetchBulananDetail(tahun, bulan, kasirId = "") {
      const url = buildBulananUrl(tahun, bulan, kasirId);

      if (!url) {
        throw new Error("URL detail bulanan belum terpasang.");
      }

      const finalUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;

      const res = await fetch(finalUrl, {
        method: "GET",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(json.msg || "Gagal memuat detail bulanan.");
      }

      return json.data || {};
    }

    qsa("[data-bulan-detail]").forEach((btn) => {
      if (btn.dataset.boundBulan === "1") return;

      btn.dataset.boundBulan = "1";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();

        const tahun = btn.getAttribute("data-tahun") || "";
        const bulan = btn.getAttribute("data-bulan") || "";
        const kasirId = btn.getAttribute("data-kasir-id") || "";

        if (!tahun || !bulan) return;

        closeAllDropdowns();
        openModalBulanan();
        setBulanLoading(true);

        try {
          const data = await fetchBulananDetail(tahun, bulan, kasirId);
          setBulanContent(data);
        } catch (err) {
          console.error(err);
          setBulanError(err.message || "Gagal memuat detail bulanan.");
        }
      });
    });

    /* =========================================================
       ESC
    ========================================================= */

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      closeAllDropdowns();

      if (modalBulanan && !modalBulanan.hidden) {
        closeModalBulanan();
        return;
      }

      if (modalHarian && !modalHarian.hidden) {
        closeModalHarian();
      }
    });

    /* =========================================================
       INIT
    ========================================================= */

    bindTopbarToggle();
    bindNavbarDropdowns();
    forceCloseAllModals();
    syncTopbarToggleText();

    window.addEventListener("pageshow", () => {
      syncTopbarToggleText();
      forceCloseAllModals();
      closeAllDropdowns();
    });
  });
})();