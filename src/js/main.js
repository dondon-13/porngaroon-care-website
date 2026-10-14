// Mobile menu
(function () {
  var btn = document.querySelector(".menu-btn");
  var nav = document.getElementById("main-nav");
  if (!btn || !nav) return;
  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
})();

// Case photo carousel: 6 per slide on computers, swipe on phones
(function () {
  var root = document.querySelector("[data-carousel]");
  if (!root) return;
  var viewport = root.querySelector("[data-viewport]");
  var dotsBox = root.querySelector("[data-dots]");
  var count = root.querySelector("[data-count]");
  var GAP = 14;

  function step() { return viewport.clientWidth + GAP; }
  function pages() { return Math.max(1, Math.round((viewport.scrollWidth + GAP) / step())); }
  function current() { return Math.min(pages() - 1, Math.round(viewport.scrollLeft / step())); }
  function go(i) {
    var n = pages();
    i = (i + n) % n;
    viewport.scrollTo({ left: i * step(), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function render() {
    var n = pages(), c = current();
    count.textContent = (c + 1) + " / " + n;
    if (dotsBox.children.length !== n) {
      dotsBox.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "หน้า " + (i + 1));
        b.appendChild(document.createElement("span"));
        (function (idx) { b.addEventListener("click", function () { go(idx); }); })(i);
        dotsBox.appendChild(b);
      }
    }
    Array.prototype.forEach.call(dotsBox.children, function (b, i) {
      b.setAttribute("aria-current", i === c ? "true" : "false");
    });
    // Too many dots on phones: hide them, swiping + counter is enough
    dotsBox.style.display = n > 8 ? "none" : "";
  }

  root.querySelector("[data-prev]").addEventListener("click", function () { go(current() - 1); });
  root.querySelector("[data-next]").addEventListener("click", function () { go(current() + 1); });
  var t;
  viewport.addEventListener("scroll", function () { clearTimeout(t); t = setTimeout(render, 80); });
  window.addEventListener("resize", render);
  render();
})();
