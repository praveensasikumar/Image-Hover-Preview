const domainEl = document.getElementById("domain");
const statusEl = document.getElementById("status");
const toggle = document.getElementById("power");

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0];
  const url = new URL(tab.url);
  domainEl.textContent = url.hostname.replace(/^www\./, "");

  // Get current status
  chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, response => {
    if (chrome.runtime.lastError || response === undefined) {
      statusEl.textContent = "Not loaded on this page";
      toggle.disabled = true;
      return;
    }
    const disabled = response.disabled;
    toggle.checked = !disabled;
    statusEl.innerHTML = disabled
      ? '<span class="off">OFF</span> – Disabled on this site'
      : '<span class="on">ON</span> – Hover preview active';
  });

  // Toggle
  toggle.onchange = () => {
    chrome.tabs.sendMessage(tab.id, { action: "toggleSite" }, () => {
      const nowDisabled = !toggle.checked;
      statusEl.innerHTML = nowDisabled
        ? '<span class="off">OFF</span> – Disabled on this site'
        : '<span class="on">ON</span> – Hover preview active';
    });
  };
});