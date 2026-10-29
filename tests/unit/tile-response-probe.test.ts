import { describe, expect, it } from "vitest";
import { responseFindings } from "../prototypes/tile-response";

describe("isolated naive tile response limitations", () => {
  it("reuses real narrow phase/correction for a single static cell without a tile Actor", () => {
    const finding = responseFindings();
    expect(finding.single.position).toEqual({ x: -10, y: 16 });
    expect(finding.single.unresolved).toBe(0);
  });
  it("records a seam-induced circle tangent error as an implementation acceptance gate", () => {
    const finding = responseFindings();
    expect(Math.abs(finding.circleSlide.tangentError)).toBeGreaterThan(0.01);
    expect(finding.circleSlide.unresolved).toBe(0);
    expect(finding.boxSlide.tangentError).toBe(0);
  });
  it("does not claim six per-cell iterations can recover a deep embedding", () => {
    expect(responseFindings().embedded.unresolved).toBeGreaterThan(0);
  });
});
