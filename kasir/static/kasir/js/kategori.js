(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const qs = (s, r = document) => (r ? r.querySelector(s) : null);
    const qsa = (s, r = document) => (r ? Array.from(r.querySelectorAll(s)) : []);

    const IS_PEMILIK =
      String(document.body?.dataset?.role || "").trim().toLowerCase() === "pemilik";

    const elSearch = qs("#kategoriSearch");
    const elTbody = qs("#kategoriTable tbody");

    const btnTambah = qs("#kategoriTambah");
    const btnDeleteAll = qs("#kategoriDeleteAll");

    const backdrop = qs("#kategori-editor-backdrop");
    const form = qs("#kategoriEditorForm");
    const editorTitle = qs("#kategoriEditorTitle");
    const saveBtn = qs("#kategoriSaveBtn");

    const inputId = qs("#kategoriId");
    const inputNama = qs("#kategoriNama");
    const previewNama = qs("#kategoriNamaPreview");
    const previewPrefix = qs("#kategoriPrefixPreview");

    let KATEGORI = [];
    let editorMode = "create";
    let currentKategori = null;
    let submitting = false;

    function normalizeText(v) {
      return String(v || "").trim();
    }

    function normalizeKategori(v) {
      return String(v || "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeKategoriSaatKetik(v) {
      return String(v || "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .replace(/\s{2,}/g, " ");
    }

    function notifyKategoriChanged() {
      try {
        localStorage.setItem("kategori_updated", String(Date.now()));
      } catch (_) {}
    }

    function toInt(v, fallback = 0) {
      const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
      return Number.isFinite(n) ? n : fallback;
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
        return {
          ok: false,
          msg: text || "Response server bukan JSON.",
        };
      }
    }

    function getEndpoint(name) {
      const map = {
        json: window.KATEGORI_JSON_URL,
        create: window.KATEGORI_CREATE_URL,
        edit: window.KATEGORI_EDIT_URL,
        delete: window.KATEGORI_DELETE_URL,
        deleteAll: window.KATEGORI_DELETE_ALL_URL,
      };

      return String(map[name] || "").trim();
    }

    function prefixKategori(nama) {
      const clean = normalizeKategori(nama);

      const prefixMap = {
        FUNGISIDA: "FNG",
        HERBISIDA: "HRB",
        INSEKTISIDA: "INS",
        "NUTRISI DAN ZPT": "NUT",
        PUPUK: "PPK",
      };

      if (prefixMap[clean]) return prefixMap[clean];

      const letters = clean.replace(/[^A-Z0-9]/g, "");

      if (letters.length >= 3) return letters.slice(0, 3);
      if (letters.length > 0) return letters.padEnd(3, "X").slice(0, 3);

      return "KTG";
    }

    function normalizeKategoriObj(raw) {
      const nama = normalizeKategori(
        raw?.nama_kategori ||
        raw?.nama ||
        raw?.jenis_barang ||
        ""
      );

      const kodeKategori = normalizeText(
        raw?.kode_kategori ||
        raw?.prefix ||
        raw?.kode ||
        prefixKategori(nama)
      );

      return {
        id_kategori: toInt(raw?.id_kategori || raw?.id || 0),
        nama_kategori: nama,
        prefix: kodeKategori,
        kode_kategori: kodeKategori,
        jumlah_barang: toInt(raw?.jumlah_barang || raw?.total_barang || 0),
      };
    }

    function initKategoriTopbarToggle() {
      const btn =
        document.querySelector("#kategoriNavToggle") ||
        document.querySelector("#btnToggleTopKategori") ||
        document.querySelector(".kategori-nav-toggle");

      if (!btn) return;

      document.body.classList.add("kategori-nav-collapsed");

      function syncButton() {
        const collapsed = document.body.classList.contains("kategori-nav-collapsed");
        btn.textContent = collapsed ? "Tampilkan Atas" : "Sembunyikan Atas";
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }

      btn.addEventListener("click", function () {
        document.body.classList.toggle("kategori-nav-collapsed");
        syncButton();
      });

      syncButton();
    }

    function initKategoriDropdownTopbar() {
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

    async function reloadKategoriFromServer() {
      const url = getEndpoint("json");

      if (!url) {
        throw new Error("Endpoint JSON kategori belum tersedia.");
      }

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal memuat data kategori.");
      }

      KATEGORI = Array.isArray(data.data)
        ? data.data.map(normalizeKategoriObj)
        : [];

      renderKategoriTable();
    }

    function getFilteredKategori() {
      const q = normalizeText(elSearch?.value || "").toLowerCase();

      return KATEGORI.filter((k) => {
        const hay = [
          k.id_kategori,
          k.nama_kategori,
          k.prefix,
          k.jumlah_barang,
        ]
          .join(" ")
          .toLowerCase();

        return !q || hay.includes(q);
      });
    }

    function makeIconEdit() {
      return `
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
    }

    function makeIconDelete() {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path
            d="M5 7h14"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M10 11v6M14 11v6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
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
    }

    function makeAksiCell(k) {
      const td = document.createElement("td");
      td.className = "tx-aksi-col";

      const wrap = document.createElement("div");
      wrap.className = "tx-aksi-wrap";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "tx-aksi-btn edit";
      btnEdit.setAttribute("title", "Edit");
      btnEdit.setAttribute("aria-label", `Edit ${k.nama_kategori || "kategori"}`);
      btnEdit.setAttribute("data-tooltip", "Edit");
      btnEdit.innerHTML = makeIconEdit();
      btnEdit.addEventListener("click", () => openEditorEdit(k));

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "tx-aksi-btn delete";
      btnDelete.setAttribute("title", "Hapus");
      btnDelete.setAttribute("aria-label", `Hapus ${k.nama_kategori || "kategori"}`);
      btnDelete.setAttribute("data-tooltip", "Hapus");
      btnDelete.innerHTML = makeIconDelete();
      btnDelete.addEventListener("click", async () => {
        try {
          await handleDeleteKategori(k);
        } catch (err) {
          console.error(err);
          alert(err.message || "Gagal hapus kategori.");
        }
      });

      wrap.appendChild(btnEdit);
      wrap.appendChild(btnDelete);
      td.appendChild(wrap);

      return td;
    }

    function renderKategoriTable() {
      if (!elTbody) return;

      const rows = getFilteredKategori();
      elTbody.innerHTML = "";

      if (!rows.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td colspan="${IS_PEMILIK ? 5 : 4}">
            Data kategori tidak ditemukan.
          </td>
        `;
        elTbody.appendChild(tr);
        return;
      }

      rows.forEach((k) => {
        const tr = document.createElement("tr");

        const tdId = document.createElement("td");
        tdId.textContent = k.id_kategori || "-";
        tr.appendChild(tdId);

        const tdNama = document.createElement("td");
        tdNama.textContent = k.nama_kategori || "-";
        tr.appendChild(tdNama);

        const tdPrefix = document.createElement("td");
        tdPrefix.textContent = k.prefix || prefixKategori(k.nama_kategori) || "-";
        tr.appendChild(tdPrefix);

        const tdJumlah = document.createElement("td");
        tdJumlah.textContent = String(k.jumlah_barang || 0);
        tr.appendChild(tdJumlah);

        if (IS_PEMILIK) {
          tr.appendChild(makeAksiCell(k));
        }

        elTbody.appendChild(tr);
      });
    }

    function setEditorMode(mode) {
      editorMode = mode === "edit" ? "edit" : "create";

      if (editorTitle) {
        editorTitle.textContent =
          editorMode === "edit" ? "Edit Kategori" : "Tambah Kategori";
      }

      if (saveBtn) {
        saveBtn.textContent =
          editorMode === "edit" ? "Simpan Perubahan" : "Simpan Kategori";
      }
    }

    function refreshPreview() {
      const rawNama = normalizeKategoriSaatKetik(inputNama?.value || "");

      if (inputNama && inputNama.value !== rawNama) {
        const posisi = inputNama.selectionStart || rawNama.length;
        const sebelum = inputNama.value || "";

        inputNama.value = rawNama;

        const selisih = sebelum.length - rawNama.length;
        const posisiBaru = Math.max(0, posisi - selisih);

        inputNama.setSelectionRange(posisiBaru, posisiBaru);
      }

      const namaFinal = normalizeKategori(rawNama);

      if (previewNama) previewNama.textContent = namaFinal || "-";
      if (previewPrefix) previewPrefix.textContent = prefixKategori(namaFinal);
    }

    function openEditorCreate() {
      if (!IS_PEMILIK || !backdrop) return;

      currentKategori = null;
      setEditorMode("create");

      if (inputId) inputId.value = "";
      if (inputNama) inputNama.value = "";

      refreshPreview();

      backdrop.classList.add("show");
      document.body.classList.add("modal-open");

      setTimeout(() => inputNama?.focus(), 50);
    }

    function openEditorEdit(k) {
      if (!IS_PEMILIK || !backdrop) return;

      currentKategori = normalizeKategoriObj(k);
      setEditorMode("edit");

      if (inputId) inputId.value = currentKategori.id_kategori || "";
      if (inputNama) inputNama.value = currentKategori.nama_kategori || "";

      refreshPreview();

      backdrop.classList.add("show");
      document.body.classList.add("modal-open");

      setTimeout(() => inputNama?.focus(), 50);
    }

    function closeEditor() {
      if (!backdrop || !backdrop.classList.contains("show")) return false;

      backdrop.classList.remove("show");
      document.body.classList.remove("modal-open");

      currentKategori = null;
      setEditorMode("create");

      return true;
    }

    async function submitCreateKategori(payload) {
      const url = String(window.KATEGORI_CREATE_URL || "").trim();

      if (!url) {
        throw new Error("Endpoint tambah kategori belum tersedia.");
      }

      const res = await fetch(url, {
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
        throw new Error(data.msg || "Gagal tambah kategori.");
      }

      alert(data.msg || "Kategori berhasil ditambahkan.");
      return data;
    }

    async function submitEditKategori(payload) {
      const url = String(window.KATEGORI_EDIT_URL || "").trim();

      if (!url) {
        throw new Error("Endpoint edit kategori belum tersedia.");
      }

      const res = await fetch(url, {
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
        throw new Error(data.msg || "Gagal edit kategori.");
      }

      alert(data.msg || "Kategori berhasil diperbarui.");
      return data;
    }

    async function handleDeleteKategori(k) {
      if (!IS_PEMILIK) return;

      const url = getEndpoint("delete");

      if (!url) {
        throw new Error("Endpoint hapus kategori belum tersedia.");
      }

      const jumlahBarang = Number(k.jumlah_barang || 0);

      let pesan = `Hapus kategori ${k.nama_kategori}?`;

      if (jumlahBarang > 0) {
        pesan =
          `Kategori ${k.nama_kategori} masih dipakai oleh ${jumlahBarang} barang.\n` +
          `Biasanya kategori yang masih dipakai tidak bisa dihapus.\n\n` +
          `Tetap coba hapus?`;
      }

      const ok = confirm(pesan);
      if (!ok) return;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id_kategori: k.id_kategori,
          nama_kategori: k.nama_kategori,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal hapus kategori.");
      }

      alert(data.msg || "Kategori berhasil dihapus.");
      await reloadKategoriFromServer();
      notifyKategoriChanged();
    }

    async function handleDeleteAllKategori() {
      if (!IS_PEMILIK) return;

      if (!KATEGORI.length) {
        alert("Data kategori sudah kosong.");
        return;
      }

      const dipakai = KATEGORI.filter((k) => Number(k.jumlah_barang || 0) > 0);

      let pesan = "Yakin ingin menghapus semua kategori?";

      if (dipakai.length) {
        pesan =
          "Ada kategori yang masih dipakai oleh Data Barang.\n" +
          "Biasanya kategori tersebut tidak bisa dihapus sebelum barangnya dipindahkan/diedit.\n\n" +
          "Tetap coba hapus semua kategori?";
      }

      const ok = confirm(pesan);
      if (!ok) return;

      const url = getEndpoint("deleteAll");

      if (!url) {
        throw new Error("Endpoint hapus semua kategori belum tersedia.");
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.msg || "Gagal hapus semua kategori.");
      }

      alert(data.msg || "Semua kategori berhasil dihapus.");
      await reloadKategoriFromServer();
      notifyKategoriChanged();
    }

    function bindEditor() {
      if (!IS_PEMILIK || !backdrop || !form) return;

      backdrop.addEventListener("mousedown", (e) => {
        const card = qs(".kategori-editor-card", backdrop);
        if (card && !card.contains(e.target)) closeEditor();
      });

      qsa("[data-kategori-editor-close]", backdrop).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          closeEditor();
        });
      });

      inputNama?.addEventListener("input", refreshPreview);
      inputNama?.addEventListener("blur", refreshPreview);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (submitting) return;

        const nama = normalizeKategori(inputNama?.value || "");

        if (!nama) {
          alert("Nama kategori wajib diisi.");
          inputNama?.focus();
          return;
        }

        const payload = {
          id_kategori: toInt(inputId?.value || currentKategori?.id_kategori || 0),
          nama_kategori: nama,
          kode_kategori: prefixKategori(nama),
        };

        try {
          submitting = true;

          if (saveBtn) saveBtn.textContent = "Menyimpan...";

          let result;

          if (editorMode === "edit") {
            result = await submitEditKategori(payload);
          } else {
            result = await submitCreateKategori(payload);
          }

          const dataBaru = normalizeKategoriObj(
            result?.data || {
              id_kategori: payload.id_kategori,
              nama_kategori: payload.nama_kategori,
              kode_kategori: prefixKategori(payload.nama_kategori),
              jumlah_barang: currentKategori?.jumlah_barang || 0,
            }
          );

          if (editorMode === "edit") {
            const idx = KATEGORI.findIndex(
              (x) => Number(x.id_kategori) === Number(dataBaru.id_kategori)
            );

            if (idx >= 0) {
              KATEGORI[idx] = dataBaru;
            } else {
              KATEGORI.push(dataBaru);
            }
          } else {
            KATEGORI.push(dataBaru);
          }

          renderKategoriTable();
          closeEditor();

          try {
            await reloadKategoriFromServer();
          } catch (syncErr) {
            console.warn(
              "Sinkron kategori gagal, tapi tampilan lokal sudah diperbarui:",
              syncErr
            );
          }

          notifyKategoriChanged();

        } catch (err) {
          console.error(err);
          alert(err.message || "Gagal menyimpan kategori.");
        } finally {
          submitting = false;

          if (saveBtn) {
            saveBtn.textContent =
              editorMode === "edit" ? "Simpan Perubahan" : "Simpan Kategori";
          }
        }
      });
    }

    function bindPageActions() {
      elSearch?.addEventListener("input", renderKategoriTable);

      if (IS_PEMILIK) {
        btnTambah?.addEventListener("click", openEditorCreate);

        btnDeleteAll?.addEventListener("click", async () => {
          try {
            await handleDeleteAllKategori();
          } catch (err) {
            console.error(err);
            alert(err.message || "Gagal hapus semua kategori.");
          }
        });

        bindEditor();
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeEditor();
      });
    }

    async function init() {
      initKategoriTopbarToggle();
      initKategoriDropdownTopbar();
      bindPageActions();

      try {
        await reloadKategoriFromServer();
      } catch (err) {
        console.error("Init Data Kategori error:", err);

        if (elTbody) {
          elTbody.innerHTML = `
            <tr>
              <td colspan="${IS_PEMILIK ? 5 : 4}">
                Gagal memuat data kategori. ${escapeHtml(err.message || "")}
              </td>
            </tr>
          `;
        }
      }
    }

    init();
  });
})();