#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       tgrid Release Build            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
TARGET="${1:-current}"

print_usage() {
  echo "Usage: $0 [target]"
  echo ""
  echo "Targets:"
  echo "  mac       Build for macOS (dmg + zip)"
  echo "  win       Build for Windows (nsis + zip)"
  echo "  linux     Build for Linux (AppImage + deb + tar.gz)"
  echo "  all       Build for all platforms"
  echo "  current   Build for current platform (default)"
  echo ""
}

# Generate placeholder icon if missing
generate_placeholder_icon() {
  if ! command -v convert &> /dev/null && ! command -v sips &> /dev/null; then
    echo -e "${YELLOW}Warning: No icon files found in build/. Builds may use default Electron icon.${NC}"
    return
  fi

  if [[ "$(uname)" == "Darwin" ]] && command -v sips &> /dev/null; then
    # Generate a simple 1024x1024 PNG on macOS using built-in tools
    if [ ! -f build/icon.png ]; then
      echo -e "${YELLOW}Generating placeholder icon...${NC}"
      python3 -c "
import struct, zlib

def create_png(width, height, color):
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\\x89PNG\\r\\n\\x1a\\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\\x00'
        for x in range(width):
            raw += bytes(color)
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

with open('build/icon.png', 'wb') as f:
    f.write(create_png(256, 256, (26, 26, 40)))
" 2>/dev/null || true
    fi
  fi
}

# Check dependencies
echo -e "${CYAN}[1/4] Checking dependencies...${NC}"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
else
  echo "Dependencies OK"
fi

# Generate icons if needed
echo -e "${CYAN}[2/4] Checking build assets...${NC}"
if [ ! -f build/icon.png ]; then
  generate_placeholder_icon
  echo -e "${YELLOW}Tip: Replace build/icon.png with your own icon (512x512+ PNG).${NC}"
else
  echo "Build assets OK"
fi

# Clean previous builds
echo -e "${CYAN}[3/4] Cleaning previous builds...${NC}"
rm -rf release/
echo "Cleaned release/"

# Build
echo -e "${CYAN}[4/4] Building...${NC}"
echo ""

case "$TARGET" in
  mac)
    echo -e "${GREEN}Building for macOS...${NC}"
    npx electron-builder --mac --publish never
    ;;
  win)
    echo -e "${GREEN}Building for Windows...${NC}"
    npx electron-builder --win --publish never
    ;;
  linux)
    echo -e "${GREEN}Building for Linux...${NC}"
    npx electron-builder --linux --publish never
    ;;
  all)
    echo -e "${GREEN}Building for all platforms...${NC}"
    echo -e "${YELLOW}Note: Cross-platform builds may require additional tools.${NC}"
    echo -e "${YELLOW}  macOS → Windows: requires Wine${NC}"
    echo -e "${YELLOW}  macOS → Linux: requires Docker or native Linux${NC}"
    echo ""
    npx electron-builder --mac --win --linux --publish never
    ;;
  current)
    echo -e "${GREEN}Building for current platform...${NC}"
    npx electron-builder --publish never
    ;;
  -h|--help|help)
    print_usage
    exit 0
    ;;
  *)
    echo -e "${RED}Unknown target: $TARGET${NC}"
    print_usage
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Build Complete!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo "Output: release/"
ls -lh release/ 2>/dev/null || true
