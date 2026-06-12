(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    const qs = (s, r = document) => (r ? r.querySelector(s) : null);
    const qsa = (s, r = document) => (r ? Array.from(r.querySelectorAll(s)) : []);

    const canvas = qs("#pdChart");
    let chartInstance = null;

    /* =========================================================
       TOPBAR TOGGLE
    ========================================================= */

    const topbarToggleBtn = qs("[data-topbar-toggle]");

    function syncTopbarToggleText() {
      if (!topbarToggleBtn) return;

      const hidden = body.classList.contains("topbar-hidden");
      topbarToggleBtn.textContent = hidden ? "Tampilkan Atas" : "Sembunyikan Atas";
      topbarToggleBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
    }

    function closeAllDropdowns(except = null) {
      qsa(".nav-dropdown").forEach((dropdown) => {
        if (except && dropdown === except) return;

        dropdown.classList.remove("open");

        const btn = qs(".nav-toggle", dropdown);
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    if (topbarToggleBtn) {
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

    qsa(".nav-dropdown").forEach((dropdown) => {
      const toggle = qs(".nav-toggle", dropdown);
      const menu = qs(".nav-dropdown-menu", dropdown);

      if (!toggle || !menu) return;

      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const willOpen = !dropdown.classList.contains("open");

        closeAllDropdowns(dropdown);

        dropdown.classList.toggle("open", willOpen);
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });

      menu.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    });

    document.addEventListener("click", () => {
      closeAllDropdowns();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllDropdowns();
    });

    window.addEventListener("pageshow", () => {
      syncTopbarToggleText();
      closeAllDropdowns();
    });

    /* =========================================================
       CHART
    ========================================================= */

    function formatRp(n) {
      const num = Math.max(0, parseInt(n || 0, 10) || 0);
      return "Rp " + num.toLocaleString("id-ID");
    }

    function getDefaultLabels() {
      return ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    }

    function getDefaultValues() {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    function normalizeChartData() {
      const labels = Array.isArray(window.PD_LABELS) && window.PD_LABELS.length
        ? window.PD_LABELS.map((x) => String(x || "").trim()).filter(Boolean)
        : getDefaultLabels();

      const values = Array.isArray(window.PD_VALUES) && window.PD_VALUES.length
        ? window.PD_VALUES.map((x) => Number(x || 0))
        : getDefaultValues();

      if (!labels.length || !values.length || labels.length !== values.length) {
        return {
          labels: getDefaultLabels(),
          values: getDefaultValues(),
        };
      }

      return { labels, values };
    }

    function buildRenderData(labels, values) {
      if (labels.length === 1) {
        return {
          labels: ["", labels[0], ""],
          values: [null, values[0], null],
          singleMode: true,
        };
      }

      return {
        labels,
        values,
        singleMode: false,
      };
    }

    function getBarThickness(labelsCount, singleMode) {
      if (singleMode) return 70;
      if (labelsCount === 2) return 58;
      if (labelsCount === 3) return 50;
      if (labelsCount <= 6) return 42;
      if (labelsCount <= 10) return 34;
      return 28;
    }

    function renderChart(rawLabels, rawValues) {
      if (!canvas || typeof window.Chart === "undefined") return;

      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      const prepared = buildRenderData(rawLabels, rawValues);
      const labels = prepared.labels;
      const values = prepared.values;
      const singleMode = prepared.singleMode;

      const ctx = canvas.getContext("2d");
      const realValues = rawValues.filter((v) => Number(v || 0) > 0);
      const maxValue = realValues.length ? Math.max(...realValues) : 0;
      const barThickness = getBarThickness(rawLabels.length, singleMode);

      chartInstance = new Chart(ctx, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Pendapatan",
              data: values,
              backgroundColor: values.map((v) => (
                Number(v || 0) === maxValue && maxValue > 0 ? "#2f7224" : "#49783a"
              )),
              borderRadius: 10,
              borderSkipped: false,
              barThickness: barThickness,
              maxBarThickness: 70,
              categoryPercentage: 0.55,
              barPercentage: 0.72,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "Tren",
              data: values,
              hidden: singleMode,
              borderColor: "#2c63d6",
              backgroundColor: "#2c63d6",
              pointBackgroundColor: "#ffffff",
              pointBorderColor: "#2c63d6",
              pointBorderWidth: 2,
              pointRadius: singleMode ? 0 : 4,
              pointHoverRadius: singleMode ? 0 : 5,
              borderWidth: 3,
              tension: 0.25,
              fill: false,
              spanGaps: false,
              yAxisID: "y",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 650,
          },
          layout: {
            padding: {
              top: 8,
              right: 10,
              left: 8,
              bottom: 0,
            },
          },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: "#2f2f2f",
                boxWidth: 18,
                boxHeight: 10,
                font: {
                  size: 12,
                  weight: "700",
                },
                filter(legendItem, chartData) {
                  const ds = chartData.datasets[legendItem.datasetIndex];
                  return ds && ds.type !== "line";
                },
              },
            },
            tooltip: {
              filter(context) {
                return context.dataset.type !== "line" && context.raw !== null;
              },
              callbacks: {
                title(items) {
                  if (!items || !items.length) return "";
                  return String(items[0].label || "").trim();
                },
                label(context) {
                  return `Pendapatan: ${formatRp(context.parsed.y)}`;
                },
              },
            },
          },
          scales: {
            x: {
              offset: true,
              grid: {
                display: false,
              },
              ticks: {
                color: "rgba(0,0,0,0.62)",
                font: {
                  size: 12,
                  weight: "700",
                },
                callback(value, index) {
                  const label = labels[index];
                  return label ? label : "";
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(110,120,90,0.14)",
              },
              ticks: {
                color: "rgba(0,0,0,0.55)",
                font: {
                  size: 11,
                  weight: "700",
                },
                callback(value) {
                  return formatRp(value);
                },
              },
            },
          },
        },
      });
    }

    const { labels, values } = normalizeChartData();
    renderChart(labels, values);
  });
})();