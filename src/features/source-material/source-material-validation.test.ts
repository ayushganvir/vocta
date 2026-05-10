import { describe, expect, it } from "vitest";
import {
  IMAGE_REFERENCE_MAX_SIZE_BYTES,
  buildStubStoragePath,
  createSourceMaterialPayloadSchema,
  validateImageMimeType
} from "./source-material-validation";

describe("source material validation", () => {
  it("accepts manual script source records", () => {
    const payload = createSourceMaterialPayloadSchema.parse({
      projectId: "project-1",
      type: "SCRIPT",
      title: "Opening script",
      bodyText: "The story starts here."
    });

    expect(payload.type).toBe("SCRIPT");
  });

  it("enforces image reference upload constraints", () => {
    expect(validateImageMimeType("image/png")).toBe(true);
    expect(validateImageMimeType("application/pdf")).toBe(false);
    expect(
      createSourceMaterialPayloadSchema.parse({
        projectId: "project-1",
        type: "IMAGE",
        title: "URL reference",
        previewUrl: "/reference.png",
        fileName: null,
        mimeType: null,
        sizeBytes: null
      })
    ).toMatchObject({ previewUrl: "/reference.png" });
    expect(() =>
      createSourceMaterialPayloadSchema.parse({
        projectId: "project-1",
        type: "IMAGE",
        title: "Large reference",
        fileName: "large.png",
        mimeType: "image/png",
        sizeBytes: IMAGE_REFERENCE_MAX_SIZE_BYTES + 1
      })
    ).toThrow();
  });

  it("builds stub storage paths without processing media", () => {
    expect(buildStubStoragePath("project-1", "Reference", "Hero Frame.PNG")).toContain(
      "stub/source-material/project-1/"
    );
  });
});
