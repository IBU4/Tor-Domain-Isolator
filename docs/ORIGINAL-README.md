# Tor Domain Isolator (Local) — 0.1.3

Firefox desktop WebExtension for a locally running Tor SOCKS5 service. No external
runtime dependencies, telemetry, remote code or token storage. The JavaScript
routing logic is tested; an end-to-end Firefox + Tor run is still required.

## Routing

A recognized first party uses a session token keyed by:

```text
top-level hostname + cookieStoreId + private/normal context
```

Two tabs of the same hostname and context share a token. Different hostnames or
containers get different random 128-bit tokens. Hostname matching is intentional:
`www.example.com` and `accounts.example.com` are separate; ports and schemes do
not create separate groups. This is not a Public Suffix List / eTLD+1 algorithm.

The SOCKS request uses `username = <torS0X>0` and `password = token`.
`proxyDNS: true` requests SOCKS name resolution. `connectionIsolationKey` carries
the token too. Tor must have SOCKS authentication isolation enabled.
A token identifies an isolation group, not one permanently assigned circuit.
Different groups may use circuits with the same exit IP.

How the first party is determined:

1. A top-level network navigation uses its destination hostname, including redirects.
2. Subrequests use a root entry in request-local `frameAncestors` when supplied.
3. For a top-frame request, or a direct child-frame navigation, `documentUrl`
   identifies the owning top document when the tab information is valid.
4. Otherwise the request uses a short-lived catch-all token. It is never grouped
   by an unverified iframe/worker hostname.

Firefox currently supplies `frameAncestors` in `ProxyChannelFilter.sys.mjs` even
though MDN's `proxy.RequestDetails` page omits this field. It is optional here.
When trustworthy ancestry is absent, ambiguous nested-frame, worker, opaque and
speculative requests use a **10-minute catch-all**. Where Firefox still provides
reliable cookie-store/private metadata, that catch-all is separated by context;
truly contextless traffic uses one global short-lived catch-all.

`Unattributed` counts requests that used this fallback; it does not count circuits.
The fallback deliberately mirrors Tor Browser's `--unknown--` design more closely
than 0.1.1's per-request random token. Speculative tab/frame IDs are ignored.

## Tor configuration

Use the following in the relevant `torrc`, replacing an existing declaration for
the same listening address and port, then restart that Tor instance:

```text
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
```

For another port, change `CONFIG.socksPort` in `background.js` as well. No
ControlPort is needed to operate the add-on. Tor Expert Bundle is one way to run
this service on Windows; an existing local Tor daemon also works in principle.
Orbot/Android integration has not been validated by this review.

The modern `<torS0X>0` format is supported explicitly by C Tor from 0.4.9.1-alpha
and Arti from 1.2.8. The Tor specification states that older implementations also
obtain the intended isolation by interpreting this format as legacy credentials.

## Firefox installation and baseline

1. Use a dedicated Tor Firefox profile. In Firefox's **Connection Settings**,
   retain **Manual proxy configuration**, **SOCKS Host 127.0.0.1**, **Port 9050**,
   **SOCKS v5**, and enable **Proxy DNS when using SOCKS v5**. Leave HTTP/HTTPS
   proxy fields empty and remove destination exceptions from **No Proxy For**.
   This baseline is independent of the extension; the add-on does not alter it.
2. Start the Tor service and wait for bootstrap to finish.
3. Extract this ZIP. Open `about:debugging#/runtime/this-firefox`, choose
   **Load Temporary Add-on**, then select the extracted `manifest.json`.
   This download is a source archive with a containing directory, not a signed XPI.
4. In `about:addons`, allow **Run in Private Windows** if the profile uses them.
   The popup reports when that permission is absent.
5. Reload open sites after loading/upgrading the extension. Connections already
   established before activation are not retroactively moved.

The manifest's declared minimum is Firefox 128. It is not a certification that
all Firefox releases since 128 have been run through an integration test.
Temporary add-ons disappear on Firefox restart. Normal permanent installation
requires an appropriately signed package; this source project is unsigned.
Manifest V2 uses a persistent background page, so tokens persist until the
extension is unloaded/reloaded or the browser closes. Private mappings are also
cleared when the last tracked private tab closes.

## Fail-closed scope

Every handled route returns `[socksProxyInfo, null]`. The terminal null removes
the browser-defined fallback from that chain. If normal routing throws, a
separate per-request emergency token still routes through the same Tor endpoint.
It does not return a bare null, undefined, or a direct route on that error path.

This is **not a system-wide kill switch**. It cannot enforce routing while the
extension is disabled, removed, not yet started, or unable to load. Retain the
manual SOCKS baseline and test with Tor stopped both with and without the add-on.
Other proxy extensions or browser routing features can affect the effective
configuration and need separate integration testing.

The add-on does not control every DNS operation or every browser network stack.
WebRTC/UDP, browser-internal traffic, external applications and pre-existing
connections are not covered by a universal guarantee. `proxyDNS` specifies name
resolution for the selected SOCKS route, not a whole-system DNS-leak policy.
WebRTC policy and the rest of the dedicated profile remain separate controls.

## Popup and rotation

- **Rotate site + reload** replaces the current hostname/context token and requests
  a bypass-cache reload of that tab. Other tabs in the same group use the new
  token for subsequent connections; reload them to replace existing connections.
- **Rotate all** clears all stored groups. It deliberately does not reload every
  tab or interrupt forms automatically. Reload the tabs you want to restart.
- Neither operation sends Tor `NEWNYM`, closes every existing socket, clears
  cookies/storage, nor guarantees a different exit relay/IP.
- The displayed token is the group's current token prefix, not proof that every
  open socket uses it. SOCKS address, token count and `Routing errors` are routing
  diagnostics, not a test that Tor is running or bootstrapped.
- Full tokens and visited hostnames are no longer logged to the background console.

The same third-party page script can still correlate application identifiers if
other browser controls allow it. This component only adds connection/circuit
isolation; it does not replace storage isolation or fingerprinting controls.

## 0.1.2 compatibility correction

Version 0.1.1 intentionally gave every unattributed request a fresh SOCKS token. A
Vercel/Fingerprint.com A/B test exposed a compatibility failure when the extension was
enabled. Per-request unknown tokens are a stronger suspect than ordinary site routing
because they can make one verification flow appear from multiple Tor exits. Tor Browser itself uses a
catch-all identity for unknown first-party traffic and rotates that catch-all after
10 minutes. Version 0.1.2 adopts that behavior.

The existing full-hostname grouping remains unchanged in 0.1.2 so this compatibility
change can be tested independently. eTLD+1/Public-Suffix grouping remains a documented
future parity improvement.

## Verification included

With Node.js 18 or newer, from the extracted project folder:

```sh
node --test tests/background.test.cjs
node --check background.js
node --check popup.js
```

The tests execute the real `background.js` in a VM with mocked WebExtension events
and APIs. They cover site separation, containers, private contexts, nested frames,
redirects, navigation timing, pre-existing tabs, startup races, ambiguous and
speculative requests, rotation/reload, private cleanup and exception handling.
They do **not** run Gecko, a SOCKS handshake, a Tor daemon, packet capture or
stream-to-circuit inspection. Passing tests must not be represented as proof of
no network leaks. `TEST-RESULTS.txt` records the actual run.

## Required live acceptance test

1. Open sites A and B. Check distinct popup token prefixes; two tabs of A in the
   same store should share A's token. Repeat A in another container and a private
   window. Their token prefixes should differ.
2. Load a shared third-party resource and a nested iframe under both roots. Use
   a debugger breakpoint in `handleProxyRequest` to inspect available ancestry
   and outgoing credentials without enabling persistent token logging.
3. Rotate A. Confirm a new A token and an actual reload; B should keep its token.
   Check a WebSocket and a long-running connection separately after reload.
4. With cache disabled in DevTools, stop Tor and request a new, uncached HTTPS
   URL. It must fail. Repeat after disabling/removing the add-on to verify the
   manual proxy baseline. Cached/offline content is not a connectivity test.
5. Inspect DNS/network traffic if claiming absence of bypasses. To demonstrate
   circuit isolation, correlate Tor STREAM/CIRC information with the SOCKS
   isolation values using a locally authenticated ControlPort diagnostic.
   Comparing exit IP addresses alone does not establish circuit separation.

## Primary references

Checked 2026-10-05:

- [Tor SOCKS extensions and isolation](https://spec.torproject.org/socks-extensions.html)
- [Mozilla proxy.onRequest: result, ordering and fallback](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest)
- [Mozilla ProxyInfo: SOCKS authentication, DNS and connectionIsolationKey](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo)
- [Mozilla RequestDetails](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/RequestDetails)
- [Mozilla proxy: speculative-connection caveat](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy)
- [Firefox ProxyChannelFilter implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/ProxyChannelFilter.sys.mjs)
- [Firefox connection-pool key implementation](https://searchfox.org/firefox-main/source/netwerk/protocol/http/nsHttpConnectionInfo.cpp)
- [Mozilla temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Mozilla Connection Settings](https://support.mozilla.org/en-US/kb/connection-settings-firefox)
