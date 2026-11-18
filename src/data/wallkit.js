// 벽 키트(assets/rocks/이름.glb — tools/walls/make_walls.py 가 만들고 이 파일도 그때 다시 쓴다): 방 둘레(벽 밑선)를 따라 이어 붙이고 휘는 바위 벽 조각
//   한 칸: x -0.5~0.5(±0.62 까지 겹침) · y 위(0 = 바닥) · +z 방 안쪽(앞면). 게임에서 x·z 에 칸 길이(기본 230)를 곱하고, y 는 목표 높이 / (h · 칸 길이) 로 늘이거나 줄인다
//   kind: tall(먼 쪽 높은 벽) · mid(옆 벽 중간) · low(낮은 벽·벽 끝) · pillar(굴 입구 양옆·모서리에 통째로 세우는 기둥, 원점 = 밑동 가운데, 지름 약 0.75) · h: 실제 높이(최대 y)
export const WALL_KIT = {
  cliffTallA: { kind: 'tall', h: 1.448, label: '높은 벽 A' },
  cliffTallB: { kind: 'tall', h: 1.504, label: '높은 벽 B(넓은 턱)' },
  cliffTallC: { kind: 'tall', h: 1.549, label: '높은 벽 C(계단 윗선)' },
  cliffTallD: { kind: 'tall', h: 1.445, label: '높은 벽 D(층진 절벽)' },
  cliffMidA: { kind: 'mid', h: 0.761, label: '중간 벽 A' },
  cliffMidB: { kind: 'mid', h: 0.786, label: '중간 벽 B' },
  cliffLowA: { kind: 'low', h: 0.385, label: '낮은 벽 A' },
  cliffLowB: { kind: 'low', h: 0.358, label: '낮은 벽 B' },
  cliffPillarA: { kind: 'pillar', h: 1.591, label: '바위 기둥 A' },
  cliffPillarB: { kind: 'pillar', h: 1.595, label: '바위 기둥 B' },
};
