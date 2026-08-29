import api from "./salesApi";

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeCompany = (company = {}) => ({
  ...company,
  type: "company",
  displayName: firstValue(company.nom, company.name, company.company_name, "Entreprise sans nom"),
  sector: firstValue(company.categorie, company.secteur, company.industry, company.category),
  city: firstValue(company.ville, company.city),
  country: firstValue(company.pays, company.country),
  phone: firstValue(company.telephone, company.phone),
  email: company.email,
  website: firstValue(company.site_web, company.website, company.website_url),
  nextAction: firstValue(company.next_action, company.nextAction),
  address: firstValue(company.adresse, company.address),
  sourceUrl: firstValue(company.source_url, company.raw_url),
});

const normalizePerson = (person = {}) => {
  const fullName = firstValue(
    person.full_name,
    person.name,
    `${person.first_name || ""} ${person.last_name || ""}`.trim()
  );

  return {
    ...person,
    type: "person",
    displayName: fullName || "Décideur sans nom",
    title: firstValue(person.title, person.job_title, person.role),
    companyName: firstValue(person.prospect_company_name, person.company_name, person.company),
    city: firstValue(person.ville, person.city),
    country: firstValue(person.pays, person.country),
    phone: firstValue(person.telephone, person.phone),
    email: person.email,
    website: firstValue(person.site_web, person.website, person.website_url),
    nextAction: firstValue(person.next_action, person.nextAction),
    address: firstValue(person.adresse, person.address),
    sourceUrl: firstValue(person.source_url, person.raw_url, person.profile_url),
  };
};

const visibleSources = (result = {}) =>
  [
    ...toArray(result.sources_used),
    ...toArray(result.executed_searches).map((item) => item.source || item.tool),
    ...toArray(result.tool_history).map((item) => item.tool || item.source),
  ]
    .map((source) => String(source || "").toLowerCase())
    .map((source) =>
      source
        .replace("serper_", "")
        .replace("maps_search", "maps")
        .replace("ads_library_search", "meta_ads")
        .replace("google_maps", "maps")
    )
    .filter(Boolean)
    .filter((source, index, list) => list.indexOf(source) === index);

export function normalizeProspectionResult(result = {}) {
  const companies = toArray(
    result.prospect_companies || result.entreprises || result.companies
  ).map(normalizeCompany);
  const persons = toArray(result.prospect_persons || result.prospects || result.persons).map(
    normalizePerson
  );
  const total = Number(
    firstValue(
      result.found,
      result.found_count,
      result.accepted_count,
      result.current_valid_prospects,
      companies.length + persons.length
    )
  );
  const importedCount = Number(firstValue(result.imported_count, result.imported, 0)) || 0;
  const existingCount =
    Number(firstValue(result.existing_count, result.import_skipped_count, 0)) || 0;

  return {
    raw: result,
    success: result.success !== false,
    query: result.query || "",
    message: result.message || "",
    runId: result.run_id,
    reportUrl: result.report_url,
    total: Number.isFinite(total) ? total : companies.length + persons.length,
    companies,
    persons,
    importedCount,
    existingCount,
    rejectedCount: Number(firstValue(result.rejected_count, result.rejected_results, 0)) || 0,
    sources: visibleSources(result),
    targetReached: result.target_reached,
    errors: toArray(result.errors),
  };
}

export function searchProspectsAgent(criteria) {
  const query = typeof criteria === "string" ? criteria : criteria?.query;
  return api.post("/api/agent/prospect/", { query }).then((response) => response.data);
}

export function runProspectionAgent(query) {
  return searchProspectsAgent({ query });
}

export function runDiscovery(payload) {
  return api.post("/api/agent/prospect/", payload).then((response) => response.data);
}

export function runProspectDiscovery(payload) {
  return runDiscovery(payload);
}

export function getProspectSources(prospectId) {
  return api.get(`/api/prospects/${prospectId}/sources/`).then((response) => response.data);
}

export function getDiscoveryReportBlob(reportUrl) {
  return api.get(reportUrl, { responseType: "blob" }).then((response) => response.data);
}

export function importProspectionResult(payload) {
  return api.post("/agentProspection/importer/", payload).then((response) => response.data);
}
