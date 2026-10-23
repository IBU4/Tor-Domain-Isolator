## Frequently Asked Questions (FAQ)

### Important Security Warning

**Tor Domain Isolator is NOT a replacement for Tor Browser.**

Correct configuration of both the Tor service and Firefox is critical. Incorrect configuration may result in loss of anonymity.

This extension is intended for users who understand the associated risks and can independently verify their configuration.

### 1. What is the purpose of this extension?

To provide Firefox with Tor SOCKS5 stream isolation based on first-party hostnames and browsing contexts, using a mechanism similar to Tor Browser's circuit isolation.

### 2. Who is this extension intended for?

Advanced users and developers who want to use Firefox with additional privacy and anonymity protections through the Tor network.

It is not intended for inexperienced users.

### 3. Does the extension work independently?

No.

A separately installed and configured Tor service is required.

- **Windows / Linux:** Tor Expert Bundle or a compatible local Tor service.
- **Android:** Orbot configured with a compatible local SOCKS5 listener.

The extension does not install, start or configure Tor.

### 4. Does this extension turn Firefox into Tor Browser?

No.

Tor Browser includes additional privacy, fingerprinting and anonymity protections beyond circuit isolation.

Tor Domain Isolator implements a specific routing and isolation function. It does not reproduce the complete Tor Browser security architecture.

### 5. How do I configure the Tor Expert Bundle?

Tor Expert Bundle installation and configuration are outside the scope of this project.

If you are unsure how to configure Tor correctly, use Tor Browser instead.

The following configuration is important for this extension:

`SocksPort 127.0.0.1:9050 IsolateSOCKSAuth`

This directive belongs in the Tor configuration file (`torrc`).

Tor Domain Isolator expects a local SOCKS5 service listening on `127.0.0.1:9050`, with SOCKS authentication isolation enabled.

**Do not assume that simply starting the Tor Expert Bundle provides the required configuration.**

### 6. How should Firefox be configured?

For the intended privacy-oriented setup:

- Use Firefox Private Browsing.
- On desktop Firefox, configure the manual SOCKS v5 proxy to `127.0.0.1:9050`.
- Enable **Proxy DNS when using SOCKS v5**.
- Set Firefox Enhanced Tracking Protection (ETP) to **Strict**.
- Allow Tor Domain Isolator to operate in private windows.

These settings do not reproduce all Tor Browser protections.

If you are unsure how to configure Firefox securely, use Tor Browser instead.

### 7. Are additional extensions required?

No.

However, **NoScript extension is strongly recommended**, particularly with WebGL, WebAssembly (WASM), LAN and Ping capabilities disabled where they are not needed.

Additional protections must be configured independently. Tor Domain Isolator does not manage JavaScript permissions or browser fingerprinting protections.

### 8. Will there be updates or technical support?

No technical support, maintenance or future updates are promised.

Tor Domain Isolator was originally developed as a personal project. Following successful testing, it was made publicly available under the **MIT License**, allowing anyone to use, modify and redistribute the source code under the license terms.

Future development, if any, may remain private.

The project is provided **AS IS**, without warranty or obligation to provide support.

### 9. Has the extension been tested?

Yes.

The extension has undergone functional and practical testing across **Windows, Linux and Android**, with satisfactory results.

Testing included:

- **Tor circuit verification:** Tor logs were examined to verify that circuit isolation behaved as intended.
- **Edge cases:** Various exceptional conditions and routing scenarios were tested.
- **Fail-closed behavior:** When the local Tor service was stopped, network connectivity was lost rather than falling back to a direct connection in the tested configurations.
- **DNS and WebRTC:** DNS leak and WebRTC leak testing was performed.
- **Cross-platform operation:** The extension was used and tested on Firefox for Windows, Linux and Android.
- **Fingerprinting:** Tested against the commercial Fingerprint Pro identification service. At the time of publication, Fingerprint Pro was unable to consistently maintain a persistent Visitor ID (VID) across repeated private browsing sessions using Firefox configured as described in this FAQ. **The key is the complete browser configuration and disciplined use of private browsing sessions, not this extension alone.** These findings reflect the tested configurations and should not be interpreted as a guarantee of fingerprinting resistance in every environment.

The observed results were consistent with the intended behavior of the extension.

**These results reflect the configurations tested by the developer. They do not constitute an independent security audit or guarantee anonymity under every possible configuration.**

### 10. Can I use an ad-blocking extension?

Yes.

Tor Domain Isolator was specifically developed to allow users to retain **standard Firefox and their preferred extensions**, while adding Tor SOCKS5 stream isolation for improved privacy.

However, keep in mind that every additional extension introduces potential attack surface and may also introduce fingerprintable behavior, depending on its implementation and interaction with websites.

Users should evaluate their extensions and configurations accordingly.

**The author used uBlock Origin extension in the tested configurations**, with satisfactory results.