/* static/kasir/js/akun.js */
(function () {
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    const qs = (s, r = document) => r.querySelector(s);
    const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
    const body = document.body;

    // ===== AKUN DROPDOWN =====
    const account = qs("[data-account]");
    const accountBtn = qs("[data-account-btn]");
    const accountPop = qs("[data-account-pop]");

    // ===== MODAL =====
    const modalEdit = qs("#modal-edit");
    const modalTambah = qs("#modal-tambah");
    const modalCrop = qs("#modal-crop");

    // ===== CROP ELEMENT =====
    const cropImage = qs("#cropImage");
    const cropSaveBtn = qs("#cropSaveBtn");
    const cropCancelBtn = qs("#cropCancelBtn");
    const cropCloseBtn = qs("#cropCloseBtn");

    // ===== FORM EDIT =====
    const formEdit = modalEdit ? qs("form", modalEdit) : null;
    const inputFoto = qs("#apFoto");
    const hapusFotoInput = qs("#apHapusFoto");
    const hapusFotoBtn = qs("#apHapusFotoBtn");
    const croppedReadyInput = qs("#apFotoCroppedReady");

    if (!account && !modalEdit && !modalTambah && !modalCrop) return;

    let cropper = null;
    let previewObjectUrl = null;
    let isSubmittingEdit = false;

    function isShown(el) {
      return !!el && el.classList.contains("show");
    }

    function syncBodyLock() {
      const anyOpen =
        isShown(modalEdit) ||
        isShown(modalTambah) ||
        isShown(modalCrop);

      body.classList.toggle("modal-open", anyOpen);
    }

    function setAccountHiddenState(hidden) {
      if (!accountPop) return;

      accountPop.hidden = hidden;
      accountPop.setAttribute("aria-hidden", hidden ? "true" : "false");

      if ("inert" in accountPop) {
        accountPop.inert = hidden;
      }

      accountPop.style.display = hidden ? "none" : "block";
      accountPop.style.pointerEvents = hidden ? "none" : "auto";
      accountPop.style.visibility = hidden ? "hidden" : "visible";
      accountPop.style.opacity = hidden ? "0" : "1";
    }

    function openAccount() {
      if (!account || !accountBtn || !accountPop) return;
      account.classList.add("open");
      accountBtn.setAttribute("aria-expanded", "true");
      setAccountHiddenState(false);
    }

    function closeAccount() {
      if (!account || !accountBtn || !accountPop) return;
      account.classList.remove("open");
      accountBtn.setAttribute("aria-expanded", "false");
      setAccountHiddenState(true);
    }

    function toggleAccount() {
      if (!account) return;
      if (account.classList.contains("open")) {
        closeAccount();
      } else {
        openAccount();
      }
    }

    function openModal(modal) {
      if (!modal) return;
      closeAccount();
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      syncBodyLock();
    }

    function closeModal(modal) {
      if (!modal) return;
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      syncBodyLock();
    }

    function getPreviewEl() {
      return qs("#apAvatarPreview");
    }

    function setPreviewImage(src) {
      const preview = getPreviewEl();
      if (!preview || !src) return;

      if (preview.tagName && preview.tagName.toLowerCase() === "img") {
        preview.src = src;
      } else {
        const img = document.createElement("img");
        img.id = "apAvatarPreview";
        img.className = "ap-avatarImg";
        img.alt = "Preview Foto Profil";
        img.src = src;
        preview.replaceWith(img);
      }
    }

    function setPreviewPlaceholder() {
      const preview = getPreviewEl();
      if (!preview) return;

      const ph = document.createElement("div");
      ph.id = "apAvatarPreview";
      ph.className = "ap-avatarPlaceholder";
      ph.textContent = "👤";
      preview.replaceWith(ph);
    }

    function destroyCropper() {
      if (cropper) {
        try {
          cropper.destroy();
        } catch (_) {}
        cropper = null;
      }
    }

    function revokePreviewUrl() {
      if (previewObjectUrl) {
        try {
          URL.revokeObjectURL(previewObjectUrl);
        } catch (_) {}
        previewObjectUrl = null;
      }
    }

    function openCropModal() {
      if (!modalCrop) return;
      openModal(modalCrop);
    }

    function closeCropModal() {
      destroyCropper();
      if (cropImage) cropImage.src = "";
      closeModal(modalCrop);
    }

    // ===== FOTO YANG SEDANG DIPAKAI SAAT INI =====
    function readCommittedPreviewState() {
      const preview = getPreviewEl();
      if (!preview) {
        return { type: "placeholder", src: "" };
      }

      if (preview.tagName && preview.tagName.toLowerCase() === "img") {
        return {
          type: "img",
          src: preview.getAttribute("src") || preview.src || "",
        };
      }

      return { type: "placeholder", src: "" };
    }

    const committedPreviewState = readCommittedPreviewState();

    function applyCommittedPreviewState() {
      if (committedPreviewState.type === "img" && committedPreviewState.src) {
        setPreviewImage(committedPreviewState.src);
      } else {
        setPreviewPlaceholder();
      }
    }

    function restorePhotoStateToCommitted() {
      if (hapusFotoInput) hapusFotoInput.value = "0";
      if (croppedReadyInput) croppedReadyInput.value = "0";
      if (inputFoto) inputFoto.value = "";

      revokePreviewUrl();
      destroyCropper();

      if (cropImage) cropImage.src = "";

      applyCommittedPreviewState();
    }

    // kondisi awal dropdown benar-benar mati
    if (accountPop) {
      setAccountHiddenState(true);
    }

    // =========================================
    // DROPDOWN AKUN
    // =========================================
    if (accountBtn) {
      accountBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleAccount();
      });
    }

    if (accountPop) {
      accountPop.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    // tutup dropdown SEBELUM klik elemen lain diproses
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!account || !account.classList.contains("open")) return;

        const target = e.target;

        if (accountBtn && accountBtn.contains(target)) return;
        if (accountPop && accountPop.contains(target)) return;

        closeAccount();
      },
      true
    );

    // fallback tambahan
    document.addEventListener("click", function (e) {
      if (!account || !account.classList.contains("open")) return;
      const target = e.target;

      if (accountBtn && accountBtn.contains(target)) return;
      if (accountPop && accountPop.contains(target)) return;

      closeAccount();
    });

    // =========================================
    // BUKA MODAL DARI DROPDOWN
    // =========================================
    qsa("[data-account-pop] [data-open-modal]").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const which = (btn.getAttribute("data-open-modal") || "").trim();
        closeAccount();

        setTimeout(function () {
          if (which === "edit") {
            isSubmittingEdit = false;
            restorePhotoStateToCommitted();
            openModal(modalEdit);
          } else if (which === "tambah") {
            openModal(modalTambah);
          }
        }, 0);
      });
    });

    // =========================================
    // TUTUP MODAL DENGAN X
    // =========================================
    qsa("[data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const modal = btn.closest(".modal");

        if (modal === modalEdit && !isSubmittingEdit) {
          restorePhotoStateToCommitted();
        }

        closeModal(modal);
      });
    });

    [modalEdit, modalTambah].forEach((modal) => {
      if (!modal) return;

      modal.addEventListener("mousedown", function (e) {
        const card = qs(".modal-card", modal);
        if (card && !card.contains(e.target)) {
          if (modal === modalEdit && !isSubmittingEdit) {
            restorePhotoStateToCommitted();
          }
          closeModal(modal);
        }
      });
    });

    // =========================================
    // CROP FOTO MANUAL
    // =========================================
    if (inputFoto && cropImage && modalCrop) {
      inputFoto.addEventListener("change", function () {
        const file = inputFoto.files && inputFoto.files[0];
        if (!file) return;

        if (!file.type || !file.type.startsWith("image/")) {
          alert("File harus berupa gambar.");
          inputFoto.value = "";
          return;
        }

        if (!window.Cropper) {
          alert("Cropper belum termuat. Cek link CropperJS di HTML.");
          inputFoto.value = "";
          return;
        }

        if (hapusFotoInput) hapusFotoInput.value = "0";
        if (croppedReadyInput) croppedReadyInput.value = "0";

        const reader = new FileReader();
        reader.onload = function (ev) {
          const src = ev.target && ev.target.result;
          if (!src) return;

          destroyCropper();
          cropImage.src = src;
          openCropModal();

          setTimeout(function () {
            destroyCropper();

            cropper = new Cropper(cropImage, {
              aspectRatio: 1,
              viewMode: 1,
              dragMode: "move",
              autoCropArea: 1,
              restore: false,
              guides: true,
              center: true,
              highlight: true,
              background: false,
              movable: true,
              zoomable: true,
              rotatable: false,
              scalable: false,
              cropBoxMovable: false,
              cropBoxResizable: false,
              toggleDragModeOnDblclick: false,
              responsive: true,
              wheelZoomRatio: 0.1,
              minContainerWidth: 300,
              minContainerHeight: 300,
            });
          }, 80);
        };

        reader.readAsDataURL(file);
      });
    }

    if (cropSaveBtn && inputFoto) {
      cropSaveBtn.addEventListener("click", function () {
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas({
          width: 700,
          height: 700,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        });

        if (!canvas) return;

        canvas.toBlob(function (blob) {
          if (!blob) return;

          const croppedFile = new File([blob], "profile-cropped.jpg", {
            type: "image/jpeg",
          });

          const dt = new DataTransfer();
          dt.items.add(croppedFile);
          inputFoto.files = dt.files;

          if (croppedReadyInput) croppedReadyInput.value = "1";
          if (hapusFotoInput) hapusFotoInput.value = "0";

          revokePreviewUrl();
          previewObjectUrl = URL.createObjectURL(croppedFile);
          setPreviewImage(previewObjectUrl);

          closeCropModal();
        }, "image/jpeg", 0.95);
      });
    }

    if (cropCancelBtn) {
      cropCancelBtn.addEventListener("click", function () {
        if (inputFoto) inputFoto.value = "";
        if (croppedReadyInput) croppedReadyInput.value = "0";
        closeCropModal();
      });
    }

    if (cropCloseBtn) {
      cropCloseBtn.addEventListener("click", function () {
        if (inputFoto) inputFoto.value = "";
        if (croppedReadyInput) croppedReadyInput.value = "0";
        closeCropModal();
      });
    }

    if (modalCrop) {
      modalCrop.addEventListener("mousedown", function (e) {
        const card = qs(".modal-card", modalCrop);
        if (card && !card.contains(e.target)) {
          if (inputFoto) inputFoto.value = "";
          if (croppedReadyInput) croppedReadyInput.value = "0";
          closeCropModal();
        }
      });
    }

    // =========================================
    // HAPUS FOTO
    // =========================================
    if (hapusFotoBtn) {
      hapusFotoBtn.addEventListener("click", function () {
        if (hapusFotoInput) hapusFotoInput.value = "1";
        if (croppedReadyInput) croppedReadyInput.value = "0";
        if (inputFoto) inputFoto.value = "";

        revokePreviewUrl();
        destroyCropper();
        if (cropImage) cropImage.src = "";

        setPreviewPlaceholder();
      });
    }

    // =========================================
    // FORM EDIT
    // =========================================
    if (formEdit) {
      formEdit.addEventListener("reset", function () {
        isSubmittingEdit = false;
        setTimeout(function () {
          restorePhotoStateToCommitted();
        }, 0);
      });

      formEdit.addEventListener("submit", function () {
        isSubmittingEdit = true;

        if (hapusFotoInput && hapusFotoInput.value === "1" && inputFoto) {
          inputFoto.value = "";
        }
      });
    }

    // =========================================
    // ESC
    // =========================================
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;

      if (account && account.classList.contains("open")) {
        closeAccount();
        return;
      }

      if (isShown(modalCrop)) {
        if (inputFoto) inputFoto.value = "";
        if (croppedReadyInput) croppedReadyInput.value = "0";
        closeCropModal();
        return;
      }

      if (isShown(modalEdit)) {
        if (!isSubmittingEdit) {
          restorePhotoStateToCommitted();
        }
        closeModal(modalEdit);
        return;
      }

      if (isShown(modalTambah)) {
        closeModal(modalTambah);
      }
    });
  });
})();