import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import ProspectionWorkspace from "./ProspectionWorkspace";
import { searchProspectsAgent } from "../../services/prospectAgentApi";

jest.mock("../../services/prospectAgentApi", () => {
  const actual = jest.requireActual("../../services/prospectAgentApi");
  return {
    ...actual,
    searchProspectsAgent: jest.fn(),
  };
});

let container;
let root;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(ui = <ProspectionWorkspace />) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  return container;
}

function text(value) {
  return container.textContent.includes(value);
}

function button(label) {
  return Array.from(container.querySelectorAll("button, [role='button']")).find((item) =>
    item.textContent.includes(label)
  );
}

function input() {
  return container.querySelector("textarea");
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function runSearch(query = "Responsables RH à Tunis") {
  await act(async () => {
    Simulate.change(input(), { target: { value: query } });
  });
  await act(async () => {
    Simulate.click(button("Lancer la recherche"));
    await Promise.resolve();
  });
  await flush();
}

describe("ProspectionWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    document.body.innerHTML = "";
  });

  it("renders the initial assistant workspace", () => {
    render();

    expect(text("Assistant de prospection")).toBe(true);
    expect(text("Que recherchez-vous ?")).toBe(true);
    expect(text("Signal de prospection")).toBe(true);
    expect(text("Prêt à prospecter")).toBe(true);
    expect(text("Transformez une demande en opportunités commerciales.")).toBe(true);
    expect(text("Recherche ciblée")).toBe(true);
    expect(text("SONAR")).toBe(false);
  });

  it("fills the search field from a suggestion", () => {
    render();

    act(() => {
      Simulate.click(button("Responsables RH à Tunis"));
    });

    expect(input().value).toBe("Responsables RH à Tunis");
  });

  it("shows a professional loading state when a search starts", async () => {
    let resolveSearch;
    searchProspectsAgent.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      })
    );
    render();

    await act(async () => {
      Simulate.change(input(), { target: { value: "Hôtels en Tunisie" } });
    });
    await act(async () => {
      Simulate.click(button("Lancer la recherche"));
      await Promise.resolve();
    });

    expect(text("Recherche de prospects en cours")).toBe(true);
    expect(text("Recherche en cours")).toBe(true);
    expect(text("Analyse de la demande")).toBe(true);
    expect(text("Recherche des opportunités")).toBe(true);

    await act(async () => {
      resolveSearch({ success: true, found: 0, prospect_companies: [], prospect_persons: [] });
    });
  });

  it("renders companies without technical details or reimport action", async () => {
    searchProspectsAgent.mockResolvedValue({
      success: true,
      found: 1,
      imported_count: 1,
      prospect_companies: [
        {
          nom: "Sofrecom Tunisie",
          secteur: "Services numériques",
          ville: "Tunis",
          telephone: "+216 70 000 000",
          site_web: "https://example.com",
        },
      ],
      brain_mode: "gemini",
      gemini_calls: 3,
      stop_reason: "completed",
    });
    render();

    await runSearch("Entreprises SaaS à Tunis");

    expect(text("Prospection terminée")).toBe(true);
    expect(text("1 opportunité correspondant à votre recherche a été identifiée.")).toBe(true);
    expect(text("Sofrecom Tunisie")).toBe(true);
    expect(text("Trouvé")).toBe(true);
    expect(text("Ajouté au CRM")).toBe(true);
    expect(text("Recherche finalisée")).toBe(true);
    expect(text("1 trouvé")).toBe(true);
    expect(text("+ Importer")).toBe(false);
    expect(text("Email d'ouverture envoyé")).toBe(false);
    expect(text("Lancer la chasse")).toBe(false);
    expect(text("brain_mode")).toBe(false);
    expect(text("gemini_calls")).toBe(false);
    expect(text("stop_reason")).toBe(false);
  });

  it("renders persons and mixed result filters", async () => {
    searchProspectsAgent.mockResolvedValue({
      success: true,
      found: 2,
      imported_count: 2,
      prospect_companies: [{ nom: "DataPlus", ville: "Sousse" }],
      prospect_persons: [
        {
          first_name: "Amal",
          last_name: "Trabelsi",
          title: "Responsable marketing",
          company_name: "DataPlus",
          linkedin_url: "https://linkedin.com/in/amal",
        },
      ],
    });
    render();

    await runSearch("Responsables marketing");

    expect(text("DataPlus")).toBe(true);
    expect(text("Amal Trabelsi")).toBe(true);
    expect(text("Décideurs")).toBe(true);

    act(() => {
      Simulate.click(button("Personnes"));
    });

    expect(text("Amal Trabelsi")).toBe(true);
  });

  it("renders no result guidance", async () => {
    searchProspectsAgent.mockResolvedValue({
      success: true,
      found: 0,
      imported_count: 0,
      prospect_companies: [],
      prospect_persons: [],
    });
    render();

    await runSearch("Cible très précise");

    expect(
      text("Aucun prospect correspondant exactement à votre recherche n'a été identifié.")
    ).toBe(true);
    expect(text("Modifier la recherche")).toBe(true);
    expect(text("Nouvelle recherche")).toBe(true);
  });

  it("renders neutral backend error copy", async () => {
    searchProspectsAgent.mockRejectedValue(new Error("503 UNAVAILABLE Gemini traceback"));
    render();

    await runSearch("Restaurants à Tunis");

    expect(text("La recherche n'a pas pu être finalisée.")).toBe(true);
    expect(text("Vous pouvez réessayer dans quelques instants ou modifier vos critères.")).toBe(
      true
    );
    expect(text("503 UNAVAILABLE")).toBe(false);
    expect(text("Gemini")).toBe(false);
  });

  it("handles partial contact data", async () => {
    searchProspectsAgent.mockResolvedValue({
      success: true,
      found: 1,
      prospect_persons: [{ first_name: "Nour", last_name: "Mansour" }],
    });
    render();

    await runSearch("Décideurs commerciaux");

    expect(text("Nour Mansour")).toBe(true);
    expect(text("Informations de contact à compléter.")).toBe(true);
    expect(text("Trouvé")).toBe(true);
  });
});
