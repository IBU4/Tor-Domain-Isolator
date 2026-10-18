/* Tor Domain Isolator (Local) — source and limitations are in README.md. */
"use strict";

const CONFIG = Object.freeze({
  socksHost: "127.0.0.1",
  socksPort: 9050,
  // Tor Browser keeps its catch-all circuit dirty for at most 10 minutes.
  catchAllRotationMs: 10 * 60 * 1000
});
const TOR_USERNAME = "<torS0X>0";
const buckets = new Map();
// Requests whose first-party owner cannot be proven share a short-lived catch-all
// per known Firefox context. This mirrors Tor Browser more closely than 0.1.1's
// per-request random token, which could make one page appear from many exits.
const catchAllBuckets = new Map();
let globalCatchAll = null;
const tabsById = new Map();
const removedDuringStartup = new Set();
let startupFinished = false;
let unattributedRequests = 0;
let errorCount = 0;

function randomToken128() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

// Preallocate entropy for the exception path. An internal routing error must not
// throw out of proxy.onRequest and cause Firefox to use its default/direct route.
// As with any startup failure, failure here requires the manual proxy baseline
// documented in README.md; an unloaded extension cannot enforce a policy.
const emergencyNonce = randomToken128();
let emergencyCounter = 0n;

function hostnameFromUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  try {
    let url = new URL(rawUrl);
    if (url.protocol === "blob:") url = new URL(url.origin);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/\.$/, "") || null;
  } catch (_) {
    return null;
  }
}

function validTabId(id) {
  return Number.isInteger(id) && id >= 0;
}

function rememberTab(tab, seedOnly = false) {
  if (!validTabId(tab.id) || removedDuringStartup.has(tab.id)) return;
  const state = tabsById.get(tab.id) || {};
  if (typeof tab.cookieStoreId === "string" && (!seedOnly || !state.storeId)) {
    state.storeId = tab.cookieStoreId;
  }
  if (typeof tab.incognito === "boolean" && (!seedOnly || state.incognito === undefined)) {
    state.incognito = tab.incognito;
  }
  // A delayed tabs.query/get must not overwrite a newer onCommitted event.
  if (!state.siteKnown && typeof tab.url === "string") {
    state.site = hostnameFromUrl(tab.url);
    state.siteKnown = true;
  }
  tabsById.set(tab.id, state);
}

function contextFor(details) {
  // Firefox explicitly says speculative tab/frame identifiers are unreliable.
  const hasTab = details.type !== "speculative" && validTabId(details.tabId);
  const state = hasTab ? (tabsById.get(details.tabId) || {}) : {};
  if (typeof details.cookieStoreId === "string" && details.cookieStoreId) {
    state.storeId = details.cookieStoreId;
  }
  if (typeof details.incognito === "boolean") state.incognito = details.incognito;
  if (hasTab) tabsById.set(details.tabId, state);
  return { storeId: state.storeId, incognito: state.incognito };
}

function resolveTopLevelSite(details) {
  if (details.type === "speculative") return null;
  if (details.type === "main_frame") return hostnameFromUrl(details.url);

  // Firefox's ProxyChannelFilter currently supplies frameAncestors although
  // MDN's RequestDetails list omits it. Treat it as optional, never mandatory.
  // Request-local ancestry also handles late requests from an old document.
  if (Array.isArray(details.frameAncestors)) {
    const top = details.frameAncestors.find(frame => frame.frameId === 0);
    if (top) return hostnameFromUrl(top.url);
  }
  if (!validTabId(details.tabId)) return null;
  if (details.frameId === 0 ||
      (details.type === "sub_frame" && details.parentFrameId === 0)) {
    return hostnameFromUrl(details.documentUrl);
  }

  // An iframe/worker URL is not evidence of its top-level first party. Nor is
  // today's URL-bar hostname proof of the owner of a delayed request. Unknown
  // requests get independent tokens instead of silently sharing a catch-all.
  return null;
}

function bucketKey(site, context) {
  return JSON.stringify([context.incognito, context.storeId, site]);
}

function hasContext(context) {
  return typeof context.storeId === "string" && !!context.storeId &&
    typeof context.incognito === "boolean";
}

function freshCatchAll(incognito) {
  return { token: randomToken128(), createdAt: Date.now(), incognito };
}

function getCatchAllToken(context) {
  const now = Date.now();

  if (hasContext(context)) {
    const key = bucketKey("--unknown--", context);
    let entry = catchAllBuckets.get(key);
    if (!entry || now - entry.createdAt >= CONFIG.catchAllRotationMs) {
      entry = freshCatchAll(context.incognito);
      catchAllBuckets.set(key, entry);
    }
    return entry.token;
  }

  // No trustworthy tab/container/private metadata. Keep one short-lived global
  // unknown bucket instead of creating a fresh Tor identity for every request.
  if (!globalCatchAll || now - globalCatchAll.createdAt >= CONFIG.catchAllRotationMs) {
    globalCatchAll = freshCatchAll(undefined);
  }
  return globalCatchAll.token;
}

function getOrCreateBucket(site, context) {
  const key = bucketKey(site, context);
  let entry = buckets.get(key);
  if (!entry) {
    entry = { token: randomToken128(), incognito: context.incognito };
    buckets.set(key, entry);
  }
  return entry;
}

function proxyChain(token) {
  return [{
    type: "socks",
    host: CONFIG.socksHost,
    port: CONFIG.socksPort,
    username: TOR_USERNAME,
    password: token,
    proxyDNS: true,
    connectionIsolationKey: `tdi:${token}`,
    failoverTimeout: 2
  }, null];
}

function handleProxyRequest(details) {
  try {
    const context = contextFor(details);
    const site = resolveTopLevelSite(details);
    if (site && hasContext(context)) return proxyChain(getOrCreateBucket(site, context).token);
    unattributedRequests++;
    return proxyChain(getCatchAllToken(context));
  } catch (_) {
    errorCount++;
    // Unique per failing request, still through Tor, with no dependency on the
    // failed resolver or RNG. No hostnames or complete tokens go to the console.
    emergencyCounter++;
    return proxyChain(`error:${emergencyNonce}:${emergencyCounter}`);
  }
}

browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });
browser.proxy.onError.addListener(() => { errorCount++; });

function committed(details) {
  if (details.frameId !== 0 || !validTabId(details.tabId)) return;
  const state = tabsById.get(details.tabId) || {};
  state.site = hostnameFromUrl(details.url);
  state.siteKnown = true;
  tabsById.set(details.tabId, state);
}

browser.webNavigation.onCommitted.addListener(committed);
browser.webNavigation.onHistoryStateUpdated.addListener(committed);
browser.tabs.onCreated.addListener(tab => rememberTab(tab));
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  rememberTab(tab);
  // tabs.onUpdated also covers some cached/restored/internal-page changes.
  if (typeof changeInfo.url === "string") committed({ tabId, frameId: 0, url: changeInfo.url });
});

function clearPrivateBucketsIfUnused() {
  if (!startupFinished) return;
  if (Array.from(tabsById.values()).some(tab => tab.incognito)) return;
  for (const [key, entry] of buckets) if (entry.incognito) buckets.delete(key);
  for (const [key, entry] of catchAllBuckets) if (entry.incognito) catchAllBuckets.delete(key);
}

function forgetTab(tabId) {
  tabsById.delete(tabId);
  if (!startupFinished) removedDuringStartup.add(tabId);
  clearPrivateBucketsIfUnused();
}

browser.tabs.onRemoved.addListener(forgetTab);
// This event is absent on some Firefox implementations; it must not abort startup.
if (browser.tabs.onReplaced) {
  browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    forgetTab(removedTabId);
    browser.tabs.get(addedTabId).then(tab => rememberTab(tab)).catch(() => {});
  });
}

// Register all listeners before taking the asynchronous initial tab snapshot.
const startupReady = browser.tabs.query({}).then(tabs => {
  for (const tab of tabs) rememberTab(tab, true);
}).catch(() => { errorCount++; }).finally(() => {
  startupFinished = true;
  removedDuringStartup.clear();
});

async function stateForTab(tabId) {
  if (!validTabId(tabId)) throw new Error("No active tab.");
  await startupReady;
  const tab = await browser.tabs.get(tabId);
  rememberTab(tab);
  return tabsById.get(tabId);
}

async function statusForTab(tabId) {
  const state = await stateForTab(tabId);
  const entry = state.site && hasContext(state) ? buckets.get(bucketKey(state.site, state)) : null;
  const privateAllowed = await browser.extension.isAllowedIncognitoAccess();
  return {
    ok: true,
    socks: `${CONFIG.socksHost}:${CONFIG.socksPort}`,
    site: state.site || null,
    storeId: state.storeId || null,
    incognito: state.incognito === true,
    privateAllowed,
    tokenPrefix: entry ? entry.token.slice(0, 12) : null,
    bucketCount: buckets.size + catchAllBuckets.size + (globalCatchAll ? 1 : 0),
    unattributedRequests,
    errorCount,
    canRotate: !!state.site && hasContext(state)
  };
}

async function rotateSiteForTab(tabId) {
  const state = await stateForTab(tabId);
  if (!state.site || !hasContext(state)) return { ok: false, error: "No known web-site context for this tab." };
  // Allocate first: if RNG fails, keep the existing mapping intact.
  const token = randomToken128();
  buckets.set(bucketKey(state.site, state), { token, incognito: state.incognito });
  try {
    await browser.tabs.reload(tabId, { bypassCache: true });
    return { ok: true, site: state.site, reloaded: true };
  } catch (_) {
    return { ok: true, site: state.site, reloaded: false };
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  // Only our own extension pages can inspect/rotate the routing state.
  if (sender.id !== browser.runtime.id ||
      !sender.url?.startsWith(browser.runtime.getURL(""))) return undefined;
  if (!message || typeof message !== "object") return undefined;
  let result;
  switch (message.type) {
    case "status": result = statusForTab(message.tabId); break;
    case "rotate-current": result = rotateSiteForTab(message.tabId); break;
    case "rotate-all":
      buckets.clear();
      catchAllBuckets.clear();
      globalCatchAll = null;
      result = Promise.resolve({ ok: true });
      break;
    default: return undefined;
  }
  return result.catch(() => ({ ok: false, error: "The tab is unavailable or the operation failed." }));
});
