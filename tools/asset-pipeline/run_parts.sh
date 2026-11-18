#!/usr/bin/env bash
# 한 장에 여러 소품이 든 원본에서 하나씩 만들기: ./run_parts.sh 이름:원본폴더:part번호:목표면수:질감크기 ...
#   먼저 python split.py 원본.glb work/tmp/split_원본폴더 로 덩어리 번호를 확인한다
#   입력: $IN/원본폴더/*.glb   출력: assets/props/이름.glb · 이름_base.webp · 이름_nrm.webp
set -e; cd "$(dirname "$0")"; ROOT=../..; IN=${IN:-$ROOT/work/props_in}; OUT=${OUT:-$ROOT/assets/props}; TMP=${TMP:-$ROOT/work/tmp}; PY=${PY:-python3}; GP=${GP:-npx -y gltfpack@0.21.0}
mkdir -p "$TMP" "$OUT"
for spec in "$@"; do IFS=: read name z part tgt tex <<< "$spec"; hi=$(ls $IN/$z/*.glb | head -1); npz=$TMP/split_$z/part$part.npz
  $PY -I subglb.py "$hi" "$npz" "$TMP/${name}_hi.glb" > /dev/null
  n=$($PY -I -c "import numpy as np; print(len(np.load('$npz')['faces']))"); r=$(python3 -c "print(min(1, $tgt / $n))")
  $GP -i "$TMP/${name}_hi.glb" -o "$TMP/${name}_lo.glb" -si $r ${SA:--sa} -noq > /dev/null
  $PY -I bake.py "$hi" "$TMP/${name}_lo.glb" "$OUT/$name" ${tex:-512} "$npz" | tail -1; rm -f "$TMP/${name}_hi.glb"; done
