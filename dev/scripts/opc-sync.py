#!/usr/bin/env python3
"""opc-sync: stdlib-only OpenCode configuration sync tool.

Backward-compatible shim. Import and run the real implementation from
dev/scripts/opc-sync/ package so existing callers (setup scripts, README,
tests) keep working without path changes.
"""

import os
import sys

# Ensure the directory containing this shim is on sys.path so the
# opc_sync package (dev/scripts/opc-sync/) can be imported.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from opc_sync.cli import main

if __name__ == "__main__":
    sys.exit(main())
