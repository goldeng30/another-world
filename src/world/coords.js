// 화면 기준 좌표: u = 화면 오른쪽, v = 화면 위(카메라에서 먼 쪽). 카메라가 +x,+z 쪽(45°)에서 내려다봐서 배치는 이 좌표로 한다
import { V } from '../core/math.js';
export const RT = [Math.SQRT1_2, -Math.SQRT1_2], FW = [-Math.SQRT1_2, -Math.SQRT1_2];
export const W2 = (u, v) => [u * RT[0] + v * FW[0], u * RT[1] + v * FW[1]];
export const U2 = (x, z) => [x * RT[0] + z * RT[1], x * FW[0] + z * FW[1]];
export const WV = (u, v, y = 0) => { const [x, z] = W2(u, v); return V(x, y, z); };
