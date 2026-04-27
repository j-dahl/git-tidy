# GitTidy 🧹

**Tidy up your GitHub** — a browser extension that declutters GitHub issues, enhances project navigation, and helps you focus on what matters. Works in **Edge**, **Chrome**, and **Safari**.

## What it does

### 🧹 Issue Noise Toggle (issues & PRs)

Hides noisy system-generated timeline events so you can focus on the conversation:

- **Project board events** — "added this to Project", "moved this to Column"
- **Title changes** — "changed the title X → Y"
- **Label events** — "added/removed Label"
- **Assignment changes** — "assigned/unassigned User"
- **Milestone events** — "added/removed Milestone"
- **Cross-references** — "mentioned this issue"
- **And more** — lock, pin, transfer, duplicate, branch events

A floating toggle button appears in the bottom-right. Your show/hide preference persists across pages.

### 📂 Repo Navigator (project pages)

On GitHub Project pages (`/orgs/{org}/projects/{id}`), a **Repos** button appears showing all repositories referenced by items in the project. Click it to open a panel listing every repo with item counts, making it easy to jump between the 5+ repos that a project often spans.

## How it works

**On issue/PR pages:** A floating 🧹 toggle button appears in the bottom-right corner. Click it to show/hide system noise. When hidden, a subtle "⋯ N system events hidden" bar replaces consecutive noise items.

**On project pages:** A floating 📂 Repos button appears. Click it to open a dropdown listing all repositories referenced by project items, sorted by item count. Each entry links directly to the repo.

## Quick Install via Copilot CLI

If you have [GitHub Copilot CLI](https://github.com/github/copilot-cli), run these commands in your terminal:

**Step 1 — Add the marketplace (one-time):**

```
copilot plugin marketplace add msr-central/github-issue-cleaner
```

**Step 2 — Install the plugin:**

```
copilot plugin install git-tidy@git-tidy
```

**Step 3 — Launch Copilot CLI and install the extension:**

```
copilot
```

Then type: `install git-tidy extension`

Copilot will clone the repo, open Edge, and walk you through loading the extension.

To update later, run `copilot plugin update git-tidy` then tell Copilot: `update git-tidy extension`

## Manual Install in Edge

1. Open `edge://extensions/`
2. Enable **Developer mode** (toggle in the bottom-left)
3. Click **Load unpacked**
4. Select this folder (`git-tidy`)
5. Navigate to any GitHub issue — GitTidy appears automatically

## Install in Chrome

Same steps but at `chrome://extensions/`.

## Install in Safari

Safari requires converting the extension into an Xcode project using Apple's tools. You need **macOS 14+** and **Xcode 15+**.

### Option A: Use the helper script

```bash
cd git-tidy
chmod +x convert-safari.sh
./convert-safari.sh
```

### Option B: Manual conversion

```bash
xcrun safari-web-extension-converter /path/to/git-tidy \
  --app-name "GitTidy" \
  --bundle-identifier "com.git-tidy.extension"
```

### Then in Xcode

1. Open the generated `.xcodeproj`
2. Set your development team under **Signing & Capabilities**
3. Build & Run (**⌘R**) — this installs the extension into Safari
4. Open **Safari → Settings → Extensions** and enable **GitTidy**

### Safari notes

- Requires Safari 17+ (macOS Sonoma / iOS 17 or later)
- The extension uses Manifest V3, which Safari fully supports
- All APIs used (content scripts, localStorage, MutationObserver) are Safari-compatible
- For iOS Safari, the converter can generate a universal app targeting both macOS and iOS

## Development

```bash
git clone https://github.com/j-dahl/git-tidy.git
cd git-tidy
```

Edit `content.js` to adjust which timeline events are classified as noise. The `NOISE_SELECTORS` array at the top of the file controls which GitHub octicon-based events get hidden.

## Project structure

```
├── manifest.json          # Extension manifest (Manifest V3)
├── content.js             # Content script — noise detection & toggle logic
├── styles.css             # Styles for toggle button & collapsed bars
├── convert-safari.sh      # Safari conversion helper (requires macOS + Xcode)
├── icons/                 # Extension icons (16/48/128px)
└── .github/               # Repo policies (ACL, compliance, JIT)
```
