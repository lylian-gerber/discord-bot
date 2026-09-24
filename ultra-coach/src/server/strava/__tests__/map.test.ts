import { describe, expect, it } from "vitest";
import { estimateRpe, localDay, mapSport, toStreamPoints } from "../map";

describe("conversion Strava", () => {
  it("types de sport", () => {
    expect(mapSport("TrailRun")).toBe("trail");
    expect(mapSport("Run")).toBe("running");
    expect(mapSport("Soccer")).toBe("football");
    expect(mapSport("WeightTraining")).toBe("strength");
    expect(mapSport("Kitesurf")).toBe("other");
  });

  it("jour local (heure locale Strava)", () => {
    expect(localDay({ start_date_local: "2026-09-24T23:30:00Z" })).toBe("2026-09-24");
  });

  it("RPE : ressenti Strava prioritaire, sinon estimé depuis la FC", () => {
    expect(estimateRpe({ perceived_exertion: 7 }, 195)).toEqual({ rpe: 7, estimated: false });
    expect(estimateRpe({ average_heartrate: 145 }, 195)).toEqual({ rpe: 4, estimated: true });
    expect(estimateRpe({ average_heartrate: 180 }, 195)).toEqual({ rpe: 8, estimated: true });
    expect(estimateRpe({}, 195)).toEqual({ rpe: null, estimated: true });
  });

  it("streams → points (cadence en pas/min)", () => {
    const pts = toStreamPoints({
      time: { data: [0, 10, 20] },
      distance: { data: [0, 30, 60] },
      altitude: { data: [100, 101, 102] },
      heartrate: { data: [120, 130, 0] },
      cadence: { data: [85, 86, 87] },
      moving: { data: [true, true, false] },
    });
    expect(pts).toHaveLength(3);
    expect(pts[1]).toMatchObject({ t: 10, d: 30, alt: 101, hr: 130, cadence: 172, moving: true });
    expect(pts[2]!.hr).toBeUndefined();
    expect(toStreamPoints({ time: { data: [0, 1] } })).toEqual([]);
  });
});
