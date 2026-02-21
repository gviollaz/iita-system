#!/bin/bash
# =============================================================================
# IITA System — Sync Subtrees
# =============================================================================
# Pulls latest changes from the original repos into the subtrees.
# Can be run manually or by the GitHub Action.
#
# Usage:
#   cd /path/to/iita-system
#   bash scripts/sync-subtrees.sh
# =============================================================================

set -e

echo "=== IITA System — Subtree Sync ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Verify we're in the right repo
if [ ! -f "AGENTS.md" ] || [ ! -d "database" ]; then
    echo "ERROR: This script must be run from the root of iita-system repo."
    exit 1
fi

SYNC_FAILED=0

# Sync CRM Frontend
if [ -d "apps/crm-frontend" ]; then
    echo "[1/2] Syncing CRM Frontend from IITA-Proyectos/iitacrm..."
    if git subtree pull --prefix=apps/crm-frontend \
        https://github.com/IITA-Proyectos/iitacrm.git main \
        --squash -m "sync: update crm-frontend from IITA-Proyectos/iitacrm"; then
        echo "  ✓ CRM Frontend synced"
    else
        echo "  ✗ CRM Frontend sync failed (possibly already up to date)"
        SYNC_FAILED=1
    fi
else
    echo "[1/2] SKIP: apps/crm-frontend/ does not exist. Run setup-subtrees.sh first."
    SYNC_FAILED=1
fi
echo ""

# Sync Make.com Scenarios
if [ -d "automations/make-scenarios" ]; then
    echo "[2/2] Syncing Make Scenarios from gviollaz/iita-make-scenarios..."
    if git subtree pull --prefix=automations/make-scenarios \
        https://github.com/gviollaz/iita-make-scenarios.git main \
        --squash -m "sync: update make-scenarios from gviollaz/iita-make-scenarios"; then
        echo "  ✓ Make Scenarios synced"
    else
        echo "  ✗ Make Scenarios sync failed (possibly already up to date)"
        SYNC_FAILED=1
    fi
else
    echo "[2/2] SKIP: automations/make-scenarios/ does not exist. Run setup-subtrees.sh first."
    SYNC_FAILED=1
fi
echo ""

if [ $SYNC_FAILED -eq 0 ]; then
    echo "=== All subtrees synced successfully ==="
else
    echo "=== Sync completed with warnings (some subtrees may already be up to date) ==="
fi
