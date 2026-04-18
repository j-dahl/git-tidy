# Privacy Policy — GitTidy

**Last updated:** April 17, 2026

## Summary

GitTidy does **not** collect, transmit, or store any personal data. It operates entirely within your browser.

## Data handling

| What | Details |
|------|---------|
| **Data collected** | None |
| **Data transmitted** | None — the extension makes zero network requests |
| **Data stored locally** | A single `localStorage` key (`ghic-settings`) on `github.com` that saves your toggle preferences (which noise categories are hidden/shown). This never leaves your browser. |
| **Cookies** | None created or accessed |
| **Analytics / telemetry** | None |
| **Third-party services** | None |

## Permissions explained

| Permission | Why |
|------------|-----|
| `storage` | Declared in manifest for future use. Currently preferences use `localStorage` which requires no permission. |
| Host: `https://github.com/*` | Required to inject the content script that identifies and toggles timeline noise elements on GitHub pages. |

## Open source

The full source code is available at [github.com/j-dahl/git-tidy](https://github.com/j-dahl/git-tidy).

## Contact

For questions, open an issue on the [GitHub repository](https://github.com/j-dahl/git-tidy/issues).
