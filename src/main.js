import "dotenv/config";
import { driver, auth } from "neo4j-driver";
import { profileCoordSet } from "./profileCoordSet.js";
import queryCoords from "./queryCoords.js";
import { DateTime } from "luxon";
import fs from "fs";
import { max, mean, median, min, std, round } from "mathjs";

function loop(dateSeed, coords, headers, dayOffset, statStream) {
  const iterableDate = dateSeed.plus({ days: dayOffset });

  const s = [];
  const t = [];
  const writeStream = fs.createWriteStream(
    `./results/${iterableDate.toISODate()}_toledo.csv`
  );
  writeStream.write(headers.join(",") + "\n");
  const resStream = profileCoordSet(coords, iterableDate);
  resStream.on("data", (data) => {
    const json = JSON.parse(data);
    s.push(json.irrS);
    t.push(json.irrT);
    const line = Object.values(json).join(",") + "\n";
    writeStream.write(line);
  });

  resStream.on("end", () => {
    writeStream.end();
  });

  resStream.on("close", () => {
    const stats = {
      top: {
        min: round(min(t), 3),
        max: round(max(t), 3),
        mean: round(mean(t), 3),
        median: round(median(t), 3),
        std: round(std(t), 3),
      },
      side: {
        min: round(min(s), 3),
        max: round(max(s), 3),
        mean: round(mean(s), 3),
        median: round(median(s), 3),
        std: round(std(s), 3),
      },
    };

    statStream[0].write(
      `${iterableDate.toISODate()}` + Object.values(stats.top).join(",") + "\n"
    );
    statStream[1].write(
      `${iterableDate.toISODate()}` + Object.values(stats.side).join(",") + "\n"
    );

    fs.writeFileSync(
      `./results/${iterableDate.toISODate()}_toledo_desc.json`,
      JSON.stringify(stats, undefined, 1)
    );
  });
}

const neoUri = process.env.NEOURI;
const neoPass = process.env.NEOPASS;
const neoUser = process.env.NEOUSER;
// const driverInst = driver(neoUri, auth.basic(neoUser, neoPass));

const zone = "America/Chicago";
const dateObj = {
  year: 2022,
  ordinal: 170,
  hour: 0,
  minute: 0,
  second: 0,
};
const dateOpts = {
  zone,
};
const dateSeed = DateTime.fromObject(dateObj, dateOpts);

// const coords = await queryCoords(driverInst, [-123, -118], [34, 39]);

const headers = [
  "x",
  "y",
  "z",
  "angle",
  "azimuth",
  "elevation",
  "julianDate",
  "dateTime",
  "zoneOffset",
  "incT",
  "incS",
  "irrT",
  "irrS",
];

const trendHeaders = ["date", "min", "max", "mean", "median", "std"];
const topStatStream = fs.createWriteStream(`./results/_top_toledo.csv`);
topStatStream.write(trendHeaders.join(",") + "\n");
const sideStatStream = fs.createWriteStream(`./results/_side_toledo.csv`);
sideStatStream.write(trendHeaders.join(",") + "\n");

for (let i = 0; i < 20; i++) {
  // loop(dateSeed, coords, headers, i, [topStatStream, sideStatStream]);
  loop(dateSeed, [{ x: 41, y: 83, z: 614, angle: 10 }], headers, i, [
    topStatStream,
    sideStatStream,
  ]);
}
