import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_ASPECT_RATIO,
  createProjectPayloadSchema,
  slugifyProjectTitle,
  updateProjectPayloadSchema
} from "./project-validation";

describe("project validation", () => {
  it("defaults new projects to 9:16 and accepts optional duration-free payloads", () => {
    const payload = createProjectPayloadSchema.parse({
      title: "New Vertical Cut"
    });

    expect(payload.aspectRatio).toBe(DEFAULT_PROJECT_ASPECT_RATIO);
    expect(payload.description).toBeNull();
  });

  it("keeps project update payloads narrow", () => {
    expect(() => updateProjectPayloadSchema.parse({})).toThrow();
    expect(updateProjectPayloadSchema.parse({ aspectRatio: "1:1" })).toMatchObject({
      aspectRatio: "1:1"
    });
  });

  it("creates stable project slugs from titles", () => {
    expect(slugifyProjectTitle(" Signal Tower: Cut 01 ")).toBe("signal-tower-cut-01");
    expect(slugifyProjectTitle("!!!")).toBe("untitled-project");
  });
});
