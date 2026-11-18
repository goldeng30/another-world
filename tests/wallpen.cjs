// 벽 뚫림 점검: 주인공이 갈 수 있는 곳(방 경계·부딪힘 원 밖)마다 몸 반지름(22) 안을 위에서 아래로 광선 — 바닥보다 30 넘게 높은 곳에서 벽에 닿으면 몸이 바위 속. node tests/wallpen.cjs (0이어야 통과)
const open = require('./harness.cjs');
(async () => { const { b, p } = await open({ dpr: 1 });
  const r = await p.evaluate(() => { const D = __dbg, G = D.G, W = G.world, RC = new THREE.Raycaster(), walls = []; window.__pause = true;
    W.root.traverse(o => { if (o.isMesh && /^wall/.test(o.name)) walls.push(o); });
    const bad = []; let n = 0;
    for (let v = -400; v <= 1000; v += 15) for (let u = -600; u <= 600; u += 15) { const [x, z] = W.world(u, v), pt = new THREE.Vector3(x, 0, z); W.clamp(pt); const [cu, cv] = W.uv(pt.x, pt.z); if (Math.hypot(cu - u, cv - v) > 1) continue;   // 갈 수 있는 곳만(clamp 가 안 미는 곳)
      if (W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 16)) continue; n++;   // 주인공 반지름 16 까지 밀려남
      let worst = 0; for (const [du, dv] of [[0, 0], [22, 0], [-22, 0], [0, 22], [0, -22], [16, 16], [-16, 16], [16, -16], [-16, -16]]) { const [xx, zz] = W.world(u + du, v + dv); RC.set(new THREE.Vector3(xx, 900, zz), new THREE.Vector3(0, -1, 0)); const h = RC.intersectObjects(walls, false)[0]; const g = W.groundY(xx, zz); if (h && h.point.y > g + 30) worst = Math.max(worst, h.point.y - g); }   // 몸 반지름 22 안
      if (worst) bad.push([u, v, Math.round(worst)]); }
    return { n, bad }; });
  console.log(JSON.stringify({ 걸을수있는곳: r.n, 벽속: r.bad.length, 자리: r.bad.slice(0, 40) })); await b.close(); process.exit(r.bad.length ? 1 : 0); })();
