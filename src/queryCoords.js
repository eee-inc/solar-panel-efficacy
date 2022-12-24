export default async function queryCoords(driver, x, y, roads) {
  const session = driver.session();
  const is_in_bounds = `n.x > ${x[0]} AND n.x < ${x[1]} AND n.y > ${y[0]} AND n.y < ${y[1]}`;
  const is_on_roads = roads?.map((road) => `n.fName = ${road}`).join("OR ");
  const query = `MATCH (n: Point) WHERE ${is_in_bounds} ${
    roads ? `AND (${is_on_roads})` : ""
  }
    RETURN n.x AS x, n.y AS y, n.z AS z, n.angle AS angle`;

  const res = await session
    .executeRead((tx) => tx.run(query))
    .then((results) =>
      results.records.map((record) => ({
        x: record.get("x"),
        y: record.get("y"),
        z: record.get("z"),
        angle: record.get("angle"),
      }))
    );

  await driver.close();
  return res;
}
