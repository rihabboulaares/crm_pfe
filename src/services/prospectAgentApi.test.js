import api from "./salesApi";
import {
  getDiscoveryReportBlob,
  normalizeProspectionResult,
  runDiscovery,
  runProspectDiscovery,
} from "./prospectAgentApi";

jest.mock("./salesApi", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

describe("prospectAgentApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the real discovery endpoint", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await runDiscovery({ query: "Trouver 5 restaurants a Tunis" });

    expect(api.post).toHaveBeenCalledWith("/api/agent/prospect/", {
      query: "Trouver 5 restaurants a Tunis",
    });
  });

  it("keeps runProspectDiscovery on the same discovery endpoint", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await runProspectDiscovery({
      query: "Trouver 5 marques de cosmetique en Tunisie",
      max_results: 5,
    });

    expect(api.post).toHaveBeenCalledWith("/api/agent/prospect/", {
      query: "Trouver 5 marques de cosmetique en Tunisie",
      max_results: 5,
    });
  });

  it("downloads the report from the discovery response URL", async () => {
    api.get.mockResolvedValueOnce({ data: new Blob(["pdf"]) });

    await getDiscoveryReportBlob("/api/agent/prospect/7/report/");

    expect(api.get).toHaveBeenCalledWith("/api/agent/prospect/7/report/", {
      responseType: "blob",
    });
  });

  it("normalizes current and legacy discovery response formats", () => {
    const result = normalizeProspectionResult({
      found: 2,
      imported_count: 1,
      prospect_companies: [{ nom: "Sofrecom", ville: "Tunis", score_ia: 87 }],
      prospects: [{ first_name: "Amal", last_name: "Trabelsi", job_title: "DRH" }],
      tool_history: [{ tool: "serper_linkedin" }, { tool: "maps_search" }],
      brain_mode: "gemini",
      stop_reason: "completed",
    });

    expect(result.total).toBe(2);
    expect(result.companies[0].displayName).toBe("Sofrecom");
    expect(result.persons[0].displayName).toBe("Amal Trabelsi");
    expect(result.sources).toEqual(["linkedin", "maps"]);
    expect(result.raw.brain_mode).toBe("gemini");
  });
});
