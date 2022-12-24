import { abs, acos, cos, pi, pow, round, sin, sqrt, unit } from "mathjs";
import { Stream } from "stream";
import {
  calcAzEl,
  getJD,
  calcTimeJulianCent,
  calcSunriseSet,
  timeString,
} from "./solar-calcs.js";

const useSunriseSet = (rise, jday, point, zone) =>
  timeString(calcSunriseSet(rise, jday, point.y, point.x, zone).timelocal, 2)
    .split(":")
    .map((n) => Number(n));

const calcIncidence = (az, el) => {
  const a = pow(sin(unit(90 - az, "deg")), 2);
  const b = pow(sin(unit(az, "deg")), 2);
  const c = pow(sin(unit(90 - az, "deg")) * sin(unit(el, "deg")), 2);
  // irradiance is cos of incidence. todo: directly calculate irradiance and then calculate incidence by arccos
  const gamma = (acos((1 + a - b - 2 * c) / (2 * sqrt(a - c))) * 180) / pi;

  return gamma;
};

const convD = (deg) => (deg > 180 ? 360 - deg : deg);

// calculate the azimuth and elevation for every point, each hour between local apparent sunrise and sunset
export function profileCoordSet(coords, dateSeed) {
  const procStream = new Stream.Readable({
    read() {
      for (let i = 0; i < coords.length; i++) {
        // for (let i = 0; i < 1; i++) {
        const point = coords[i];

        const jday = getJD(dateSeed.year, dateSeed.month, dateSeed.day);
        const sunrise = useSunriseSet(1, jday, point, dateSeed.o);
        const sunset = useSunriseSet(0, jday, point, dateSeed.o);

        let hour = sunrise[0];
        let moment;
        let minutes;
        let exactJulian;
        let T;
        let azEl;
        while (hour <= sunset[0] + 1) {
          console.log(`${i}.${hour}`);
          moment = dateSeed.plus({ hours: hour });
          minutes = moment.hour * 60 + moment.minute + moment.second / 60.0;
          exactJulian = jday + minutes / 1440.0 - moment.o / 1440;
          T = calcTimeJulianCent(exactJulian);
          azEl = calcAzEl(T, minutes, point.y, point.x, moment.o);

          const azD = 90 - abs(convD(azEl.azimuth) - convD(point.angle));
          const incidence = {
            s: calcIncidence(azD, abs(azEl.elevation)),
            t: abs(90 - azEl.elevation),
          };
          const irradiance = {
            s: cos(unit(incidence.s, "deg")),
            t: cos(unit(incidence.t, "deg")),
          };
          this.push(
            JSON.stringify({
              x: round(Number(point.x), 4),
              y: round(Number(point.y), 4),
              z: round(Number(point.z), 2),
              travelAngle: round(Number(point.angle), 0),
              azimuth: round(Number(azEl.azimuth), 0),
              elevation: round(Number(azEl.elevation), 0),
              julianDate: round(Number(exactJulian), 2),
              dateTime: moment.toJSON(),
              zoneOffset: moment.o,
              incT: round(incidence.t, 0),
              incS: round(incidence.s, 0),
              irrT: irradiance.t > 0 ? round(irradiance.t, 3) : 0,
              irrS: irradiance.s > 0 ? round(irradiance.s, 3) : 0,
            })
          );
          hour += 1;
        }
      }
      procStream.destroy();
    },
  });
  return procStream;
}
