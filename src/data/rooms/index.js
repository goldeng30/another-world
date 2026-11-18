// 방 목록: 새 방은 파일 하나(cave01.js 모양)를 만들고 여기에 더한다
import cave01 from './cave01.js';
import gallery from './gallery.js';

export const ROOMS = { cave01, gallery };
export const ROOM_CYCLE = ['cave01', 'gallery'];   // 방 바꾸기 순서(전투방 ↔ 전시장)
