import { describe, expect, it } from "vitest";
import { formatCoordinates, parseCoordinateNumber, parseCoordinatesFromText } from "./coordinates";

const at = (latitude: number, longitude: number) => ({ ok: true, coordinates: { latitude, longitude } });

describe("parseCoordinatesFromText", () => {
  it("reads plain coordinate pairs", () => {
    expect(parseCoordinatesFromText("41.311081, 69.240562")).toEqual(at(41.311081, 69.240562));
    expect(parseCoordinatesFromText(" -33.8568 151.2153 ")).toEqual(at(-33.8568, 151.2153));
  });

  it("reads Google Maps links, preferring the place pin over the viewport", () => {
    expect(
      parseCoordinatesFromText(
        "https://www.google.com/maps/place/Registan/@39.6547,66.9733,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d39.654812!4d66.975833",
      ),
    ).toEqual(at(39.654812, 66.975833));
    expect(parseCoordinatesFromText("https://www.google.com/maps/@41.2995,69.2401,14z")).toEqual(at(41.2995, 69.2401));
    expect(parseCoordinatesFromText("https://maps.google.com/?q=41.2995,69.2401")).toEqual(at(41.2995, 69.2401));
    expect(parseCoordinatesFromText("https://www.google.com/maps/search/?api=1&query=41.2995%2C69.2401")).toEqual(
      at(41.2995, 69.2401),
    );
  });

  it("reads Apple Maps, OpenStreetMap and geo: links", () => {
    expect(parseCoordinatesFromText("https://maps.apple.com/?ll=39.7747,64.4286&q=Bukhara")).toEqual(at(39.7747, 64.4286));
    expect(parseCoordinatesFromText("https://maps.apple.com/place?coordinate=39.7747,64.4286&name=Ark")).toEqual(
      at(39.7747, 64.4286),
    );
    expect(parseCoordinatesFromText("https://www.openstreetmap.org/?mlat=41.55&mlon=60.63#map=16/41.55/60.63")).toEqual(
      at(41.55, 60.63),
    );
    expect(parseCoordinatesFromText("https://www.openstreetmap.org/#map=16/41.5512/60.6311")).toEqual(at(41.5512, 60.6311));
    expect(parseCoordinatesFromText("geo:41.3,69.2?z=12")).toEqual(at(41.3, 69.2));
  });

  it("recognizes short links that can't be resolved offline", () => {
    expect(parseCoordinatesFromText("https://maps.app.goo.gl/AbCdEf123")).toEqual({ ok: false, reason: "short-link" });
    expect(parseCoordinatesFromText("https://maps.apple/p/xyz")).toEqual({ ok: false, reason: "short-link" });
  });

  it("rejects text without valid coordinates", () => {
    expect(parseCoordinatesFromText("Registan Square")).toEqual({ ok: false, reason: "not-found" });
    expect(parseCoordinatesFromText("95.1, 10")).toEqual({ ok: false, reason: "not-found" });
    expect(parseCoordinatesFromText("https://www.google.com/maps/place/Registan")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("parseCoordinateNumber", () => {
  it("accepts dot or comma decimals", () => {
    expect(parseCoordinateNumber("41.31")).toBe(41.31);
    expect(parseCoordinateNumber(" -0,5 ")).toBe(-0.5);
    expect(parseCoordinateNumber("41°")).toBeNull();
    expect(parseCoordinateNumber("")).toBeNull();
  });
});

describe("formatCoordinates", () => {
  it("rounds to six decimals", () => {
    expect(formatCoordinates({ latitude: 39.65481234, longitude: 66.9 })).toBe("39.654812, 66.9");
  });
});
