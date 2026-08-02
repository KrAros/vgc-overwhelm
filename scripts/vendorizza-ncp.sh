#!/usr/bin/env bash
#
# scripts/vendorizza-ncp.sh
#
# Riempie `vendor/ncp/` copiando nove file dal calculator NCP, al commit fissato.
#
#   bash scripts/vendorizza-ncp.sh
#
# Va lanciato UNA VOLTA. Dopo, quei file vanno committati nel repo: sono la
# copia di riferimento, e devono restare stabili anche se NCP viene aggiornato
# (altrimenti l'oracolo cambia sotto i piedi ai golden già raccolti).
#
# Se un giorno vorrai aggiornare NCP: cambia COMMIT qui sotto, rilancia,
# rigenera con `npm run ncp:gen` e guarda il diff della fixture caso per caso.
#
# Nota: questo script non serve nel giro quotidiano. I test leggono la fixture
# `src/__tests__/fixtures/ncp-golden.json`, che è già nel repo. Il vendor serve
# solo per rigenerarla e per il test che verifica che l'harness sia guidato bene.

set -euo pipefail

REPO="https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator.git"
COMMIT="7919130"

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINAZIONE="$RADICE/vendor/ncp"
TEMPORANEA="$(mktemp -d)"
trap 'rm -rf "$TEMPORANEA"' EXIT

FILE=(
  type_data.js
  nature_data.js
  stat_data.js
  pokedex.js
  move_data.js
  ability_data.js
  item_data.js
  damage_MASTER.js
  damage_SV.js
)

echo "Clono NCP…"
git clone --quiet "$REPO" "$TEMPORANEA/ncp"
git -C "$TEMPORANEA/ncp" checkout --quiet "$COMMIT"

EFFETTIVO="$(git -C "$TEMPORANEA/ncp" rev-parse --short HEAD)"
if [ "$EFFETTIVO" != "$COMMIT" ]; then
  echo "Il commit richiesto ($COMMIT) non corrisponde a quello ottenuto ($EFFETTIVO)." >&2
  exit 1
fi

mkdir -p "$DESTINAZIONE"
for f in "${FILE[@]}"; do
  cp "$TEMPORANEA/ncp/script_res/$f" "$DESTINAZIONE/$f"
  printf '  %-20s %6s KB\n' "$f" "$(( $(wc -c < "$DESTINAZIONE/$f") / 1024 ))"
done

# La licenza va conservata insieme al codice: è la condizione della MIT.
cp "$TEMPORANEA/ncp/LICENSE" "$DESTINAZIONE/LICENSE"

echo
echo "vendor/ncp popolato dal commit $COMMIT."
echo "Ora: npm run ncp:gen   per rigenerare la fixture."
