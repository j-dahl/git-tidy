# GitTidy 🧹

**Tidy up your GitHub** — a browser extension that declutters GitHub issues and PRs, surfaces project context, and helps you focus on what matters. Works in **Edge**, **Chrome**, and **Safari**.

## Features

### 🧹 Noise Toggle (Issues, PRs & Project Panes)

Hides noisy system-generated timeline events so you can focus on the conversation:

- **Labels** — "added/removed Label"
- **Assignments** — "assigned/unassigned User"
- **Project board** — "added to Project", "moved to Column"
- **State changes** — closed, reopened
- **Cross-references** — "mentioned this issue"
- **Renames** — "changed the title"
- **Milestones** — "added/removed Milestone"
- **Parent/sub-issue** — hierarchy changes
- **Field changes** — custom field updates
- **Lock/pin** — lock, unlock, pin, unpin
- **PR-specific** — review requests, commit pushes, branch events

A floating 🧹 button appears in the bottom-right corner with per-category checkboxes. When noise is hidden, a subtle "⋯ N system events hidden" bar replaces consecutive items. Your preferences persist across pages.

### 📋 Project Association Badges

On issue and PR pages, clickable badges appear near the title showing which GitHub Projects the item belongs to. Click a badge to jump straight to that project board.

### ⏱️ Issue Age Indicator

A color-coded age badge appears on issue pages:

| Color | Age |
|-------|-----|
| 🟢 Green | < 7 days |
| 🔵 Blue | 7–30 days |
| 🟠 Amber | 30–90 days |
| 🔴 Red | > 90 days |

### 📂 Repo Navigator (Project Pages)

On GitHub Project pages, a **Repos** button lists all repositories referenced by project items with counts, making cross-repo navigation easy.

## Install

### Edge

1. Open `edge://extensions/`
2. Enable **Developer mode** (toggle in the bottom-left)
3. Click **Load unpacked** and select this folder
4. Navigate to any GitHub issue — GitTidy appears automatically

Also available on the [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/gittidy/iebojpkfgfnlnjbhpgbpbcngdhgbkaek).

### Chrome

Same steps but at `chrome://extensions/`.

### Safari

Requires **macOS 14+** and **Xcode 15+**.

```bash
# Option A: helper script
cd git-tidy && chmod +x convert-safari.sh && ./convert-safari.sh

# Option B: manual
xcrun safari-web-extension-converter /path/to/git-tidy \
  --app-name "GitTidy" \
  --bundle-identifier "com.git-tidy.extension"
```

Then build in Xcode (⌘R) and enable in **Safari → Settings → Extensions**.

## Development

```bash
git clone https://github.com/j-dahl/git-tidy.git
cd git-tidy
```

Edit `content.js` to adjust noise classification. The `CATEGORIES` object at the top controls which GitHub timeline events are hidden per category.

## Project Structure

```
├── manifest.json       # Extension manifest (Manifest V3)
├── content.js          # Content script — noise detection, badges, age indicator
├── styles.css          # UI styles for all features
├── convert-safari.sh   # Safari conversion helper (macOS + Xcode)
├── PRIVACY.md          # Privacy policy
└── icons/              # Extension icons (16/48/128px)
```

## Privacy

GitTidy runs entirely in your browser. It does not collect, transmit, or store any personal data. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT
