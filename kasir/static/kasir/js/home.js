/* static/kasir/js/home.js */
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    const mq = window.matchMedia("(max-width: 820px)");
    const isMobile = () => mq.matches;

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    /* =========================================================
       ACCOUNT DROPDOWN + MODAL AKUN
    ========================================================= */
    const account = qs("[data-account]");
    const accountBtn = qs("[data-account-btn]");
    const accountPop = qs("[data-account-pop]");

    function closeAccount() {
      if (!account || !accountBtn) return;
      account.classList.remove("open");
      accountBtn.setAttribute("aria-expanded", "false");
    }

    function openAccount() {
      if (!account || !accountBtn) return;
      account.classList.add("open");
      accountBtn.setAttribute("aria-expanded", "true");
    }

    function toggleAccount() {
      if (!account) return;
      if (account.classList.contains("open")) closeAccount();
      else openAccount();
    }

    function openHomeModal(modal) {
      if (!modal) return;
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeHomeModal(modal) {
      if (!modal) return;
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");

      const masihAdaModalTerbuka = !!document.querySelector(".modal.show");
      if (!masihAdaModalTerbuka) {
        document.body.classList.remove("modal-open");
      }
    }

    function getAccountModalTarget(which) {
      const key = String(which || "").trim().toLowerCase();

      if (key === "edit") {
        return qs("#modal-edit");
      }

      if (key === "tambah") {
        return qs("#modal-tambah");
      }

      return null;
    }

    (function initAccountDropdown() {
      if (!account || !accountBtn || !accountPop) return;
      if (account.dataset.bound === "1") return;
      account.dataset.bound = "1";

      accountBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAccount();
      });

      accountPop.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      qsa("[data-open-modal]", accountPop).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const which = btn.getAttribute("data-open-modal");
          const modal = getAccountModalTarget(which);

          closeAccount();
          openHomeModal(modal);
        });
      });

      qsa("[data-modal-close]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const modal = btn.closest(".modal");
          closeHomeModal(modal);
        });
      });

      qsa(".modal").forEach((modal) => {
        modal.addEventListener("mousedown", (e) => {
          if (e.target === modal) {
            closeHomeModal(modal);
          }
        });
      });
    })();
    /* =========================================================
       NAVBAR DROPDOWN
    ========================================================= */
    const navDropdowns = qsa(".nav-dropdown");

    function closeAllNavDropdowns(except = null) {
      navDropdowns.forEach((drop) => {
        if (except && drop === except) return;
        drop.classList.remove("open");

        const btn = qs(".nav-toggle", drop);
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    (function initNavbarDropdown() {
      if (!navDropdowns.length) return;

      navDropdowns.forEach((drop) => {
        const btn = qs(".nav-toggle", drop);
        if (!btn) return;

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const willOpen = !drop.classList.contains("open");
          closeAllNavDropdowns(drop);

          if (willOpen) {
            drop.classList.add("open");
            btn.setAttribute("aria-expanded", "true");
          } else {
            drop.classList.remove("open");
            btn.setAttribute("aria-expanded", "false");
          }
        });
      });
    })();

    /* =========================================================
       SIDEBAR (HALAMAN LAIN YANG MASIH PAKAI SIDEBAR)
    ========================================================= */
    const btnOpen = qs("[data-sidebar-open]");
    const sidebarOverlay = qs("[data-sidebar-overlay]");
    const sidebarMenuLinks = qsa(".menu .menu-item");
    const LS_KEY = "ha_sidebar_desktop";

    const hasSidebar = !!(btnOpen || sidebarOverlay || sidebarMenuLinks.length);

    const setDesktopCollapsed = (collapsed) => {
      body.classList.toggle("sidebar-collapsed", !!collapsed);
      try {
        localStorage.setItem(LS_KEY, collapsed ? "collapsed" : "expanded");
      } catch (_) {}
    };

    const restoreDesktopSidebar = () => {
      if (!hasSidebar || isMobile()) return;
      let saved = null;
      try {
        saved = localStorage.getItem(LS_KEY);
      } catch (_) {}
      setDesktopCollapsed(saved === "collapsed");
    };

    const closeMobile = () => body.classList.remove("sidebar-open");

    /* =========================================================
       TOOLTIP SIDEBAR
    ========================================================= */
    let tooltip = null;
    let tooltipTarget = null;

    function ensureTooltip() {
      if (tooltip) return tooltip;
      qsa(".ha-tooltip").forEach((el) => el.remove());

      tooltip = document.createElement("div");
      tooltip.className = "ha-tooltip";
      tooltip.setAttribute("aria-hidden", "true");
      document.body.appendChild(tooltip);
      return tooltip;
    }

    function shouldShowTooltip() {
      return hasSidebar && !isMobile() && body.classList.contains("sidebar-collapsed");
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.classList.remove("show");
      tooltip.textContent = "";
      tooltipTarget = null;
      tooltip.style.left = "-9999px";
      tooltip.style.top = "-9999px";
    }

    function positionTooltip(el) {
      if (!tooltip || !el || !tooltip.classList.contains("show")) return;

      const rect = el.getBoundingClientRect();
      const gap = 12;
      const pad = 8;

      let left = rect.right + gap;
      let top = rect.top + rect.height / 2;

      const ttRect = tooltip.getBoundingClientRect();

      if (left + ttRect.width + pad > window.innerWidth) {
        left = rect.left - gap - ttRect.width;
      }

      if (top - ttRect.height / 2 < pad) {
        top = pad + ttRect.height / 2;
      }

      if (top + ttRect.height / 2 > window.innerHeight - pad) {
        top = window.innerHeight - pad - ttRect.height / 2;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function showTooltipFor(el) {
      if (!hasSidebar) return;
      ensureTooltip();
      hideTooltip();

      if (!el || !shouldShowTooltip()) return;

      const txt = (el.getAttribute("data-tooltip") || "").trim();
      if (!txt) return;

      tooltip.textContent = txt;
      tooltip.classList.add("show");
      tooltipTarget = el;

      requestAnimationFrame(() => {
        positionTooltip(el);
      });
    }

    /* =========================================================
       SIDEBAR TOGGLE
    ========================================================= */
    const toggleSidebar = () => {
      hideTooltip();

      if (isMobile()) {
        body.classList.toggle("sidebar-open");
      } else {
        setDesktopCollapsed(!body.classList.contains("sidebar-collapsed"));
      }
    };

    if (btnOpen) {
      btnOpen.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener("click", () => {
        closeMobile();
        hideTooltip();
      });
    }

    /* =========================================================
       ACTIVE LINK - SIDEBAR + NAVBAR
    ========================================================= */
    function normalizePath(path) {
      const fixed = (path || "").replace(/\/+$/, "");
      return fixed ? `${fixed}/` : "/";
    }

    function markActiveLinks() {
      const currentPath = normalizePath(window.location.pathname);

      // sidebar lama
      sidebarMenuLinks.forEach((a) => {
        const href = (a.getAttribute("href") || "").trim();
        if (!href || href === "#") return;

        try {
          const tmp = document.createElement("a");
          tmp.href = href;
          const hrefPath = normalizePath(tmp.pathname);

          if (hrefPath !== "/" && currentPath.includes(hrefPath)) {
            sidebarMenuLinks.forEach((x) => x.classList.remove("active"));
            a.classList.add("active");
          }
        } catch (_) {}
      });

      // reset active navbar
      qsa(".nav-menu .nav-link").forEach((el) => el.classList.remove("active"));
      qsa(".nav-menu .nav-toggle").forEach((el) => el.classList.remove("active"));

      // link navbar langsung
      const directNavLinks = qsa(".nav-menu > a.nav-link[href]");
      directNavLinks.forEach((a) => {
        const href = (a.getAttribute("href") || "").trim();
        if (!href || href === "#") return;

        try {
          const tmp = document.createElement("a");
          tmp.href = href;
          const hrefPath = normalizePath(tmp.pathname);

          if (currentPath === hrefPath) {
            a.classList.add("active");
          }
        } catch (_) {}
      });

      // item dropdown
      const dropdownItems = qsa(".nav-dropdown-item[href]");
      dropdownItems.forEach((a) => {
        const href = (a.getAttribute("href") || "").trim();
        if (!href || href === "#") return;

        try {
          const tmp = document.createElement("a");
          tmp.href = href;
          const hrefPath = normalizePath(tmp.pathname);

          if (currentPath === hrefPath || (hrefPath !== "/" && currentPath.startsWith(hrefPath))) {
            const parentDropdown = a.closest(".nav-dropdown");
            const toggle = parentDropdown ? qs(".nav-toggle", parentDropdown) : null;
            if (toggle) toggle.classList.add("active");
          }
        } catch (_) {}
      });
    }

    markActiveLinks();

    /* =========================================================
       SIDEBAR LINK EVENTS
    ========================================================= */
    sidebarMenuLinks.forEach((a) => {
      a.removeAttribute("title");

      const label = a.querySelector(".label");
      const txt = (label ? label.textContent : "").trim();
      if (txt) a.setAttribute("data-tooltip", txt);

      a.addEventListener("mouseenter", () => showTooltipFor(a));
      a.addEventListener("mousemove", () => {
        if (tooltipTarget === a) positionTooltip(a);
      });
      a.addEventListener("mouseleave", hideTooltip);
      a.addEventListener("focus", () => showTooltipFor(a));
      a.addEventListener("blur", hideTooltip);

      a.addEventListener("pointerdown", () => {
        hideTooltip();
        body.classList.add("nav-switching");
      });

      a.addEventListener("click", (e) => {
        hideTooltip();

        const href = (a.getAttribute("href") || "").trim();

        if (href === "#") {
          e.preventDefault();
          body.classList.remove("nav-switching");
          return;
        }

        if (!href) {
          body.classList.remove("nav-switching");
          return;
        }

        if (isMobile()) {
          body.classList.remove("sidebar-open");
        }
      });
    });

    /* =========================================================
       NAVBAR LINK EVENTS
    ========================================================= */
    const navCloseItems = qsa(".nav-menu > a.nav-link[href], .nav-dropdown-item[href]");

    navCloseItems.forEach((a) => {
      a.addEventListener("pointerdown", () => {
        body.classList.add("nav-switching");
      });

      a.addEventListener("click", () => {
        closeAllNavDropdowns();
      });
    });

    /* =========================================================
       GLOBAL CLICK / ESC
    ========================================================= */
    document.addEventListener("click", (e) => {
      if (account && !account.contains(e.target)) {
        closeAccount();
      }

      navDropdowns.forEach((drop) => {
        if (!drop.contains(e.target)) {
          drop.classList.remove("open");
          const btn = qs(".nav-toggle", drop);
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      hideTooltip();
      closeMobile();
      closeAccount();
      closeAllNavDropdowns();
    });

    /* =========================================================
       PAGE / WINDOW EVENTS
    ========================================================= */
    window.addEventListener("pageshow", () => {
      body.classList.remove("nav-switching");
    });

    window.addEventListener("beforeunload", () => {
      body.classList.add("nav-switching");
    });

    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip, { passive: true });

    const handleBreakpointChange = () => {
      hideTooltip();
      closeAllNavDropdowns();
      closeAccount();

      if (isMobile()) {
        closeMobile();
        if (hasSidebar) body.classList.remove("sidebar-collapsed");
      } else {
        closeMobile();
        restoreDesktopSidebar();
      }
    };

    if (mq.addEventListener) mq.addEventListener("change", handleBreakpointChange);
    else mq.addListener(handleBreakpointChange);

    /* =========================================================
       TOMBOL REKOMENDASI
    ========================================================= */
    const btnBuatRekomendasi = qs("#btnBuatRekomendasi");

    if (btnBuatRekomendasi) {
      btnBuatRekomendasi.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTooltip();
        window.location.href = "/rekomendasi/";
      });
    }

    /* =========================================================
       INIT
    ========================================================= */
    restoreDesktopSidebar();
    hideTooltip();
    closeAllNavDropdowns();
  });
})();

/* =========================================================
   FIX PAKSA ACCOUNT DROPDOWN HOME
   TEMPEL PALING BAWAH home.js
========================================================= */
document.addEventListener("DOMContentLoaded", function () {
  const account = document.querySelector("[data-account]");
  const accountBtn = document.querySelector("[data-account-btn]");
  const accountPop = document.querySelector("[data-account-pop]");

  if (!account || !accountBtn || !accountPop) {
    console.warn("Account dropdown element tidak lengkap.");
    return;
  }

  function bukaAkun() {
    account.classList.add("open");
    account.classList.add("force-open");
    accountBtn.setAttribute("aria-expanded", "true");
  }

  function tutupAkun() {
    account.classList.remove("open");
    account.classList.remove("force-open");
    accountBtn.setAttribute("aria-expanded", "false");
  }

  function toggleAkun(e) {
    e.preventDefault();
    e.stopPropagation();

    if (account.classList.contains("open") || account.classList.contains("force-open")) {
      tutupAkun();
    } else {
      bukaAkun();
    }
  }

  accountBtn.onclick = toggleAkun;

  accountPop.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", function (e) {
    if (!account.contains(e.target)) {
      tutupAkun();
    }
  });

  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const target = btn.getAttribute("data-open-modal");
      let modal = null;

      if (target === "edit") {
        modal = document.querySelector("#modal-edit");
      }

      if (target === "tambah") {
        modal = document.querySelector("#modal-tambah");
      }

      tutupAkun();

      if (modal) {
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
      }
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      const modal = btn.closest(".modal");
      if (modal) {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
      }

      if (!document.querySelector(".modal.show")) {
        document.body.classList.remove("modal-open");
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const navbar = document.querySelector(".main-navbar");
  const menuBtn = document.querySelector("[data-mobile-menu-btn]");

  if (!navbar || !menuBtn) return;

  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();

    const isOpen = navbar.classList.toggle("mobile-menu-open");
    menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", function (e) {
    if (!navbar.contains(e.target)) {
      navbar.classList.remove("mobile-menu-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
});