import {
  analyzeProspect,
  getProspectAnalysis,
  getProspectAnalysisHistory,
} from "./prospectAnalysisApi";
import api from "./salesApi";

jest.mock("./salesApi", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

describe("prospectAnalysisApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the authenticated profile analysis endpoints", () => {
    analyzeProspect(12, { requested_sources: ["website"] });
    getProspectAnalysis(12);
    getProspectAnalysisHistory(12);

    expect(api.post).toHaveBeenCalledWith("/api/prospection/prospects/12/analyze-profile/", {
      requested_sources: ["website"],
    });
    expect(api.get).toHaveBeenCalledWith("/api/prospection/prospects/12/analysis/");
    expect(api.get).toHaveBeenCalledWith("/api/prospection/prospects/12/analysis-history/");
  });
});
