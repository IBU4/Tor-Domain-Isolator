# Detached PGP signature verification

The original Tor Domain Isolator 0.1.3 ZIP includes detached OpenPGP signatures for:

```text
457fde159e624aa98179-0.1.3.xpi.asc
background.js.asc
manifest.json.asc
popup.css.asc
popup.html.asc
popup.js.asc
```

All six signatures claim an **EdDSA (Ed25519)** issuer:

```text
C78D E843 9F25 11AB 00D6 AD43 62C7 004C 133C 9364
```

**Verification status (2026-10-19): 6/6 VALID.** All six detached signatures were checked against the unmodified files from the original v0.1.3 archive with **GnuPG 2.4.7** and the OpenPGP public key supplied by the author. Each command exited with status `0` and produced `GOODSIG` and `VALIDSIG`. This verifies cryptographic integrity **relative to the public key below**. It does not independently establish the real-world identity of the key owner or its third-party certification. GnuPG's `not certified with a trusted signature` warning concerns key trust, not a failed content signature.

The public key is available both as [`signing-public-key.asc`](../signing-public-key.asc) at the repository root and **embedded at the bottom of this document**. Verify its fingerprint from an independent source if you require authentication of the signer.

From the repository root, run:

```sh
gpg --import signing-public-key.asc
gpg --verify background.js.asc background.js
gpg --verify manifest.json.asc manifest.json
gpg --verify popup.css.asc popup.css
gpg --verify popup.html.asc popup.html
gpg --verify popup.js.asc popup.js
gpg --verify 457fde159e624aa98179-0.1.3.xpi.asc 457fde159e624aa98179-0.1.3.xpi
```

## SHA-256 (files in the supplied archive)

```text
9d2b295faf3a64e372bf5e161b28c27ab3003444635fcf505d325b847c3fb48f  457fde159e624aa98179-0.1.3.xpi
a7fee464b331d01d1782b019649a17755be52945aa696064b341585ef8d26faa  background.js
675ffdb08abbf98989419795d04f0a0fbfc50ea8cf656f2f1255fa147f66821c  manifest.json
d6f08247627606fae1962fcf37e179d7490f641836fb57530785dd56bf8b0fb0  popup.js
a1cbd7dcf64213e058d94bf2d1944c3d4e958ed9876e9b55da807aa71463da3f  popup.html
dc645455d7cb1e0f100f5cad39d7b750af980de8801381a61dc6b06477806b23  popup.css
```

The XPI contains Mozilla `META-INF/` signing metadata as well. The `manifest.json` embedded in the XPI is whitespace-formatted differently from the original standalone source manifest; do not apply the standalone manifest detached signature to the XPI's internal manifest.

## Public OpenPGP key (ASCII-armored)

This is the **public** key only. No private or secret key is included. The associated primary key fingerprint is `C78DE8439F2511AB00D6AD4362C7004C133C9364`.

```text
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: PGPony - PGPony.app

xjMEaqwWdBYJKwYBBAHaRw8BAQdA3LV3gnA0vb1QYJXDgsi1RJ6lNT7w6Ym7gi1r
f11N88bNIUl2YW4gQnVrdmnEhyA8aWJ1a3ZpYzRAZ21haWwuY29tPsKIBBMWCAAw
BYJqrBZ0AhsDBAsJCAcEFQgJChYhBMeN6EOfJRGrANatQ2LHAEwTPJNkBQkDww/A
AAoJEGLHAEwTPJNkWCEBANcDwQa69ivLh2OquCzzCo6xkkAXJhFSdmwA57hgv9dH
AP9HvgBSbnxjq/n7KMCdD8Mra+nqOmhoty9QEksUquR2Dc44BGqsFnQSCisGAQQB
l1UBBQEBB0AExffy3jUaJWG+VsKZ3EWkeudLAmPnxrVubNKvkqVkTAMBCAfCYQQY
FggACQWCaqwWdAIbDAAKCRBixwBMEzyTZKOwAQDvummOa1pHsa8EHtfQ47xX3W5S
eCOQ7GxiLfuuI6yNJgEAi/jxf5j0J6GAug8EgQe0RvnLwb0EPcGvVUV5LtxBVAY=
=dUbG
-----END PGP PUBLIC KEY BLOCK-----
```
