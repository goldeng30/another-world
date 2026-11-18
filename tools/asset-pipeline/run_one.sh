#!/usr/bin/env bash
# 한 덩어리 소품 만들기: ./run_one.sh 이름 목표면수 질감크기
#   입력: $IN/이름/이름_src.glb (Tripo 원본)   출력: assets/props/이름.glb · 이름_base.webp · 이름_nrm.webp
set -e; cd "$(dirname "$0")"; ROOT=../..; IN=${IN:-$ROOT/work/props_in}; OUT=${OUT:-$ROOT/assets/props}; TMP=${TMP:-$ROOT/work/tmp}; PY=${PY:-python3}; GP=${GP:-npx -y gltfpack@0.21.0}
name=$1; tgt=$2; tex=${3:-512}; mkdir -p "$TMP" "$OUT"; hi=$IN/$name/${name}_src.glb; npz=$TMP/split_$name.npz
$PY -I -c "exec(open('bake.py', encoding='utf-8').read().rsplit('\\nmain()', 1)[0]); m = load_mesh('$hi'); np.savez('$npz', faces=np.arange(len(m['F'])))"   # 모든 면
$PY -I subglb.py "$hi" "$npz" "$TMP/${name}_hi.glb" > /dev/null
n=$($PY -I -c "import numpy as np; print(len(np.load('$npz')['faces']))"); r=$(python3 -c "print(min(1, $tgt / $n))")
$GP -i "$TMP/${name}_hi.glb" -o "$TMP/${name}_lo.glb" -si $r -noq > /dev/null
$PY -I bake.py "$hi" "$TMP/${name}_lo.glb" "$OUT/$name" $tex "$npz" | tail -1
