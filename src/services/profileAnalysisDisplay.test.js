import {
  classifyProfileUrl,
  normalizeAnalysisPayload,
  normalizeProfileUrl,
  normalizeStringList,
  readableAnalysisError,
} from "./profileAnalysisDisplay";

describe("profileAnalysisDisplay", () => {
  it("classifies social URLs and normalizes duplicates", () => {
    expect(classifyProfileUrl("https://tn.linkedin.com/in/hana/")).toBe("linkedin");
    expect(classifyProfileUrl("https://facebook.com/acme")).toBe("facebook");
    expect(classifyProfileUrl("https://www.instagram.com/acme/")).toBe("instagram");
    expect(classifyProfileUrl("https://example.com")).toBe("website");
    expect(normalizeProfileUrl("https://www.linkedin.com/in/hana/")).toBe(
      "https://linkedin.com/in/hana"
    );
  });

  it("returns a readable LinkedIn PAGE_NOT_PUBLIC message when evidence was used", () => {
    expect(readableAnalysisError("linkedin", "PAGE_NOT_PUBLIC", true)).toBe(
      "LinkedIn n'est pas accessible publiquement. L'analyse a utilise les informations deja decouvertes."
    );
  });

  it("keeps conflict display data explicit", () => {
    const conflict = {
      field: "linkedin_url",
      existing: "https://linkedin.com/in/a",
      discovered: "https://linkedin.com/in/b",
      source: "website",
      action: "preserved_existing",
    };
    expect(conflict).toMatchObject({
      field: "linkedin_url",
      existing: "https://linkedin.com/in/a",
      discovered: "https://linkedin.com/in/b",
      source: "website",
      action: "preserved_existing",
    });
  });

  it("normalizes missing_information arrays", () => {
    expect(normalizeStringList(["email", "phone"])).toEqual(["email", "phone"]);
  });

  it("normalizes missing_information strings", () => {
    expect(normalizeStringList("email, phone; website\ncity")).toEqual([
      "email",
      "phone",
      "website",
      "city",
    ]);
  });

  it("normalizes missing_information null", () => {
    expect(normalizeStringList(null)).toEqual([]);
  });

  it("normalizes missing_information scalar values", () => {
    expect(normalizeStringList(42)).toEqual(["42"]);
    expect(normalizeStringList({ field: "email" })).toEqual(["[object Object]"]);
  });

  it("normalizes services strings", () => {
    expect(normalizeAnalysisPayload({ summary: { services: "audit; conseil" } }).services).toEqual([
      "audit",
      "conseil",
    ]);
  });

  it("guards non-array errors", () => {
    expect(normalizeAnalysisPayload({ errors: "PAGE_NOT_PUBLIC" }).errors).toEqual([]);
  });

  it("guards non-array source details", () => {
    expect(normalizeAnalysisPayload({ source_details: "linkedin" }).sourceDetails).toEqual([]);
  });
});
