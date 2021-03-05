import * as SunCalc from "suncalc";

/**
 * Computes building illumination state and skybox state based on current sun position
 * 
 * @exports
 * @param {*} center - Current geospatial coordinates
 * @param {*} currentTime - Current time
 * @param {*} lighting - Denotes whether building illumination mode is enabled
 * @returns {Object}
 */
export function computeSunLightingParameters(center, currentTime, lighting) {
  // Get current sun position's azimuth and altitude in degrees
  const longitude = center.lng;
  const latitude = center.lat;
  const sunPosition = SunCalc.getPosition(currentTime, latitude, longitude);
  const sunAzimuth = (sunPosition.azimuth * 180) / Math.PI;
  const sunAltitude = (sunPosition.altitude * 180) / Math.PI;
  // Azimuth
  // SunCalc 0deg is south clockwise
  // Mapbox 0deg is north clockwise

  // Altitude
  // SunCalc 90deg is above -90deg is bottom
  // Mapbox 0 deg is above 180deg is bottom
  const sunAzimuth_mapbox = 180 + sunAzimuth;
  const sunAltitude_mapbox = 90 - sunAltitude;

  const lightingSettings = {
    anchor: lighting ? "map" : "viewport",
    color: "white",
    intensity: lighting ? 0.7 : 0.5,
    position: lighting
      ? [2, sunAzimuth_mapbox, sunAltitude_mapbox]
      : [1.15, 210, 30],
  };
  // For accurate sky coloring during the golden/blue hours, need to play around with the angles and colors...
  //console.log(sunAltitude_mapbox);
  const thresholds = {
    25: [14, "white"], // day
    40: [12, "white"], // day
    60: [10, "white"], // day
    65: [8, "white"], // day
    70: [6, "white"], // day
    87: [4, "white"], // day
    102: [100, "blue"], // civil twilight
    180: [5, "black"], // night
  };

  const [sun_intensity, sun_color] = thresholds[
    Object.keys(thresholds).find((altitude) => sunAltitude_mapbox <= altitude)
  ];

  return {
    sunAzimuth_mapbox,
    sunAltitude_mapbox,
    lightingSettings,
    sun_intensity,
    sun_color,
  };
}

/**
 * Snaps a given bearing angle to the nearest 90 degrees (i.e. North, South, East or West)
 * 
 * @exports
 * @param {number} angle - Bearing angle
 * @returns {number} - Bearing angle snapped to nearest 90 degrees 
 */
export function snapToBearing(angle) {
  const val = Math.floor(((180 - angle) / 90) + 0.5) % 4;
  const arr = [180, 90, 0, 270];
  return arr[val];
}
