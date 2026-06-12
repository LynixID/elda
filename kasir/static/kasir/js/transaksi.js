(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const qs = (s, r = document) => (r ? r.querySelector(s) : null);
    const qsa = (s, r = document) => (r ? Array.from(r.querySelectorAll(s)) : []);

    const modalTransaksi = qs("#tx-modal-transaksi");
    const modalStruk = qs("#tx-modal-struk");
    const transaksiInlineMode = modalTransaksi && modalTransaksi.classList.contains("tx-inline-transaksi");

    const elNoJual = qs("#txNoJual");
    const elTanggal = qs("#txTanggal");
    const elTotalBig = qs("#txTotalBig");
    const elJenisTransaksi = qs("#txSumberPenjualan");
    const elMetodeBayar = qs("#txMetodeBayar");
    const elMarketplace = qs("#txMarketplace");

    const btnBayarQris = qs("#txBayarQris");
    const elQrisTotal = qs("#txQrisTotal");
    const elQrisStatus = qs("#txQrisStatus");
    const midtransTokenUrl =
      window.TX_MIDTRANS_TOKEN_URL ||
      document.body.dataset.midtransTokenUrl ||
      "";
    const txSaleTop = modalTransaksi ? qs(".tx-saleTop", modalTransaksi) : null;

    const elBarangSelect = qs("#txBarangSelect");
    const btnBarangToggle = qs("#txBarangToggle");
    const elNamaBarang = qs("#txNamaBarang");
    const elHarga = qs("#txHarga");
    const elQty = qs("#txQty");
    const elTotalItem = qs("#txTotalItem");
    const btnTambah = qs("#txTambahItem");
    const btnHapusSemuaItem = qs("#txHapusSemuaItem");
    const tbody = qs("#txDetailBody");

    const elTotalFooter = qs("#txTotal");
    const elBayar = qs("#txBayar");
    const elKembali = qs("#txKembali");
    const rowBayar = elBayar ? elBayar.closest(".tx-payRow") : null;
    const rowKembali = elKembali ? elKembali.closest(".tx-payRow") : null;

    const btnBatal = qs("#txBatal");
    const btnSimpan = qs("#txSimpan");
    const btnCetak = qs("#txCetak");
    const btnSavePdf = qs("#txSavePdf");
    const btnSavePng = qs("#txSavePng");
    const btnPrintNow = qs("#txPrintNow");
    const receiptPaper = qs("#txReceiptPaper");

    let inited = false;
    let saving = false;
    let detail = [];
    let selectedIndex = -1;
    let lastReceiptData = null;
    let lastSavedTransaksiId = null;
    let receiptLibsPromise = null;
    let qrisPaid = false;

    let barangDropdown = null;
    let currentBarangSelection = null;
    let currentSearchResults = [];
    let activeSearchIndex = -1;
    let barangByKode = new Map();

    function toNum(v) {
      if (v == null) return 0;
      if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;

      let s = String(v).trim();
      if (!s) return 0;
      s = s.replace(/rp/gi, "").replace(/\s+/g, "");

      if (/^-?\d+(?:[.,]\d+)?$/.test(s)) {
        const n = Number(s.replace(/\./g, "").replace(",", "."));
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
      if (legacySmallToThousand && n > 0 && n < 1000) n *= 1000;
      return n;
    }

    function normalizeText(v) {
      return String(v || "").trim();
    }

    function normalizeSatuanAngka(v) {
      let s = normalizeText(v).replace(/\s+/g, "").replace(/,/g, ".");
      if (!s) return "";
      const m = s.match(/^(\d+(?:\.\d+)?)/);
      if (!m) return "";
      let out = m[1];
      if (out.includes(".")) out = out.replace(/0+$/, "").replace(/\.$/, "");
      return out;
    }

    function normalizeUnitName(v) {
      let raw = normalizeText(v).toUpperCase();
      raw = raw.replace(/\./g, " ").replace(/\s+/g, " ").trim();
      raw = raw.replace(/^\d+(?:[.,]\d+)?\s*/, "").replace(/\s+/g, "");
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
      if (m) return { angka: normalizeSatuanAngka(m[1]), unit: normalizeUnitName(m[2]) };
      const angkaOnly = normalizeSatuanAngka(s);
      const unitOnly = normalizeUnitName(s);
      if (angkaOnly && !unitOnly) return { angka: angkaOnly, unit: "" };
      return { angka: "", unit: unitOnly };
    }

    function composeSatuan(angka, unit) {
      const a = normalizeSatuanAngka(angka);
      const u = normalizeUnitName(unit);
      if (a && u) return `${a} ${u}`;
      if (u) return u;
      if (a) return a;
      return "";
    }

    function normalizeBarang(raw) {
      const kode = normalizeText(raw?.kode ?? raw?.kode_barang ?? "").toUpperCase();
      const nama = normalizeText(raw?.nama ?? raw?.nama_barang ?? "");
      const jenis = normalizeText(raw?.kategori ?? raw?.jenis ?? raw?.jenis_barang ?? "").toUpperCase();
      const satuanRaw = raw?.berat ?? raw?.satuan ?? raw?.satuan_barang ?? "";
      const satuanParts = splitSatuan(satuanRaw);
      const satuanFinal = composeSatuan(satuanParts.angka, satuanParts.unit);

      return {
        ...raw,
        id: Number(raw?.id_barang ?? raw?.id ?? 0),
        id_barang: Number(raw?.id_barang ?? raw?.id ?? 0),
        kode,
        kode_barang: kode,
        nama,
        nama_barang: nama,
        kategori: jenis,
        jenis,
        jenis_barang: jenis,
        berat: satuanFinal,
        satuan: satuanFinal,
        stok: Math.max(0, Math.floor(toNum(raw?.stok ?? raw?.stok_saat_ini ?? 0))),
        stok_saat_ini: Math.max(0, Math.floor(toNum(raw?.stok ?? raw?.stok_saat_ini ?? 0))),
        stok_minimal: Math.max(0, Math.floor(toNum(raw?.stok_minimal ?? 0))),
        harga_beli: normalizeNominal(raw?.harga_beli ?? raw?.harga_modal ?? 0, { legacySmallToThousand: true }),
        harga_modal: normalizeNominal(raw?.harga_beli ?? raw?.harga_modal ?? 0, { legacySmallToThousand: true }),
        harga: normalizeNominal(raw?.harga ?? raw?.harga_jual ?? 0, { legacySmallToThousand: true }),
        harga_jual: normalizeNominal(raw?.harga ?? raw?.harga_jual ?? 0, { legacySmallToThousand: true }),
      };
    }

    let BARANG = Array.isArray(window.TX_BARANG) ? window.TX_BARANG.map(normalizeBarang) : [];

    function rebuildBarangMap() {
      barangByKode = new Map();
      BARANG.forEach((b) => {
        if (b.kode) barangByKode.set(b.kode.toUpperCase(), b);
      });
    }

    rebuildBarangMap();

    function formatRp(n) {
      const x = Math.max(0, Math.round(toNum(n)));
      return "Rp " + x.toLocaleString("id-ID");
    }

    function getSatuanBarang(item) {
      return String(item?.satuan || item?.berat || item?.satuan_barang || item?.satuan_lengkap || "").trim();
    }

    function getNamaDenganSatuan(item) {
      const nama = String(item?.nama || item?.nama_barang || "-").trim();
      const satuan = getSatuanBarang(item);
      if (!satuan || satuan === "-") return nama;
      if (nama.toLowerCase().includes(satuan.toLowerCase())) return nama;
      return `${nama} ${satuan}`;
    }

    function getBarangLabel(b) {
      return `${b.kode} — ${getNamaDenganSatuan(b)}`;
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function setVal(el, v) {
      if (el) el.value = v;
    }

    function setText(el, t) {
      if (el) el.textContent = t;
    }

    function norm(s) {
      return String(s || "").toLowerCase().trim();
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

    const pad2 = (n) => String(n).padStart(2, "0");

    function todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function genNota() {
      const d = new Date();
      const rand = Math.floor(Math.random() * 9000) + 1000;
      return `NOTA-${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}${rand}`;
    }

    function setSelectValueSafe(el, value, fallback = "") {
      if (!el) return;
      const target = String(value || "").trim().toLowerCase();
      const fallbackVal = String(fallback || "").trim().toLowerCase();
      const values = Array.from(el.options || []).map((opt) => String(opt.value || "").trim().toLowerCase());
      if (values.includes(target)) {
        el.value = value;
      } else if (fallbackVal && values.includes(fallbackVal)) {
        el.value = fallback;
      } else if (el.options && el.options.length) {
        el.selectedIndex = 0;
      }
    }

    function preventNumberWheelChange(el) {
      if (!el || el.dataset.preventWheelBound === "1") return;
      el.dataset.preventWheelBound = "1";
      el.addEventListener("wheel", (e) => {
        if (document.activeElement === el) {
          e.preventDefault();
          el.blur();
        }
      }, { passive: false });
    }

    function preventNumberStepKeys(el) {
      if (!el || el.dataset.preventStepKeyBound === "1") return;
      el.dataset.preventStepKeyBound = "1";
      el.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
      });
    }

    async function reloadBarangFromServer() {
      const url = window.TX_BARANG_JSON_URL;
      if (!url) return;
      const res = await fetch(url, {
        method: "GET",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      });
      const data = await readJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.msg || "Gagal memuat data barang.");
      BARANG = Array.isArray(data.data) ? data.data.map(normalizeBarang) : [];
      rebuildBarangMap();
      clearBarangSelectionFields();
      hideBarangDropdown();
    }

    function bukaModal(modal) {
      if (!modal) return;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function tutupModal(modal) {
      if (!modal) return;
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      if (!qs(".modal.tx-modal.show")) document.body.classList.remove("modal-open");
    }

    qsa("[data-tx-close-struk]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        tutupModal(modalStruk);
      });
    });

    if (modalStruk) {
      modalStruk.addEventListener("mousedown", (e) => {
        const card = qs(".modal-card", modalStruk);
        if (card && !card.contains(e.target)) tutupModal(modalStruk);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideBarangDropdown();
        tutupModal(modalStruk);
      }
    });

    function ensureBarangSearchUI() {
      if (!elBarangSelect) return;
      const wrap = elBarangSelect.closest(".tx-searchWrap") || elBarangSelect.parentElement;
      if (!wrap) return;
      barangDropdown = qs("#txBarangDropdown", wrap);
      if (!barangDropdown) {
        barangDropdown = document.createElement("div");
        barangDropdown.id = "txBarangDropdown";
        barangDropdown.className = "tx-searchDropdown";
        barangDropdown.hidden = true;
        wrap.appendChild(barangDropdown);
      }
    }

    function hideBarangDropdown() {
      if (!barangDropdown) return;
      barangDropdown.hidden = true;
      barangDropdown.innerHTML = "";
      currentSearchResults = [];
      activeSearchIndex = -1;
    }

    function showBarangDropdown() {
      if (barangDropdown) barangDropdown.hidden = false;
    }

    function clearBarangSelectionFields() {
      currentBarangSelection = null;
      setVal(elNamaBarang, "");
      setVal(elHarga, "");
      setVal(elTotalItem, "");
    }

    function filterBarang(query, forceAll = false) {
      const q = norm(query);
      if (!forceAll && (!q || q.length < 2)) return [];
      if (forceAll && !q) return BARANG.slice(0, 60);
      return BARANG.filter((b) => {
        const hay = norm(`${b.kode} ${b.nama} ${b.kategori} ${b.satuan}`);
        return hay.includes(q);
      }).slice(0, 60);
    }

    function renderBarangSearchResults(query, forceAll = false) {
      ensureBarangSearchUI();
      if (!barangDropdown) return;
      currentSearchResults = filterBarang(query, forceAll);
      activeSearchIndex = -1;
      barangDropdown.innerHTML = "";

      if (!currentSearchResults.length) {
        if (!forceAll && String(query || "").trim().length < 2) {
          hideBarangDropdown();
          return;
        }
        const empty = document.createElement("div");
        empty.className = "tx-searchEmpty";
        empty.textContent = "Barang tidak ditemukan.";
        barangDropdown.appendChild(empty);
        showBarangDropdown();
        return;
      }

      currentSearchResults.forEach((b) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "tx-searchItem";
        item.innerHTML = `
          <span class="tx-searchItemMain">${escapeHtml(b.kode || "-")} — ${escapeHtml(getNamaDenganSatuan(b))}</span>
          <span class="tx-searchItemMeta">Satuan: ${escapeHtml(b.satuan || "-")} · Stok: ${escapeHtml(String(b.stok ?? "-"))} · Harga: ${escapeHtml(formatRp(b.harga || 0))}</span>
        `;
        item.addEventListener("mousedown", (e) => e.preventDefault());
        item.addEventListener("click", (e) => {
          e.preventDefault();
          chooseBarangFromDropdown(b);
        });
        barangDropdown.appendChild(item);
      });

      showBarangDropdown();
    }

    function highlightSearchItem() {
      if (!barangDropdown) return;
      const items = qsa(".tx-searchItem", barangDropdown);
      items.forEach((item, idx) => item.classList.toggle("active", idx === activeSearchIndex));
      if (activeSearchIndex >= 0 && items[activeSearchIndex]) {
        items[activeSearchIndex].scrollIntoView({ block: "nearest" });
      }
    }

    function chooseBarangFromDropdown(b) {
      if (!b) return;
      currentBarangSelection = normalizeBarang(b);
      setVal(elBarangSelect, getBarangLabel(currentBarangSelection));
      setVal(elNamaBarang, currentBarangSelection.nama || "");
      setVal(elHarga, formatRp(currentBarangSelection.harga || 0));
      if (!String(elQty?.value || "").trim()) setVal(elQty, "1");
      calcTotalItemField();
      hideBarangDropdown();
      elQty?.focus();
      if (typeof elQty?.select === "function") elQty.select();
    }

    function getBarangByInputExact() {
      const typed = normalizeText(elBarangSelect?.value || "");
      if (!typed) return null;
      const typedUpper = typed.toUpperCase();
      const exactKode = barangByKode.get(typedUpper);
      if (exactKode) return exactKode;
      return BARANG.find((b) => (
        b.kode.toUpperCase() === typedUpper ||
        normalizeText(b.nama).toLowerCase() === typed.toLowerCase() ||
        getBarangLabel(b) === typed
      )) || null;
    }

    function getSelectedBarang() {
      const typed = normalizeText(elBarangSelect?.value || "");
      if (currentBarangSelection) {
        const label = getBarangLabel(currentBarangSelection);
        if (typed === label || typed.toUpperCase() === currentBarangSelection.kode.toUpperCase()) {
          return currentBarangSelection;
        }
      }
      const exact = getBarangByInputExact();
      if (exact) {
        currentBarangSelection = normalizeBarang(exact);
        setVal(elBarangSelect, getBarangLabel(currentBarangSelection));
        setVal(elNamaBarang, currentBarangSelection.nama || "");
        setVal(elHarga, formatRp(currentBarangSelection.harga || 0));
        calcTotalItemField();
        return currentBarangSelection;
      }
      return null;
    }

    function initBarangInputEvents() {
      ensureBarangSearchUI();

      elBarangSelect?.addEventListener("input", () => {
        clearBarangSelectionFields();
        renderBarangSearchResults(elBarangSelect.value, false);
      });

      elBarangSelect?.addEventListener("focus", () => {
        if (String(elBarangSelect.value || "").trim().length >= 2) {
          renderBarangSearchResults(elBarangSelect.value, false);
        }
      });

      elBarangSelect?.addEventListener("keydown", (e) => {
        if (!barangDropdown || barangDropdown.hidden) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            renderBarangSearchResults(elBarangSelect.value, true);
          }
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeSearchIndex = Math.min(currentSearchResults.length - 1, activeSearchIndex + 1);
          highlightSearchItem();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeSearchIndex = Math.max(0, activeSearchIndex - 1);
          highlightSearchItem();
        } else if (e.key === "Enter") {
          if (activeSearchIndex >= 0 && currentSearchResults[activeSearchIndex]) {
            e.preventDefault();
            chooseBarangFromDropdown(currentSearchResults[activeSearchIndex]);
          }
        } else if (e.key === "Escape") {
          hideBarangDropdown();
        }
      });

      btnBarangToggle?.addEventListener("click", (e) => {
        e.preventDefault();
        if (barangDropdown && !barangDropdown.hidden) hideBarangDropdown();
        else renderBarangSearchResults(elBarangSelect?.value || "", true);
      });

      document.addEventListener("mousedown", (e) => {
        if (!barangDropdown || barangDropdown.hidden) return;
        const wrap = elBarangSelect?.closest(".tx-searchWrap");
        if (wrap && !wrap.contains(e.target)) hideBarangDropdown();
      });
    }

    function getJenisTransaksi() {
      const raw = String(elJenisTransaksi?.value || "offline").trim().toLowerCase();
      return raw === "online" ? "online" : "offline";
    }

    function getMarketplace() {
      const raw = String(elMarketplace?.value || "shopee").trim().toLowerCase();
      return raw === "tiktok" ? "tiktok" : "shopee";
    }

    function getMetodeBayar() {
      const raw = String(elMetodeBayar?.value || "tunai").trim().toLowerCase();
      return raw === "qris" ? "qris" : "tunai";
    }
    
    function getLabelMetodeBayar() {
      if (isOnlineMode()) {
        const market = getMarketplace();

        if (market === "shopee") return "Online Shopee";
        if (market === "tiktok") return "Online TikTok Shop";
        if (market === "tokopedia") return "Online Tokopedia";
        if (market === "lazada") return "Online Lazada";

        return "Online Marketplace";
      }

      return getMetodeBayar() === "qris" ? "QRIS" : "Tunai";
    }

    function isQrisMode() {
      return !isOnlineMode() && getMetodeBayar() === "qris";
    }

    function isCashMode() {
      return !isOnlineMode() && getMetodeBayar() === "tunai";
    }

    function resetQrisState() {
      qrisPaid = false;

      if (elQrisStatus) {
        elQrisStatus.textContent = "Belum dibayar";
        elQrisStatus.classList.remove("is-paid", "is-error");
      }

      if (btnBayarQris) {
        btnBayarQris.disabled = false;
        btnBayarQris.textContent = "Bayar QRIS";
      }
    }

    function setQrisStatus(text, type = "") {
      if (!elQrisStatus) return;

      elQrisStatus.textContent = text || "";
      elQrisStatus.classList.remove("is-paid", "is-error");

      if (type === "paid") elQrisStatus.classList.add("is-paid");
      if (type === "error") elQrisStatus.classList.add("is-error");
    }

    function isOnlineMode() {
      return getJenisTransaksi() === "online";
    }

    function getPreferredDisplay(el) {
      if (!el) return "";
      if (el.dataset && el.dataset.txDisplay) return el.dataset.txDisplay;
      if (el.classList.contains("tx-payRow")) return "grid";
      if (el.classList.contains("tx-hint")) return "flex";
      if (el.classList.contains("tx-btn2")) return "inline-flex";
      return "";
    }

    function setVisible(el, show) {
      if (!el) return;
      el.hidden = !show;
      el.style.display = show ? getPreferredDisplay(el) : "none";
    }

    function applyModeUI() {
      const online = isOnlineMode();
      const qris = isQrisMode();
      const cash = isCashMode();
      const root = document;

      document.body.dataset.txMode = online ? "online" : "offline";
      document.body.dataset.txPayMode = online ? "marketplace" : getMetodeBayar();

      if (modalTransaksi) {
        modalTransaksi.classList.toggle("is-online", online);
        modalTransaksi.classList.toggle("is-offline", !online);
        modalTransaksi.classList.toggle("is-qris", qris);
        modalTransaksi.classList.toggle("is-cash", cash);
      }

      if (txSaleTop) {
        txSaleTop.classList.toggle("tx-saleTop--online", online);
        txSaleTop.classList.toggle("tx-saleTop--offline", !online);
      }

      qsa("[data-tx-offline-only]", root).forEach((el) => setVisible(el, !online));
      qsa("[data-tx-online-only]", root).forEach((el) => setVisible(el, online));
      qsa("[data-tx-cash-only]", root).forEach((el) => setVisible(el, cash));
      qsa("[data-tx-qris-only]", root).forEach((el) => setVisible(el, qris));

      if (rowBayar) setVisible(rowBayar, cash);
      if (rowKembali) setVisible(rowKembali, cash);
      if (btnCetak) setVisible(btnCetak, cash);

      if (btnSimpan) {
        setVisible(btnSimpan, !qris);
      }

      if (btnBayarQris) {
        setVisible(btnBayarQris, qris);
      }

      if (elBayar) {
        if (online || qris) {
          elBayar.disabled = true;
          elBayar.readOnly = true;
          elBayar.value = qris ? String(calcTotalTransaksi()) : "0";
        } else {
          elBayar.disabled = false;
          elBayar.readOnly = false;
          if (String(elBayar.value || "").trim() === "0") {
            elBayar.value = "";
          }
        }
      }

      if (elKembali && (online || qris)) {
        elKembali.value = formatRp(0);
      }

      recalcTotalUI();
    }

    function calcTotalTransaksi() {
      return detail.reduce((sum, it) => sum + toNum(it.total), 0);
    }

    function recalcKembali() {
      const total = calcTotalTransaksi();

      if (isOnlineMode() || isQrisMode()) {
        setVal(elKembali, formatRp(0));
        return;
      }

      const bayar = normalizeNominal(elBayar?.value);
      setVal(elKembali, formatRp(Math.max(0, bayar - total)));
    }

    function recalcTotalUI() {
      const total = calcTotalTransaksi();

      setText(elTotalBig, formatRp(total));
      setVal(elTotalFooter, formatRp(total));

      if (elQrisTotal) {
        elQrisTotal.textContent = formatRp(total);
      }

      if (isQrisMode() && elBayar) {
        elBayar.value = String(total);
      }

      recalcKembali();
    }

    function calcTotalItemField() {
      const harga = normalizeNominal(elHarga?.value);
      const qty = Math.max(1, Math.floor(toNum(elQty?.value || 1)));
      setVal(elQty, String(qty));
      setVal(elTotalItem, formatRp(harga * qty));
    }

    function removeItemAt(idx) {
      if (idx < 0 || idx >= detail.length) return;
      detail.splice(idx, 1);
      if (!detail.length) selectedIndex = -1;
      else if (selectedIndex >= detail.length) selectedIndex = detail.length - 1;
      renderDetail();
    }

    function removeAllItems() {
      if (!detail.length) return;
      const ok = confirm("Hapus semua item transaksi?");
      if (!ok) return;
      detail = [];
      selectedIndex = -1;
      renderDetail();
    }

    function renderDetail() {
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!detail.length) {
        const tr = document.createElement("tr");
        tr.className = "empty";
        tr.innerHTML = `<td colspan="6"><em>Belum ada item.</em></td>`;
        tbody.appendChild(tr);
        recalcTotalUI();
        return;
      }

      detail.forEach((it, idx) => {
        const tr = document.createElement("tr");
        tr.dataset.index = String(idx);
        if (idx === selectedIndex) tr.classList.add("selected");

        const tdKode = document.createElement("td");
        tdKode.textContent = it.kode;

        const tdNama = document.createElement("td");
        tdNama.textContent = it.nama;

        const tdSatuan = document.createElement("td");
        tdSatuan.textContent = it.satuan || "-";

        const tdHarga = document.createElement("td");
        tdHarga.className = "num";
        tdHarga.textContent = formatRp(it.harga);

        const tdQty = document.createElement("td");
        tdQty.className = "num";
        tdQty.textContent = String(it.qty);

        const tdTotal = document.createElement("td");
        tdTotal.className = "num";

        const totalWrap = document.createElement("div");
        totalWrap.style.display = "inline-flex";
        totalWrap.style.alignItems = "center";
        totalWrap.style.gap = "10px";
        totalWrap.style.justifyContent = "flex-end";
        totalWrap.style.width = "100%";

        const totalText = document.createElement("span");
        totalText.textContent = formatRp(it.total);

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "tx-row-delete";
        btnDel.title = "Hapus item ini";
        btnDel.setAttribute("aria-label", `Hapus item ${it.nama || it.kode}`);
        btnDel.textContent = "×";
        btnDel.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeItemAt(idx);
        });

        totalWrap.appendChild(totalText);
        totalWrap.appendChild(btnDel);
        tdTotal.appendChild(totalWrap);

        tr.appendChild(tdKode);
        tr.appendChild(tdNama);
        tr.appendChild(tdSatuan);
        tr.appendChild(tdHarga);
        tr.appendChild(tdQty);
        tr.appendChild(tdTotal);

        tr.addEventListener("click", () => {
          selectedIndex = idx;
          renderDetail();
        });

        tbody.appendChild(tr);
      });

      recalcTotalUI();
    }

    function addItem() {
      const b = getSelectedBarang();
      if (!b) {
        alert("Ketik lalu pilih barang dari dropdown dulu.");
        elBarangSelect?.focus();
        return;
      }

      if (!b.id_barang) {
        alert("Barang tidak valid. ID barang kosong.");
        return;
      }

      const qty = Math.max(1, Math.floor(toNum(elQty?.value || 1)));
      const harga = normalizeNominal(b.harga);
      const stok = Math.max(0, Math.floor(toNum(b.stok || 0)));
      const already = detail.find((x) => x.kode === b.kode)?.qty || 0;

      if (qty + already > stok) {
        alert(`Stok tidak cukup.\nStok tersedia: ${stok}\nSudah dipilih: ${already}`);
        return;
      }

      const found = detail.findIndex((x) => x.kode === b.kode);
      if (found >= 0) {
        detail[found].satuan = detail[found].satuan || getSatuanBarang(b);
        detail[found].qty += qty;
        detail[found].total = detail[found].qty * detail[found].harga;
        selectedIndex = found;
      } else {
        detail.push({
          id_barang: Number(b.id_barang),
          kode: b.kode,
          nama: b.nama || "",
          satuan: getSatuanBarang(b),
          harga,
          qty,
          total: harga * qty,
        });
        selectedIndex = detail.length - 1;
      }

      renderDetail();
      setVal(elBarangSelect, "");
      setVal(elNamaBarang, "");
      setVal(elHarga, "");
      setVal(elQty, "1");
      setVal(elTotalItem, "");
      currentBarangSelection = null;
      hideBarangDropdown();
      elBarangSelect?.focus();
    }

    function resetTransaksi() {
      const modeSebelumReset = getJenisTransaksi();
      const metodeSebelumReset = getMetodeBayar();
      const marketplaceSebelumReset = getMarketplace();

      resetQrisState();

      setVal(elNoJual, genNota());
      setVal(elTanggal, todayISO());

      setSelectValueSafe(elJenisTransaksi, modeSebelumReset || "offline", "offline");
      setSelectValueSafe(elMarketplace, marketplaceSebelumReset || "shopee", "shopee");
      setSelectValueSafe(elMetodeBayar, metodeSebelumReset || "tunai", "tunai");

      detail = [];
      selectedIndex = -1;

      setVal(elBarangSelect, "");
      setVal(elNamaBarang, "");
      setVal(elHarga, "");
      setVal(elQty, "1");
      setVal(elTotalItem, "");

      if (modeSebelumReset === "online" || metodeSebelumReset === "qris") {
        setVal(elBayar, "0");
        setVal(elKembali, formatRp(0));
      } else {
        setVal(elBayar, "");
        setVal(elKembali, "");
      }

      setVal(elTotalFooter, formatRp(0));
      setText(elTotalBig, formatRp(0));

      currentBarangSelection = null;
      hideBarangDropdown();

      applyModeUI();
      renderDetail();
    }

    function formatDateReceipt(isoDate) {
      try {
        const d = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      } catch (_) {
        return isoDate || "";
      }
    }

    function formatTimeReceipt() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

   function buildReceiptDataFromCurrentForm() {
      const total = calcTotalTransaksi();

      const qris = typeof isQrisMode === "function" ? isQrisMode() : false;
      const online = typeof isOnlineMode === "function" ? isOnlineMode() : false;

      const bayarInput = normalizeNominal(elBayar?.value);

      const bayar = online ? 0 : (qris ? total : bayarInput);
      const kembali = online || qris ? 0 : Math.max(0, bayar - total);

      const namaKasir = String(document.body?.dataset?.namaKasir || "").trim() || "Kasir";

      let metodeBayar = "Tunai";

      if (online) {
        const market = typeof getMarketplace === "function" ? getMarketplace() : "";

        if (market === "shopee") metodeBayar = "Online Shopee";
        else if (market === "tiktok") metodeBayar = "Online TikTok Shop";
        else if (market === "tokopedia") metodeBayar = "Online Tokopedia";
        else if (market === "lazada") metodeBayar = "Online Lazada";
        else metodeBayar = "Online Marketplace";
      } else {
        metodeBayar = qris ? "QRIS" : "Tunai";
      }

      return {
        toko: "Toko Pertanian Harmoni Agro",
        alamat1: "Jl. Puspita Jaya, Krajan, Ngrupit,",
        alamat2: "Kec. Jenangan, Kabupaten Ponorogo",
        telp: "085790727110",
        kasir: namaKasir,
        no_jual: String(elNoJual?.value || "").trim(),
        tanggal: String(elTanggal?.value || "").trim() || todayISO(),
        jam: formatTimeReceipt(),

        metode_bayar: metodeBayar,

        items: detail.map((it) => ({
          nama: it.nama,
          satuan: it.satuan || "",
          qty: it.qty,
          harga: it.harga,
          total: it.total,
        })),

        total,
        bayar,
        kembali,
      };
    }

    function renderReceipt(data) {
      if (!receiptPaper || !data) return;

      const metodeBayar = String(
        data.metode_bayar ||
        data.metodeBayar ||
        data.metode ||
        "-"
      ).trim() || "-";

      const itemsHtml = (data.items || []).map((it) => {
        const namaTampil = getNamaDenganSatuan(it);

        return `
          <div class="tx-r-item">
            <div class="tx-r-itemName">${escapeHtml(namaTampil)}</div>
            <div class="tx-r-row">
              <span>${escapeHtml(String(it.qty))} x ${escapeHtml(formatRp(it.harga))}</span>
              <span>${escapeHtml(formatRp(it.total))}</span>
            </div>
          </div>
        `;
      }).join("");

      receiptPaper.innerHTML = `
        <div class="tx-r-top">
          <div class="tx-r-shop">${escapeHtml(data.toko || "-")}</div>
        </div>

        <div class="tx-r-meta" style="text-align:center;">
          ${data.alamat1 ? `<div>${escapeHtml(data.alamat1)}</div>` : ""}
          ${data.alamat2 ? `<div>${escapeHtml(data.alamat2)}</div>` : ""}
          ${data.telp ? `<div>Telp. ${escapeHtml(data.telp)}</div>` : ""}
        </div>

        <div class="tx-r-meta">
          <div>No: ${escapeHtml(data.no_jual || "-")}</div>
          <div>Tanggal: ${escapeHtml(formatDateReceipt(data.tanggal))}</div>
          <div>Jam: ${escapeHtml(data.jam || "-")}</div>
          <div>Kasir: ${escapeHtml(data.kasir || "-")}</div>
        </div>

        <div class="tx-r-line">==============================</div>

        ${itemsHtml || `<div class="tx-r-item">Belum ada item.</div>`}

        <div class="tx-r-line">==============================</div>

        <div class="tx-r-totalBox">
          <div class="tx-r-row tx-r-grand">
            <span>Total</span>
            <span>${escapeHtml(formatRp(data.total || 0))}</span>
          </div>

          <div class="tx-r-row">
            <span>Metode</span>
            <span>${escapeHtml(metodeBayar)}</span>
          </div>

          <div class="tx-r-row">
            <span>Bayar</span>
            <span>${escapeHtml(formatRp(data.bayar || 0))}</span>
          </div>

          <div class="tx-r-row">
            <span>Kembali</span>
            <span>${escapeHtml(formatRp(data.kembali || 0))}</span>
          </div>
        </div>

        <div class="tx-r-note">
          Barang yang sudah dibeli tidak dapat ditukar / dikembalikan.
        </div>

        <div class="tx-r-footerDate">
          ==== ${escapeHtml(formatDateReceipt(data.tanggal))} ${escapeHtml(data.jam || "")} ====
        </div>
      `;
    }

    function bukaModalStruk(data) {
      if (!modalStruk || !data) return;
      lastReceiptData = data;
      renderReceipt(data);
      bukaModal(modalStruk);
    }

    function loadExternalScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-ext-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === "1") return resolve();
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error(`Gagal memuat script: ${src}`)), { once: true });
          return;
        }

        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.defer = true;
        s.dataset.extSrc = src;
        s.addEventListener("load", () => {
          s.dataset.loaded = "1";
          resolve();
        }, { once: true });
        s.addEventListener("error", () => reject(new Error(`Gagal memuat script: ${src}`)), { once: true });
        document.head.appendChild(s);
      });
    }

    async function ensureReceiptLibs() {
      const hasHtml2Canvas = typeof window.html2canvas === "function";
      const hasJsPdf = !!(window.jspdf && typeof window.jspdf.jsPDF === "function");
      if (hasHtml2Canvas && hasJsPdf) return;

      if (!receiptLibsPromise) {
        receiptLibsPromise = Promise.all([
          loadExternalScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"),
          loadExternalScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"),
        ]).catch((err) => {
          receiptLibsPromise = null;
          throw err;
        });
      }

      await receiptLibsPromise;
      if (typeof window.html2canvas !== "function" || !(window.jspdf && typeof window.jspdf.jsPDF === "function")) {
        throw new Error("Library struk belum berhasil dimuat.");
      }
    }

    function preloadReceiptLibsNonBlocking() {
      const runner = () => ensureReceiptLibs().catch(() => {});
      if ("requestIdleCallback" in window) window.requestIdleCallback(runner, { timeout: 2500 });
      else setTimeout(runner, 1200);
    }

    async function saveReceiptAsPng() {
      if (!receiptPaper) return;
      await ensureReceiptLibs();
      const canvas = await window.html2canvas(receiptPaper, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${lastReceiptData?.no_jual || "struk"}.png`;
      link.click();
    }

    function getReceiptPageHeightMm() {
      if (!receiptPaper) return 120;
      const pxHeight = Math.ceil(receiptPaper.scrollHeight || receiptPaper.offsetHeight || 0);
      const mmHeight = Math.ceil((pxHeight * 25.4) / 96) + 8;
      return Math.max(110, Math.min(mmHeight, 500));
    }

    async function saveReceiptAsPdf() {
      if (!receiptPaper) return;
      await ensureReceiptLibs();
      const canvas = await window.html2canvas(receiptPaper, { backgroundColor: "#ffffff", scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdfWidth = 80;
      const imgHeightMm = (canvas.height * pdfWidth) / canvas.width;
      const pageHeightMm = Math.max(getReceiptPageHeightMm(), Math.ceil(imgHeightMm) + 2);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, pageHeightMm],
      });

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeightMm);
      pdf.save(`${lastReceiptData?.no_jual || "struk"}.pdf`);
    }

    function getReceiptPrintStyles(pageHeightMm) {
      return `
        @page { size: 80mm ${pageHeightMm}mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          width: 80mm !important;
          background: #ffffff;
          color: #000000;
          font-family: "Courier New", Courier, monospace;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          overflow: hidden;
        }
        .print-root {
          width: 80mm !important;
          margin: 0 !important;
          padding: 3mm 3mm 4mm !important;
          background: #ffffff;
        }
        .tx-receiptPaper {
          width: 100%;
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #000000;
          font-size: 12px;
          line-height: 1.38;
        }
        .tx-r-top { text-align: center; margin-bottom: 4px; }
        .tx-r-shop { text-align: center; font-size: 15px; font-weight: 700; line-height: 1.25; margin-bottom: 3px; word-break: break-word; }
        .tx-r-meta { font-size: 11px; line-height: 1.35; word-break: break-word; }
        .tx-r-line { text-align: center; font-size: 10px; margin: 7px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        .tx-r-item { margin: 7px 0; }
        .tx-r-itemName { font-weight: 700; margin-bottom: 2px; word-break: break-word; }
        .tx-r-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; width: 100%; font-size: 11px; }
        .tx-r-row span:first-child { flex: 1 1 auto; min-width: 0; word-break: break-word; }
        .tx-r-row span:last-child { flex: 0 0 auto; white-space: nowrap; text-align: right; }
        .tx-r-totalBox { margin-top: 8px; }
        .tx-r-grand { font-weight: 700; font-size: 12px; }
        .tx-r-note { text-align: center; margin-top: 10px; font-size: 10px; line-height: 1.35; word-break: break-word; }
        .tx-r-footer, .tx-r-footerDate { text-align: center; margin-top: 8px; font-size: 10px; line-height: 1.3; }
      `;
    }

    function buildReceiptPrintHtml(receiptHtml, pageHeightMm) {
      return `
        <!doctype html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Struk</title>
          <style>${getReceiptPrintStyles(pageHeightMm)}</style>
        </head>
        <body>
          <div class="print-root">${receiptHtml}</div>
        </body>
        </html>
      `;
    }

    async function cetakStrukDjango(idTransaksi) {
      const id = Number(
        idTransaksi ||
        lastSavedTransaksiId ||
        lastReceiptData?.id_transaksi ||
        0
      );

      if (!id) {
        alert("Transaksi belum tersimpan. Klik Simpan/Cetak dulu sampai transaksi tersimpan.");
        return;
      }

      try {
        if (btnPrintNow) {
          btnPrintNow.disabled = true;
          btnPrintNow.textContent = "Mencetak...";
        }

        const res = await fetch(`/transaksi/${id}/cetak/`, {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "same-origin",
        });

        const data = await readJsonSafe(res);

        if (!res.ok || data.status !== "success") {
          throw new Error(data.message || data.msg || "Gagal mencetak struk.");
        }

        alert(data.message || "Struk berhasil dicetak.");
      } catch (err) {
        console.error(err);
        alert("Gagal cetak struk: " + (err.message || err));
      } finally {
        if (btnPrintNow) {
          btnPrintNow.disabled = false;
          btnPrintNow.textContent = "Print";
        }
      }
    }

    function printReceiptNow() {
      cetakStrukDjango();
    }

    async function buatTokenMidtrans() {
      const total = calcTotalTransaksi();

      const payload = {
        no_jual: elNoJual?.value || "",
        tanggal: String(elTanggal?.value || "").trim() || todayISO(),
        sumber_penjualan: "offline",
        metode_bayar: "qris",
        total,
        items: detail.map((x) => ({
          id_barang: x.id_barang,
          kode: x.kode,
          nama: x.nama,
          qty: x.qty,
          harga: x.harga,
        })),
      };

      const res = await fetch(midtransTokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || data.message || "Gagal membuat QRIS Midtrans.");
      }

      return data;
    }

    async function bayarQrisMidtrans() {
      if (!isQrisMode()) {
        alert("QRIS hanya untuk Jenis Offline dengan Metode QRIS.");
        return;
      }

      if (!detail.length) {
        alert("Belum ada item. Tambahkan barang dulu.");
        return;
      }

      if (!midtransTokenUrl) {
        alert("URL Midtrans token belum tersedia. Cek transaksi.html dan urls.py.");
        return;
      }

      if (!window.snap) {
        alert("Snap Midtrans belum terbaca. Cek script Snap di transaksi.html.");
        return;
      }

      try {
        btnBayarQris.disabled = true;
        btnBayarQris.textContent = "Memuat QRIS...";
        setQrisStatus("Membuat QRIS...");

        const data = await buatTokenMidtrans();

        window.snap.pay(data.token, {
          onSuccess: async function () {
            qrisPaid = true;

            const total = calcTotalTransaksi();
            setVal(elBayar, String(total));
            setVal(elKembali, formatRp(0));

            btnBayarQris.textContent = "Pembayaran Berhasil";
            setQrisStatus("Sudah dibayar", "paid");

            await simpanTransaksi();
          },

          onPending: function () {
            qrisPaid = false;
            btnBayarQris.disabled = false;
            btnBayarQris.textContent = "Bayar QRIS";
            setQrisStatus("Masih pending");
            alert("Pembayaran masih pending. Silakan cek simulator Midtrans.");
          },

          onError: function () {
            qrisPaid = false;
            btnBayarQris.disabled = false;
            btnBayarQris.textContent = "Bayar QRIS";
            setQrisStatus("Pembayaran gagal", "error");
            alert("Pembayaran QRIS gagal.");
          },

          onClose: function () {
            if (!qrisPaid) {
              btnBayarQris.disabled = false;
              btnBayarQris.textContent = "Bayar QRIS";
              setQrisStatus("Belum dibayar");
            }
          },
        });

      } catch (err) {
        console.error(err);
        qrisPaid = false;
        btnBayarQris.disabled = false;
        btnBayarQris.textContent = "Bayar QRIS";
        setQrisStatus("Gagal membuat QRIS", "error");
        alert(err.message || "Gagal membuka pembayaran QRIS.");
      }
    }

    async function simpanTransaksi() {
      if (saving) return;
      if (!detail.length) {
        alert("Belum ada item. Tambahkan barang dulu.");
        return;
      }

      const online = isOnlineMode();
      const qris = isQrisMode();
      const cash = isCashMode();

      const sumber_penjualan = online ? "online" : "offline";
      const total = calcTotalTransaksi();

      const bayar = online ? 0 : (qris ? total : normalizeNominal(elBayar?.value));
      const kembali = online || qris ? 0 : Math.max(0, bayar - total);

      if (cash && bayar < total) {
        alert("Uang bayar kurang.");
        elBayar?.focus();
        return;
      }

      if (qris && !qrisPaid) {
        alert("Klik Bayar QRIS dulu sampai pembayaran berhasil.");
        return;
      }

      const tanggalSekarang = String(elTanggal?.value || "").trim() || todayISO();
      setVal(elTanggal, tanggalSekarang);

      const payload = {
        no_jual: elNoJual?.value || "",
        tanggal: tanggalSekarang,
        sumber_penjualan,
        metode_bayar: online ? "marketplace" : getMetodeBayar(),
        total,
        bayar,
        kembali,
        items: detail.map((x) => ({
          id_barang: x.id_barang,
          kode: x.kode,
          qty: x.qty,
        })),
      };

      if (online && elMarketplace) payload.marketplace = getMarketplace();

      let receiptAfterSave = null;
      if (!online) {
        if (qris) {
          setVal(elBayar, String(total));
          setVal(elKembali, formatRp(0));
        }

        receiptAfterSave = buildReceiptDataFromCurrentForm();
      }

      const url = window.TX_SAVE_URL || "/transaksi/simpan/";
      const csrf = getCSRFToken();

      try {
        saving = true;
        if (btnSimpan) btnSimpan.textContent = "Menyimpan...";

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrf,
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

      const data = await readJsonSafe(res);
        if (!res.ok || !data.ok) {
          alert(data.msg || "Gagal menyimpan transaksi.");
          return;
        }

        lastSavedTransaksiId = Number(data.id_transaksi || 0);

        if (receiptAfterSave) {
          receiptAfterSave.id_transaksi = lastSavedTransaksiId;
        }

        alert(`${data.msg}\nID Transaksi: ${data.id_transaksi || ""}`);

        try {
          await reloadBarangFromServer();
        } catch (err) {
          console.warn("Gagal refresh data barang:", err);
        }

        resetTransaksi();
        if (receiptAfterSave) bukaModalStruk(receiptAfterSave);
      } catch (err) {
        console.error(err);
        alert("Terjadi error jaringan/server saat menyimpan.");
      } finally {
        saving = false;
        if (btnSimpan) btnSimpan.textContent = "Simpan";
      }
    }

    function bindReceiptEvents() {
      btnCetak?.addEventListener("click", async () => {
        if (isOnlineMode()) return;

        if (!detail.length) {
          alert("Belum ada item untuk dicetak.");
          return;
        }

        const total = calcTotalTransaksi();
        const bayar = normalizeNominal(elBayar?.value);

        if (bayar < total) {
          alert("Isi nominal bayar dulu sebelum cetak struk.");
          elBayar?.focus();
          return;
        }

        await simpanTransaksi();
      });

      btnSavePng?.addEventListener("click", async () => {
        try { await saveReceiptAsPng(); }
        catch (err) { console.error(err); alert("Gagal menyimpan PNG."); }
      });

      btnSavePdf?.addEventListener("click", async () => {
        try { await saveReceiptAsPdf(); }
        catch (err) { console.error(err); alert("Gagal menyimpan PDF."); }
      });

      btnPrintNow?.addEventListener("click", printReceiptNow);
    }

    function initIfNeeded() {
      if (inited) return;
      inited = true;

      ensureBarangSearchUI();
      hideBarangDropdown();

      if (!elNoJual?.value) setVal(elNoJual, genNota());
      if (!elTanggal?.value) setVal(elTanggal, todayISO());

      initBarangInputEvents();
      bindReceiptEvents();

      elJenisTransaksi?.addEventListener("change", () => {
        resetQrisState();
        applyModeUI();
      });

      elMetodeBayar?.addEventListener("change", () => {
        resetQrisState();
        applyModeUI();
      });

      elMarketplace?.addEventListener("change", () => {
        if (isOnlineMode()) getMarketplace();
      });

      preventNumberWheelChange(elQty);
      preventNumberWheelChange(elBayar);
      preventNumberStepKeys(elQty);
      preventNumberStepKeys(elBayar);

      elQty?.addEventListener("input", calcTotalItemField);
      btnTambah?.addEventListener("click", addItem);
      btnHapusSemuaItem?.addEventListener("click", removeAllItems);
      elBayar?.addEventListener("input", recalcKembali);
      btnBatal?.addEventListener("click", resetTransaksi);
      btnSimpan?.addEventListener("click", simpanTransaksi);
      btnBayarQris?.addEventListener("click", bayarQrisMidtrans);

      elQty?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addItem();
        }
      });

      resetTransaksi();
    }

    try {
      if (transaksiInlineMode || modalTransaksi) initIfNeeded();
    } catch (err) {
      console.error("Transaksi init safety error:", err);
    }

    window.addEventListener("load", preloadReceiptLibsNonBlocking, { once: true });
  });
})();

/* =========================================================
   TOGGLE TOPBAR TRANSAKSI
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("txNavToggle");
  if (!btn) return;

  document.body.classList.add("tx-nav-collapsed");

  function syncNavToggleText() {
    const collapsed = document.body.classList.contains("tx-nav-collapsed");
    btn.textContent = collapsed ? "Tampilkan Atas" : "Sembunyikan Atas";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.toggle("tx-nav-collapsed");
    syncNavToggleText();
  });

  syncNavToggleText();
});