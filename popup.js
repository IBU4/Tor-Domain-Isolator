"use strict";

let activeTabId = null;
let busy = false;
let canRotate = false;
const $ = id => document.getElementById(id);

function updateButtons() {
  $("rotateCurrent").disabled = busy || !canRotate;
  $("rotateAll").disabled = busy;
}

async function refreshStatus() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab.");
  activeTabId = tab.id;
  const status = await browser.runtime.sendMessage({ type: "status", tabId: activeTabId });
  if (!status?.ok) throw new Error(status?.error || "Background page unavailable.");
  $("socks").textContent = status.socks;
  $("site").textContent = status.site || "No web-site context";
  $("store").textContent = status.storeId || "Unknown";
  $("privacy").textContent = status.incognito ? "Private" : "Normal";
  $("token").textContent = status.tokenPrefix ? `${status.tokenPrefix}…` : "Not allocated";
  $("count").textContent = String(status.bucketCount);
  $("unattributed").textContent = String(status.unattributedRequests);
  $("errors").textContent = String(status.errorCount);
  $("privateWarning").hidden = status.privateAllowed;
  canRotate = status.canRotate;
  updateButtons();
}

async function runAction(action) {
  if (busy) return;
  busy = true;
  updateButtons();
  try {
    await action();
    await refreshStatus();
  } catch (error) {
    $("message").textContent = error.message;
  } finally {
    busy = false;
    updateButtons();
  }
}

$("rotateCurrent").addEventListener("click", () => runAction(async () => {
  const result = await browser.runtime.sendMessage({ type: "rotate-current", tabId: activeTabId });
  if (!result?.ok) throw new Error(result?.error || "Rotation failed.");
  $("message").textContent = result.reloaded
    ? `Rotated ${result.site}; reload requested.`
    : `Rotated ${result.site}; reload the tab manually.`;
}));

$("rotateAll").addEventListener("click", () => runAction(async () => {
  const result = await browser.runtime.sendMessage({ type: "rotate-all" });
  if (!result?.ok) throw new Error(result?.error || "Rotation failed.");
  $("message").textContent = "All tokens reset. Reload open tabs to replace their existing connections.";
}));

runAction(async () => {});
