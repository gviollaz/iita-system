#!/bin/bash
# =============================================================================
# IITA System — Initial Subtree Setup
# =============================================================================
# Run this ONCE to incorporate the CRM frontend and Make.com scenarios
# into the iita-system monorepo as git subtrees.
#
# Prerequisites:
#   - Git installed
#   - You must be in the root of iita-system repo
#   - You must have push access to gviollaz/iita-system
#   - The directories apps/crm-frontend/ and automations/make-scenarios/
#     must NOT already exist
#
# Usage:
#   cd /path/to/iita-system
#   bash scripts/setup-subtrees.sh
# =============================================================================

set -e

echo "=== IITA System — Subtree Setup ==="
echo ""

# Verify we're in the right repo
if [ ! -f "AGENTS.md" ] || [ ! -d "database" ]; then
    echo "ERROR: This script must be run from the root of iita-system repo."
    echo "  Expected to find AGENTS.md and database/ directory."
    exit 1
fi

# Check that target directories don't already exist
if [ -d "apps/crm-frontend" ]; then
    echo "ERROR: apps/crm-frontend/ already exists."
    echo "  If you want to re-add the subtree, remove it first:"
    echo "    git rm -r apps/crm-frontend && git commit -m 'remove crm-frontend subtree'"
    exit 1
fi

if [ -d "automations/make-scenarios" ]; then
    echo "ERROR: automations/make-scenarios/ already exists."
    echo "  If you want to re-add the subtree, remove it first:"
    echo "    git rm -r automations/make-scenarios && git commit -m 'remove make-scenarios subtree'"
    exit 1
fi

echo "[1/4] Adding CRM Frontend (IITA-Proyectos/iitacrm)..."
git subtree add --prefix=apps/crm-frontend \
    https://github.com/IITA-Proyectos/iitacrm.git main \
    --squash
echo "  ✓ CRM Frontend added to apps/crm-frontend/"
echo ""

echo "[2/4] Adding Make.com Scenarios (gviollaz/iita-make-scenarios)..."
git subtree add --prefix=automations/make-scenarios \
    https://github.com/gviollaz/iita-make-scenarios.git main \
    --squash
echo "  ✓ Make Scenarios added to automations/make-scenarios/"
echo ""

echo "[3/4] Verifying structure..."
if [ -d "apps/crm-frontend/src" ] && [ -f "apps/crm-frontend/package.json" ]; then
    echo "  ✓ apps/crm-frontend/ looks good (has src/ and package.json)"
else
    echo "  ⚠ Warning: apps/crm-frontend/ might be incomplete"
fi

if [ -f "automations/make-scenarios/make_sync.py" ] && [ -d "automations/make-scenarios/snapshots" ]; then
    echo "  ✓ automations/make-scenarios/ looks good (has make_sync.py and snapshots/)"
else
    echo "  ⚠ Warning: automations/make-scenarios/ might be incomplete"
fi
echo ""

echo "[4/4] Done!"
echo ""
echo "Next steps:"
echo "  1. git push origin main"
echo "  2. Verify on GitHub that apps/ and automations/ directories appear"
echo "  3. To sync in the future, run:  bash scripts/sync-subtrees.sh"
echo ""
echo "The GitHub Action .github/workflows/sync-subtrees.yml will also"
echo "auto-sync daily or on manual trigger."
