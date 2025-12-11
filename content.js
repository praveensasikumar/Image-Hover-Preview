(() => {
  let hoverTimer = null;
  let overlay = null;
  let currentUrl = null;
  const DISABLED_SITES_KEY = "imgHoverDisabledSites";

  // Load disabled sites
  let disabledSites = {};
  try {
    const json = localStorage.getItem(DISABLED_SITES_KEY);
    disabledSites = json ? JSON.parse(json) : {};
  } catch (_) {}

  const currentDomain = location.hostname.replace(/^www\./, "");
  let isDisabled = !!disabledSites[currentDomain];

  // ──────────────────────────────────────────────────────────────
  // COMMUNICATION WITH POPUP – MUST BE REGISTERED EVEN IF DISABLED
  // ──────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // getStatus – works even on disabled sites
    if (msg.action === "getStatus") {
      sendResponse({ disabled: isDisabled });
      return true; // keep channel open for async response
    }

    // toggleSite – toggle + instant reload
    if (msg.action === "toggleSite") {
      disabledSites[currentDomain] = !disabledSites[currentDomain];
      localStorage.setItem(DISABLED_SITES_KEY, JSON.stringify(disabledSites));
      isDisabled = disabledSites[currentDomain];
      sendResponse({ disabled: isDisabled });
      location.reload(); // apply instantly
      return true;
    }
  });

  // If disabled → stop the hover preview (but messages still work!)
  if (isDisabled) return;

  // ────────────────────────
  // HOVER PREVIEW LOGIC
  // ────────────────────────
  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "img-hover-inspector";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", e => {
      if (e.target.closest(".ih-disable-toggle")) return;
      if (currentUrl) window.open(currentUrl, "_blank");
    });

    overlay.addEventListener("mouseenter", () => clearTimeout(hoverTimer));
    overlay.addEventListener("mouseleave", () => hoverTimer = setTimeout(hideOverlay, 300));
  }

  function showOverlay(info, x, y) {
    if (!overlay) createOverlay();
    currentUrl = info.url;

    let domain = "unknown";
    try { domain = new URL(info.url).hostname.replace(/^www\./, ""); } catch (_) {}

    overlay.innerHTML = `
      <div class="ih-top">
        <div class="ih-thumb"><img src="${info.url}" alt=""></div>
        <div class="ih-info">
          <div class="ih-domain">${domain}</div>
          <div class="ih-dim">${info.width} × ${info.height}</div>
        </div>
      </div>
      <div class="ih-actions">
        <div class="ih-click">Click to open full image</div>
        <div class="ih-disable-toggle">Disable on this site</div>
      </div>
    `;

    overlay.querySelector(".ih-disable-toggle").addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`Disable image hover preview on ${currentDomain}?\n\nRe-enable anytime by clicking the extension icon.`)) {
        disabledSites[currentDomain] = true;
        localStorage.setItem(DISABLED_SITES_KEY, JSON.stringify(disabledSites));
        overlay.innerHTML = `
          <div style="padding:16px;text-align:center;line-height:1.6;font-family:system-ui;color:white;">
            <div style="font-size:15px;margin-bottom:8px;">Disabled on ${currentDomain}</div>
            <div style="font-size:12px;opacity:0.8;">Click extension icon to turn back on</div>
          </div>
        `;
        setTimeout(() => { hideOverlay(); overlay.remove(); }, 3200);
      }
    });

    overlay.style.left = (x + 15) + "px";
    overlay.style.top = (y + 15) + "px";
    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("show"));
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove("show");
    setTimeout(() => {
      if (overlay && !overlay.matches(":hover")) {
        overlay.style.display = "none";
        currentUrl = null;
      }
    }, 250);
  }

  async function getInfo(url) {
    let w = "?", h = "?";
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      w = img.naturalWidth || img.width;
      h = img.naturalHeight || img.height;
    } catch (_) {}
    return { url, width: w, height: h };
  }

  function findImage(el) {
    for (let i = 0; i < 15; i++) {
      if (!el) return null;
      if (el.tagName === "IMG" && el.src) return el.currentSrc || el.src;
      const style = getComputedStyle(el);
      const bg = style.backgroundImage;
      if (bg && bg !== "none") {
        const m = bg.match(/url\(["']?(.*?)["']?\)/);
        if (m) return m[1];
      }
      const imgInside = el.querySelector("img");
      if (imgInside) return imgInside.currentSrc || imgInside.src;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener("click", e => {
    if (overlay && overlay.style.display === "flex" && !overlay.contains(e.target)) hideOverlay();
  });

  document.addEventListener("mouseover", e => {
    clearTimeout(hoverTimer);
    const url = findImage(e.target);
    if (url && url !== currentUrl) {
      hoverTimer = setTimeout(async () => {
        const info = await getInfo(url);
        showOverlay(info, e.pageX, e.pageY);
      }, 400);
    }
  });

  document.addEventListener("mouseout", e => {
    if (!e.relatedTarget || !overlay?.contains(e.relatedTarget)) {
      hoverTimer = setTimeout(hideOverlay, 300);
    }
  });
})();