---
name: git-tidy
version: "1.3.0"
description: >
  Install and manage the GitTidy browser extension for Edge/Chrome.
  GitTidy cleans up noisy GitHub issue timelines, adds project badges,
  repo navigation, and age indicators.
  Triggers on: "install git-tidy", "install extension", "setup git-tidy",
  "update git-tidy", "reload extension", "git-tidy".
argument-hint: 'install git-tidy, update git-tidy extension, reload extension'
homepage: https://github.com/msr-central/github-issue-cleaner
repository: https://github.com/msr-central/github-issue-cleaner
author: j-dahl
license: MIT
user-invocable: true
metadata:
  version: "1.3.0"
---

# GitTidy — Extension Installer

Installs, updates, and manages the GitTidy browser extension for Microsoft Edge (or Chrome).

## When to use this skill

- User says "install git-tidy", "setup the extension", "install extension"
- User says "update git-tidy", "reload extension"
- User wants to try the GitTidy browser extension

## Prerequisites

- **Microsoft Edge** or **Google Chrome** installed
- **Git** available on PATH
- **playwright-cli** installed globally: `npm install -g @anthropic-ai/playwright-cli@latest`

## Instructions

### Step 1: Locate or clone the extension source

Check if the extension source already exists. Look in common locations:

```powershell
# Windows
$candidates = @(
  "$env:USERPROFILE\projects\git-tidy",
  "$env:USERPROFILE\projects\github-issue-cleaner",
  "C:\projects\git-tidy",
  "C:\projects\github-issue-cleaner"
)

# macOS / Linux
# ~/projects/git-tidy, ~/projects/github-issue-cleaner
```

```bash
# Cross-platform check
for dir in "$candidates"; do
  if [ -f "$dir/manifest.json" ]; then
    echo "Found at: $dir"
    break
  fi
done
```

**If not found**, clone it:

```powershell
# Windows
$extDir = "$env:USERPROFILE\projects\git-tidy"
git clone https://github.com/msr-central/github-issue-cleaner.git $extDir
```

```bash
# macOS / Linux
git clone https://github.com/msr-central/github-issue-cleaner.git ~/projects/git-tidy
```

**If found**, pull latest:

```bash
cd <extension-dir>
git pull origin main
```

### Step 2: Install/reload the extension in Edge

Use `playwright-cli` with `--browser msedge` to automate the installation:

```powershell
# Open Edge extensions page
playwright-cli -s=gittidy-install open "edge://extensions/" --persistent --headed --browser msedge
```

Wait for the page to load, then take a snapshot to check the current state.

#### If extension is NOT yet installed:

1. Enable Developer Mode if not already enabled:
```powershell
playwright-cli -s=gittidy-install snapshot --persistent
# Look for "Developer mode" toggle — click it if not already on
```

2. The "Load unpacked" button requires a native file dialog which Playwright can't automate. Instead, **instruct the user**:

> **Quick manual step:** Click "Load unpacked" on the extensions page, then select the folder:
> `<extension-dir>` (the path from Step 1)

3. After the user confirms they loaded it, verify:
```powershell
playwright-cli -s=gittidy-install snapshot --persistent
# Look for "GitTidy" in the extensions list
```

#### If extension IS already installed (update/reload):

Find the GitTidy extension card and click the reload button:

```powershell
playwright-cli -s=gittidy-install snapshot --persistent
# Find the reload/refresh button on the GitTidy extension card
# The reload button is typically an SVG icon button near the extension entry
playwright-cli -s=gittidy-install eval "(function(){var cards=document.querySelectorAll('extensions-item');for(var c of cards){var sr=c.shadowRoot;if(!sr)continue;var name=sr.querySelector('#name');if(name&&name.textContent.indexOf('GitTidy')>=0){var reload=sr.querySelector('#dev-reload-button');if(reload){reload.click();return 'reloaded';}}}return 'not found';})()" --persistent
```

### Step 3: Verify the extension is working

Navigate to a GitHub issue page to test:

```powershell
playwright-cli -s=gittidy-install goto "https://github.com/microsoft/vscode/issues/1" --persistent
playwright-cli -s=gittidy-install snapshot --persistent
# Look for the GitTidy toggle button (ghic-toggle-btn) in the bottom-right
```

### Step 4: Close the browser

```powershell
playwright-cli -s=gittidy-install close --persistent
```

Report success to the user with the extension directory path and a reminder to reload after future updates.

## Update workflow

When the user says "update git-tidy":

1. `cd <extension-dir> && git pull origin main`
2. Open `edge://extensions/`
3. Click the reload button on the GitTidy card
4. Verify on a GitHub page

## Notes

- The extension works on any `github.com` page — issues, PRs, and project board panes
- Preferences are stored in `localStorage` on github.com and persist across sessions
- The extension makes zero network requests and collects no data
