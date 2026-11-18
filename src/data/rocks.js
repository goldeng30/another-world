// 바위 에셋(assets/rocks/이름.glb — tools/rocks/make_rocks.py 로 만든다): 방 데이터 place 에 { rock: '이름', at: [u, v], s: 지름, turn, tilt, col } 로 배치
//   질감은 그 방의 바위 질감(surfaces.rock)을 삼면 투영으로 입힌다(이음매 없음) · s 를 안 주면 아래 크기 · col: false 면 부딪힘 없음
// 매달린 돌(종유석 · 원점이 윗면): stalacA·B·C(무리)·D(긴 것) — 방 데이터 stalactites 로 먼 쪽 벽 위에 매단다(바닥 배치용 목록에는 안 넣음)
export const ROCK_KIT = {
  boulderA: { s: 120, label: '큰 바위 A' },
  boulderB: { s: 130, label: '큰 바위 B(납작·결)' },
  boulderC: { s: 110, label: '큰 바위 C(모남)' },
  slabA: { s: 140, label: '넓적 바위 A' },
  slabB: { s: 140, label: '넓적 바위 B(결)' },
  spireA: { s: 70, label: '선 바위' },
  pileA: { s: 110, label: '돌무더기 A' },
  pileB: { s: 130, label: '돌무더기 B' },
  chunkA: { s: 45, label: '돌덩이 A' },
  chunkB: { s: 45, label: '돌덩이 B' },
  mossA: { s: 120, label: '이끼 바위 A' },
  mossB: { s: 140, label: '이끼 넓적 바위' },
  mossC: { s: 90, label: '이끼 바위 C(둥긂)' },
  mossD: { s: 80, label: '이끼 바위 D(높음)' },
};
