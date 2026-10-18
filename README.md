# Tor Domain Isolator — v0.1.3

**Firefox WebExtension for first-party Tor SOCKS5 stream isolation.**

A local, self-contained extension that assigns random **128-bit SOCKS authentication tokens** to Firefox requests according to the owning top-level hostname, container (`cookieStoreId`) and private/normal browsing context. Tor's `IsolateSOCKSAuth` then prevents streams with different isolation credentials from sharing a circuit.

**No telemetry · No remote code · No external runtime dependencies · No persistent token database**

> Personal project for local Tor operation. Not affiliated with Mozilla or the Tor Project. This repository documents the provided version **0.1.3**; it is not an independent network-security certification.

## Design

```text
 Top-level hostname  +  Firefox container  +  private / normal
                          |
                  random 128-bit token
                          |
         SOCKS5 username + password  (proxyDNS: true)
                          |
                  127.0.0.1:9050
                          |
                 Tor IsolateSOCKSAuth
                          |
               separate isolation bucket
```

Two tabs of the same hostname in the same context reuse the same isolation token. Different hostnames and containers receive different tokens. Grouping uses the **full hostname**, not eTLD+1: `www.example.com` and `accounts.example.com` have separate buckets. A bucket is *not* a permanently assigned circuit; different buckets can use the same exit IP.

For ambiguous frame, worker and speculative requests lacking reliable first-party attribution, version 0.1.3 uses a context-separated **10-minute catch-all** token when possible, rather than creating a new identity for every request or trusting an unrelated iframe hostname.

## Features

| Function | Implementation |
| --- | --- |
| Domain-based isolation | Per-hostname random SOCKS5 authentication token |
| Firefox Containers | Independent token buckets by `cookieStoreId` |
| Private browsing | Separate context, cleaned when the last private tab closes |
| Unknown context | Rotating 10-minute fallback bucket |
| Routing | Local SOCKS5 with `proxyDNS: true` |
| Proxy failover | Handled routes return `[socksProxyInfo, null]` (no direct fallback in that chain) |
| Rotate current site | Changes its token and requests a cache-bypassing reload |
| Rotate all | Clears existing token maps; existing connections are not forcibly closed |
| Diagnostics | Current hostname, context, token prefix, number of buckets, unknown requests and errors |

## Requirements and configuration

- Firefox supporting this WebExtension. The **provided manifest** declares Firefox **140.0+** and Firefox for Android **142.0+**.
- Local Tor SOCKS service, normally `127.0.0.1:9050`, configured with authentication-based stream isolation.
- Dedicated Firefox SOCKS5 proxy configuration with remote DNS through SOCKS.

Example `torrc`:

```text
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
```

A different port requires changing `CONFIG.socksPort` in `background.js`. The extension does not start Tor, issue `NEWNYM`, or require a ControlPort.

The supplied XPI contains Firefox/Mozilla signing metadata. Distribution and permanent installation should use an appropriately signed XPI, not an unsigned source folder. Firefox's private-window permission must be enabled separately if needed.

## Security scope

- **Fail-closed** describes proxy routes handled by the extension; it does not act as a system-wide kill switch when the extension is disabled, unloaded or unavailable.
- Token rotation changes future SOCKS isolation credentials; it does **not** guarantee a new exit IP or close every pre-existing socket.
- This add-on is a routing isolation component. It does not replace browser storage isolation, script controls, WebRTC controls or fingerprinting defenses.
- JavaScript syntax checks passed for `background.js` and `popup.js`. A full Firefox/Tor packet-level and STREAM/CIRC acceptance test is not established by those checks alone.

## Signed 0.1.3 package

The original ZIP supplied for this project contains the 0.1.3 XPI, source files, icons, license, technical README and six detached OpenPGP signatures. The detached signatures identify the following Ed25519/EdDSA signing key:

```text
C78D E843 9F25 11AB 00D6 AD43 62C7 004C 133C 9364
```

**Verification status:** The signature files were inspected but cannot yet be cryptographically verified without the corresponding public key. A PGP signature is different from the Firefox/Mozilla XPI signature.

XPI SHA-256 (original archive):

```text
9d2b295faf3a64e372bf5e161b28c27ab3003444635fcf505d325b847c3fb48f
```

See [OpenPGP verification and checksums](docs/PGP-VERIFICATION.md) for reproducible commands. The original supplied README is preserved separately as `docs/ORIGINAL-README.md` when source files are added. Its references to an unsigned source ZIP, Firefox 128 and missing integration tests reflect an earlier packaging state and do not match every file in the supplied archive.

## References

- [Tor SOCKS extensions](https://spec.torproject.org/socks-extensions.html)
- [Firefox proxy.onRequest](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest)
- [Firefox proxy.ProxyInfo](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo)

**License:** See the original `LICENSE` supplied with the extension.
