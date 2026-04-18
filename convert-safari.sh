#!/bin/bash
# =============================================================
#  convert-safari.sh
#  Converts the GitHub Issue Cleaner extension into a Safari
#  Web Extension Xcode project using Apple's converter tool.
#
#  Requirements:
#    - macOS 14 (Sonoma) or later
#    - Xcode 15+ with command-line tools installed
#    - Safari 17+
#
#  Usage:
#    chmod +x convert-safari.sh
#    ./convert-safari.sh
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$SCRIPT_DIR"
OUTPUT_DIR="$SCRIPT_DIR/safari-xcode-project"

echo "🧹 GitHub Issue Cleaner — Safari Conversion"
echo "============================================"
echo ""

# Check for macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌  This script must be run on macOS."
  echo "    Safari Web Extensions require Xcode and the"
  echo "    safari-web-extension-converter tool."
  exit 1
fi

# Check for Xcode command-line tools
if ! xcrun --find safari-web-extension-converter &>/dev/null; then
  echo "❌  safari-web-extension-converter not found."
  echo "    Install Xcode 15+ and run: xcode-select --install"
  exit 1
fi

echo "✅  macOS detected"
echo "✅  safari-web-extension-converter found"
echo ""
echo "Converting extension at: $EXT_DIR"
echo "Output Xcode project:    $OUTPUT_DIR"
echo ""

# Run the converter
xcrun safari-web-extension-converter "$EXT_DIR" \
  --project-location "$OUTPUT_DIR" \
  --app-name "GitHub Issue Cleaner" \
  --bundle-identifier "com.git-tidy.extension" \
  --no-prompt

echo ""
echo "✅  Xcode project created at: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Open the Xcode project:  open \"$OUTPUT_DIR/GitHub Issue Cleaner/GitHub Issue Cleaner.xcodeproj\""
echo "  2. Select your development team in Xcode signing settings"
echo "  3. Build & Run (⌘R) to install in Safari"
echo "  4. Enable the extension in Safari → Settings → Extensions"
echo ""
