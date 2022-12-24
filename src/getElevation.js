import "dotenv/config";
import { driver, auth } from "neo4j-driver";
import throttledQueue from "throttled-queue";
import https from "https";

import i5 from "../i5_points.json" assert { type: "json" };
import { exit } from "process";

const throttle = throttledQueue(50, 1000);

(async () => {
  const neoUri = process.env.NEOURI;
  const neoPass = process.env.NEOPASS;
  const neoUser = process.env.NEOUSER;
  const driverInst = driver(neoUri, auth.basic(neoUser, neoPass));

  const features = i5.features;
  const limit = features.length;

  const loop = (inst, lim) => {
    let count = inst;
    for (let i = inst; i <= lim; i++) {
      const session = driverInst.session();
      const feature = features[i];
      const x = feature.geometry.coordinates[0];
      const y = feature.geometry.coordinates[1];
      const angle = feature.properties.angle;
      const fName = feature.properties.FULLNAME;
      const rtType = feature.properties.RTTYP;
      let data;
      let z;
      const getUri = `https://nationalmap.gov/epqs/pqs.php?x=${x}&y=${y}&units=Meters&output=json`;

      throttle(() => {
        const get = https.get(getUri, (res) => {
          res.on("data", async (d) => {
            data = JSON.parse(d);

            z =
              data.USGS_Elevation_Point_Query_Service.Elevation_Query.Elevation;

            session
              .executeWrite((tx) =>
                tx.run(
                  `MERGE (n: Point {x: ${x}, y: ${y}, z: ${z}, angle: ${angle}, rName: "${fName}", rType: "${rtType}"})`
                )
              )
              .then(async (_) => {
                count += 1;
                await session.close();
                console.log("success", count);
                if (count === limit) {
                  await driverInst.close();
                  exit();
                }
              });
          });
        });
        get.on("error", async () => {
          await session.close();
          console.log("error");
          loop(count, limit);
        });
      });
    }
  };

  loop(8300, limit);
})();
