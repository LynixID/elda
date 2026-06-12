(function () {
  const EYE = `
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path>
    <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"></path>
  `;

  const EYE_OFF = `
    <path d="M3 3l18 18"></path>
    <path d="M10.58 10.58A2 2 0 0 0 13.41 13.4"></path>
    <path d="M9.9 5.08A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4.1 5.06"></path>
    <path d="M6.2 6.2C3.6 8.1 2 12 2 12s3.5 7 10 7c1.1 0 2.1-.17 3-.48"></path>
  `;

  function setIcon(btn, shown) {
    const svg = btn.querySelector("svg");
    if (!svg) return;
    svg.innerHTML = shown ? EYE_OFF : EYE;
  }

  function setA11y(btn, shown) {
    btn.setAttribute("aria-label", shown ? "Sembunyikan password" : "Tampilkan password");
    btn.setAttribute("aria-pressed", shown ? "true" : "false");
  }

  function toggle(btn) {
    const targetId = btn.getAttribute("data-target");
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const shown = input.type === "password";
    input.type = shown ? "text" : "password";

    setA11y(btn, shown);
    setIcon(btn, shown);

    btn.classList.toggle("is-on", shown);
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".pw-toggle");
    if (!btn) return;
    e.preventDefault();
    toggle(btn);
  });

  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    setA11y(btn, false);
    setIcon(btn, false);
    btn.classList.remove("is-on");
  });
})();
