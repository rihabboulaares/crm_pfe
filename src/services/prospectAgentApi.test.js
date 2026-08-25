import api from "./salesApi";
import {
  calculateProspectScore,
  getDiscoveryReportBlob,
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

  it("calls the real score endpoint for one prospect", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, score: 75 } });

    await calculateProspectScore(12);

    expect(api.post).toHaveBeenCalledWith("/api/prospects/12/score/");
  });

  it("downloads the report from the discovery response URL", async () => {
    api.get.mockResolvedValueOnce({ data: new Blob(["pdf"]) });

    await getDiscoveryReportBlob("/api/agent/prospect/7/report/");

    expect(api.get).toHaveBeenCalledWith("/api/agent/prospect/7/report/", {
      responseType: "blob",
    });
  });
});
