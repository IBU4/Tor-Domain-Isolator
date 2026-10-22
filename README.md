<div align="center">

<img src="icons/tor-domain-isolator-96.svg" alt="Tor Domain Isolator icon" width="96" height="96" />

# Tor Domain Isolator

**First-party SOCKS5 stream isolation for Firefox and a local Tor service**

**v0.1.3** · Firefox WebExtension (Manifest V2) · MIT License

*Local by design · No telemetry · No remote code · No external runtime dependencies*

*Tor Domain Isolator is an independent personal project. It is not developed, maintained or endorsed by the Tor Project or Mozilla.*

</div>

---

## Overview

Tor Domain Isolator is a lightweight Firefox WebExtension that isolates Tor traffic by the **top-level website and Firefox browsing context**, rather than routing unrelated websites through the same SOCKS authentication identity.

For each recognized first-party hostname, Firefox container and normal/private context, the extension assigns a **cryptographically random 128-bit token**. It sends that token as the SOCKS5 password to a locally running Tor service. With Tor's `IsolateSOCKSAuth` enabled, streams using different credentials cannot share the same circuit.

It is designed to work alongside the Tor deamon. The connection will stop if Tor deamon is unavailable, this is the fail safe mechanism.

**Hostname isolation is intentional.** `www.example.com` and `accounts.example.com` are distinct groups. Scheme and port do not create separate groups. This extension does not combine subdomains into an eTLD+1/Public Suffix List identity.

Multiple tabs using the same hostname, Firefox container and private/normal mode share one token. Different groups receive different tokens. **An isolation group is not one permanently assigned Tor circuit**: Tor may create or replace circuits, and distinct groups may still happen to use the same exit IP.

## Requirements

- **Firefox desktop 140.0+** or **Firefox for Android 142.0+**, as declared by the supplied manifest.
- A running local Tor SOCKS5 endpoint at **`127.0.0.1:9050`**.
- Tor configured to isolate streams according to SOCKS authentication.
- Permission to use the extension in private windows, if private-window routing is needed.

### Tor configuration

Tor expert bundle can be downloaded from Tor project
- [Tor expert bundle](https://download.torproject.org/tor/)

In the relevant Tor instance's `torrc`:

```text
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
```

### Firefox desktop baseline

For a dedicated Tor Firefox profile, configure Firefox's manual connection settings to use **SOCKS v5, `127.0.0.1:9050`**, with **Proxy DNS when using SOCKS v5** enabled. This provides an independent baseline if the add-on is unloaded. The extension adds *per-request credentials* to the browser's SOCKS routing; it does not configure the browser-wide manual proxy settings.

On Android, the local Tor service (for example, a compatible Orbot SOCKS listener) must be reachable at the endpoint configured in the extension. Orbot has to be swiched from VPN to expert mode.
- [Orbot for Android]((https://play.google.com/store/apps/details?id=org.torproject.android&hl=en-US)

## Installation

### Signed XPI package

The supplied release archive contains:

```text
457fde159e624aa98179-0.1.3.xpi
```

This XPI contains Mozilla add-on signing metadata. For Firefox desktop, use the browser's **Install Add-on From File** option with the XPI, subject to the browser's normal signing and compatibility checks. Installation on Firefox for Android is available by enabling secret options.

After installing, allow **Run in Private Windows** in the add-on settings when required, and reload existing tabs so subsequent network connections use the new routing logic.

Extension will not auto update if installed manually

## License

MIT License — see [`LICENSE`](LICENSE).


