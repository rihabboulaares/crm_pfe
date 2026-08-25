import {
  containsSecret,
  discoveryFailedCount,
  discoveryImportedCount,
  discoveryResultMessage,
  discoverySummarySources,
  formatDiscoveryMessage,
  normalizeProspectSources,
} from "./prospectSources";

describe("prospectSources", () => {
  it("shows Meta Ads source", () => {
    expect(
      normalizeProspectSources({ discovery_sources: ["Meta Ads Library"] })[0].shortLabel
    ).toBe("Meta Ads");
  });

  it("shows Facebook source", () => {
    expect(normalizeProspectSources({ discovery_sources: ["Serper Facebook"] })[0].shortLabel).toBe(
      "Facebook"
    );
  });

  it("keeps multi-source order", () => {
    const sources = normalizeProspectSources({
      discovery_sources: ["Meta Ads Library", "Serper Facebook"],
    });

    expect(sources.map((source) => source.fullLabel)).toEqual([
      "Meta Ads Library",
      "Serper Facebook",
    ]);
  });

  it("falls back to manual source", () => {
    expect(normalizeProspectSources({ source: "commercial" })[0].shortLabel).toBe("Manuel");
  });

  it("normalizes discovery summary sources", () => {
    expect(discoverySummarySources({ sources_used: ["serper_linkedin"] })[0].shortLabel).toBe(
      "LinkedIn"
    );
  });

  it("detects secrets before rendering diagnostics", () => {
    expect(containsSecret({ url: "https://example.test/?access_token=SECRET" })).toBe(true);
    expect(containsSecret({ sources_used: ["Meta Ads Library"] })).toBe(false);
  });

  it("formats structured discovery errors without object Object", () => {
    expect(
      formatDiscoveryMessage({ step: "crm_import", message: "Limite prospects atteinte" })
    ).toBe("Limite prospects atteinte");
    expect(formatDiscoveryMessage({ error: { code: "limit_reached" } })).toBe(
      '{"code":"limit_reached"}'
    );
  });

  it("distinguishes import failure from source unavailable", () => {
    expect(discoveryResultMessage({ stop_reason: "import_failed", errors: [{}] })).toBe(
      "Recherche terminée, mais l'import CRM a rencontré une erreur."
    );
    expect(
      discoveryResultMessage({
        errors: [{ tool: "ads_library_search", status: "unavailable", message: "unavailable" }],
      })
    ).toBe("Recherche terminée avec une source indisponible.");
  });

  it("counts imported and failed candidates", () => {
    const result = {
      import_stats: {
        persons_created: 2,
        persons_updated: 1,
        companies_created: 1,
        persons_failed: 3,
      },
    };

    expect(discoveryImportedCount(result)).toBe(4);
    expect(discoveryFailedCount(result)).toBe(3);
  });
});
