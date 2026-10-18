<div align="center">

<img src="icons/tor-domain-isolator-96.svg" alt="Tor Domain Isolator icon" width="96" height="96" />

# Tor Domain Isolator

**First-party SOCKS5 stream isolation for Firefox and a local Tor service**

**v0.1.3** · Firefox WebExtension (Manifest V2) · MIT License

*Local by design · No telemetry · No remote code · No external runtime dependencies*

</div>

---

## Overview

Tor Domain Isolator is a lightweight Firefox WebExtension that isolates Tor traffic by the **top-level website and Firefox browsing context**, rather than routing unrelated websites through the same SOCKS authentication identity.

For each recognized first-party hostname, Firefox container and normal/private context, the extension assigns a **cryptographically random 128-bit token**. It sends that token as the SOCKS5 password to a locally running Tor service. With Tor's `IsolateSOCKSAuth` enabled, streams using different credentials cannot share the same circuit.

It is designed to work alongside the browser's existing storage, script, fingerprinting and other security controls. It is **not** a modified Tor Browser, a VPN, a general-purpose proxy manager or a Tor ControlPort client.

### At a glance

| Property | Implementation |
| --- | --- |
| Isolation unit | Full top-level hostname + `cookieStoreId` + private/normal context |
| Authentication | SOCKS5 username `<torS0X>0`; per-group random 128-bit password |
| Tor integration | Local SOCKS5, `IsolateSOCKSAuth`, `proxyDNS: true` |
| Unknown request owner | Short-lived, context-aware catch-all; 10-minute rotation |
| Firefox Containers | Distinct tokens per cookie store |
| Private browsing | Separate buckets; private buckets removed after the last tracked private tab closes |
| Token persistence | In memory for the current extension/browser lifetime; no persistent token database |
| User controls | Reassign current domain and reload; reset all tokens |
| Diagnostics | First party, context, token prefix, buckets, unattributed requests, routing errors |
| Dependencies | Native Firefox WebExtension APIs only |

## Architecture

```text
  Firefox proxy request
          |
          +-- Resolve verified first-party hostname
          |      (main-frame destination / request ancestry /
          |       supported document context)
          |
          +-- Resolve cookie store and private/normal context
          |
          v
  [ hostname + cookieStoreId + private state ]
          |
          v
  Random 128-bit SOCKS authentication token
          |
          v
  Local SOCKS5 endpoint (127.0.0.1:9050)
          |  username: <torS0X>0
          |  password: per-group token
          |  proxyDNS: true
          v
  Tor SocksPort with IsolateSOCKSAuth
          |
          v
  Circuit-sharing isolation bucket
```

**Hostname isolation is intentional.** `www.example.com` and `accounts.example.com` are distinct groups. Scheme and port do not create separate groups. This extension does not combine subdomains into an eTLD+1/Public Suffix List identity.

Multiple tabs using the same hostname, Firefox container and private/normal mode share one token. Different groups receive different tokens. **An isolation group is not one permanently assigned Tor circuit**: Tor may create or replace circuits, and distinct groups may still happen to use the same exit IP.

### First-party attribution

The routing code chooses an owner from information available for each request:

1. **Top-level navigation:** uses the destination hostname, including redirects.
2. **Request ancestry:** uses a verified top-frame entry in `frameAncestors`, when Firefox supplies it.
3. **Document context:** for supported top-frame and direct child-frame requests, uses `documentUrl` with valid tab metadata.
4. **Unattributed requests:** uses a rotating catch-all token instead of guessing from an iframe, worker or speculative destination hostname.

When reliable container/private metadata exists, the catch-all is also separated by that context. Truly contextless requests share a separate global catch-all. The catch-all is replaced after **10 minutes**.

This design avoids the older behavior of assigning a completely new Tor identity to every ambiguous request, which could disrupt multi-request verification or anti-fraud flows.

### Routing and failure handling

For handled requests, the extension returns a SOCKS proxy descriptor with `proxyDNS: true` and a terminal `null` in its proxy chain, rather than supplying a direct fallback. If request processing throws, an independently generated emergency credential still selects the configured SOCKS endpoint.

**Scope:** this controls routes handled while the extension is running. It is not a whole-device kill switch. It cannot enforce routing while disabled/unloaded, and it does not by itself control WebRTC, every browser-internal connection, other applications or pre-existing open sockets. Those properties must be assessed separately in a real browser/Tor environment.

## Requirements

- **Firefox desktop 140.0+** or **Firefox for Android 142.0+**, as declared by the supplied manifest.
- A running local Tor SOCKS5 endpoint at **`127.0.0.1:9050`**, or an explicitly adapted endpoint in `background.js`.
- Tor configured to isolate streams according to SOCKS authentication.
- Permission to use the extension in private windows, if private-window routing is needed.

### Tor configuration

In the relevant Tor instance's `torrc`:

```text
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
```

Restart that Tor instance after changing its configuration. If a different port is used, also change `CONFIG.socksPort` in `background.js` **before packaging/signing a different build**. Changing the source after signing means the existing signatures no longer attest to that modified source.

**No ControlPort is required** for normal operation. The extension does not start Tor or request `NEWNYM`.

### Firefox desktop baseline

For a dedicated Tor Firefox profile, configure Firefox's manual connection settings to use **SOCKS v5, `127.0.0.1:9050`**, with **Proxy DNS when using SOCKS v5** enabled. This provides an independent baseline if the add-on is unloaded. The extension adds *per-request credentials* to the browser's SOCKS routing; it does not configure the browser-wide manual proxy settings.

On Android, the local Tor service (for example, a compatible Orbot SOCKS listener) must be reachable at the endpoint configured in the extension. Android installation and local proxy availability are environment-dependent; the manifest's minimum version is a compatibility declaration, not proof of universal device support.

## Installation

### Signed XPI package

The supplied release archive contains:

```text
457fde159e624aa98179-0.1.3.xpi
```

This XPI contains Mozilla add-on signing metadata. For Firefox desktop, use the browser's **Install Add-on From File** option with the XPI, subject to the browser's normal signing and compatibility checks. Installation paths on Firefox for Android depend on the supported add-on installation mechanism and Firefox version.

After installing, allow **Run in Private Windows** in the add-on settings when required, and reload existing tabs so subsequent network connections use the new routing logic.

### Temporary development installation

For source inspection or temporary testing on desktop Firefox:

1. Extract the project archive.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `manifest.json`.
4. Start Tor and check the extension popup for routing diagnostics.

Temporary loading does not provide a persistent, signed installation. **Do not modify any signed source file while claiming that its existing detached PGP signature still verifies.**

## Popup controls

| Control | Effect |
| --- | --- |
| **Reassign current domain** | Generates a new token for the active site's hostname/context and requests a bypass-cache reload of that tab |
| **Reset all** | Clears all normal and catch-all token maps; new connections allocate new tokens |

The popup also displays the configured SOCKS endpoint, active first party, cookie store, private/normal context, a **prefix** of the token, total isolation buckets, unattributed request count and routing error count.

Token rotation does **not** automatically close all existing connections, clear cookies, reset browser storage, guarantee a new exit IP or issue a Tor `NEWNYM`. Other open tabs may need reloading to establish new connections.

## Source files

```text
Tor-Domain-Isolator/
├── README.md                               Project overview (this document)
├── manifest.json                           Firefox extension manifest
├── background.js                           Proxy routing, first-party resolution and tokens
├── popup.html                              Popup layout
├── popup.css                               Popup styling
├── popup.js                                Diagnostics and rotation controls
├── icons/                                  Extension artwork
├── LICENSE                                 MIT License
├── signing-public-key.asc                 Public OpenPGP signing key (not a secret key)
├── Description.txt                         Original short description
├── 457fde159e624aa98179-0.1.3.xpi        Signed Firefox installation package
├── 457fde159e624aa98179-0.1.3.xpi.asc    Detached OpenPGP signature for the XPI
├── background.js.asc                       Detached OpenPGP source signature
├── manifest.json.asc                       Detached OpenPGP source signature
├── popup.html.asc                          Detached OpenPGP source signature
├── popup.css.asc                           Detached OpenPGP source signature
├── popup.js.asc                            Detached OpenPGP source signature
└── docs/
    ├── ORIGINAL-README.md                  Unmodified original technical README
    └── PGP-VERIFICATION.md                 Signing and verification notes
```

Some files are supplied by the release archive; `docs/PGP-VERIFICATION.md` is maintained in the GitHub repository.

## Integrity and OpenPGP signatures

The release includes **six detached OpenPGP signatures** for the XPI and five individual source files. The signature packets identify an **Ed25519 / EdDSA** issuer with the following public-key fingerprint:

```text
C78D E843 9F25 11AB 00D6 AD43 62C7 004C 133C 9364
```

**PGP verification: PASSED (6/6, 2026-10-19).** The XPI and all five independently signed source files passed GnuPG 2.4.7 verification (`GOODSIG`, `VALIDSIG`, exit code `0`) against the author's supplied [public key](signing-public-key.asc). This confirms signature validity relative to that key; its real-world ownership and third-party trust certification are separate questions. Mozilla XPI signing and detached OpenPGP signatures are separate mechanisms.

To independently reproduce the verification, first authenticate the **public** key's fingerprint through a trusted source, then run:

```sh
gpg --import signing-public-key.asc
gpg --verify background.js.asc background.js
gpg --verify manifest.json.asc manifest.json
gpg --verify popup.js.asc popup.js
gpg --verify popup.css.asc popup.css
gpg --verify popup.html.asc popup.html
gpg --verify 457fde159e624aa98179-0.1.3.xpi.asc 457fde159e624aa98179-0.1.3.xpi
```

**SHA-256 of the supplied XPI (v0.1.3):**

```text
9d2b295faf3a64e372bf5e161b28c27ab3003444635fcf505d325b847c3fb48f
```

The source files `background.js`, `popup.js`, `popup.html` and `popup.css` inside the XPI match the corresponding separate release files byte-for-byte. The packaged `manifest.json` uses different whitespace; verify `manifest.json.asc` against the **stand-alone** `manifest.json` supplied with the ZIP, and verify the XPI against its own `.xpi.asc` signature.

**This newly written README is documentation, not one of the PGP-signed files.** See [`docs/PGP-VERIFICATION.md`](docs/PGP-VERIFICATION.md) for file checksums and further notes.

## Verification and testing

The original project documentation records isolated JavaScript tests and describes a live Firefox/Tor acceptance procedure. **Test scripts and their output are not present in the uploaded 0.1.3 package**, so they are not represented here as reproducible repository tests.

Basic source syntax can be checked with Node.js:

```sh
node --check background.js
node --check popup.js
```

Live validation should distinguish the following results:

1. **Grouping:** same hostname + container + browsing mode shares a token; changing any grouping component changes the token.
2. **Subresources:** requests under different first-party pages are attributed according to their actual owning document, where Firefox provides adequate metadata.
3. **Fallback:** unattributed traffic uses the configured catch-all behavior instead of unverified destination attribution.
4. **Rotation:** the current site's token changes without unintentionally rotating unrelated groups.
5. **Routing:** new requests fail when the configured Tor listener is unavailable, including checks with the extension unloaded against the manual proxy baseline.
6. **Circuit isolation:** actual Tor STREAM/CIRC observations are needed to verify circuit grouping; different exit IPs alone are not proof.

A JavaScript syntax check is **not** a substitute for end-to-end network verification.

## Project history

- **0.1.1:** earlier handling generated a separate credential for each unattributed request.
- **0.1.2:** replaced that behavior with a short-lived catch-all to avoid splitting related multi-request flows across unnecessary isolation identities.
- **0.1.3:** version represented by the supplied signed XPI and source archive; behavior is described from the actual packaged source.

## References

- [Tor SOCKS extensions and stream isolation](https://spec.torproject.org/socks-extensions.html)
- [Firefox `proxy.onRequest`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest)
- [Firefox `proxy.ProxyInfo`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo)
- [Firefox `proxy.RequestDetails`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/RequestDetails)
- [Firefox ProxyChannelFilter implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/ProxyChannelFilter.sys.mjs)

## License

MIT License — see [`LICENSE`](LICENSE).

*Tor Domain Isolator is an independent personal project. It is not developed, maintained or endorsed by the Tor Project or Mozilla.*
