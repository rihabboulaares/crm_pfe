import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import AgentEngagementCockpit, {
  GeneratedContentCard,
  PolicyAlert,
  ResponseAnalysisCard,
  StrategyCard,
} from "./AgentEngagementCockpit";
import {
  continueInteraction,
  getInteractionOptions,
  getInteractions,
  recordInteraction,
  startInitialEngagementPlan,
} from "../../services/engagementApi";

jest.mock("../../services/engagementApi", () => ({
  continueInteraction: jest.fn(),
  getInteractionOptions: jest.fn(),
  getInteractions: jest.fn(),
  recordInteraction: jest.fn(),
  startInitialEngagementPlan: jest.fn(),
}));

const prospect = {
  id: 7,
  first_name: "Ahmed",
  last_name: "Ben Salah",
  title: "Directeur commercial",
  company_name: "ABC Technologies",
  email: "ahmed@example.com",
  phone: "+21622222222",
  facebook_url: "https://facebook.com/ahmed",
};

const plan = {
  engagement_stage: "FIRST_CONTACT",
  prospect_temperature: "WARM",
  objective: "START_CONVERSATION",
  strategy: "DIRECT_OUTREACH",
  primary_channel: "phone",
  secondary_channels: ["email"],
  confidence: 0.87,
  reasons: ["Prospect decision-maker", "Phone and email available"],
  missing_information: ["budget"],
  should_wait: false,
  suggested_wait_days: null,
};

let container;
let root;

function render(ui) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return container;
}

function text(value) {
  return container.textContent.includes(value);
}

function button(label) {
  return Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent.includes(label)
  );
}

function inputByLabel(label) {
  const labels = Array.from(container.querySelectorAll("label"));
  const node = labels.find((item) => item.textContent.includes(label));
  const id = node?.getAttribute("for");
  return id ? document.getElementById(id) : null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("AgentEngagementCockpit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInteractions.mockResolvedValue({ data: { results: [] } });
    getInteractionOptions.mockResolvedValue({
      data: {
        channels: ["EMAIL", "PHONE", "LINKEDIN", "FACEBOOK", "INSTAGRAM", "OTHER"],
        action_types: ["EMAIL_SENT", "PHONE_CALL", "SOCIAL_MESSAGE_SENT", "FOLLOW_UP", "OTHER"],
        outcomes: [
          "SENT",
          "NO_RESPONSE",
          "INTERESTED",
          "NOT_INTERESTED",
          "CALL_LATER",
          "OBJECTION",
          "REQUEST_INFORMATION",
          "MEETING_REQUEST",
          "WRONG_CONTACT",
          "UNSUBSCRIBE",
          "OTHER",
        ],
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    document.body.innerHTML = "";
  });

  it("renders strategy with confidence", () => {
    render(<StrategyCard title="AI Engagement Strategy" plan={plan} />);

    expect(text("Prise de contact directe")).toBe(true);
    expect(text("Élevée · 87 %")).toBe(true);
    expect(text("Prospect decision-maker")).toBe(true);
  });

  it("renders email content actions", () => {
    render(
      <GeneratedContentCard
        prospect={prospect}
        plan={{ ...plan, primary_channel: "email" }}
        content={{
          content_required: true,
          channel: "email",
          email: { subject: "Presentation", body: "Bonjour Ahmed" },
        }}
      />
    );

    expect(text("Email proposé")).toBe(true);
    expect(text("Presentation")).toBe(true);
    expect(button("Enregistrer l'envoi")).toBeTruthy();
  });

  it("renders phone script", () => {
    render(
      <GeneratedContentCard
        prospect={prospect}
        plan={plan}
        content={{
          content_required: true,
          channel: "phone",
          call_script: {
            call_objective: "Qualifier le besoin",
            opening: "Bonjour Ahmed",
            hook: "Contexte CRM",
            discovery_questions: ["Quel CRM utilisez-vous ?"],
            value_proposition: "Gagner du temps",
            possible_objections: [{ objection: "Prix", suggested_response: "Clarifier la valeur" }],
            call_to_action: "Planifier une demo",
            closing: "Merci",
          },
        }}
      />
    );

    expect(text("Script d'appel")).toBe(true);
    expect(text("Qualifier le besoin")).toBe(true);
    expect(text("Quel CRM")).toBe(true);
  });

  it("renders social manual message", () => {
    render(
      <GeneratedContentCard
        prospect={prospect}
        plan={{ ...plan, primary_channel: "facebook" }}
        content={{
          content_required: true,
          channel: "facebook",
          social_message: { message: "Bonjour Ahmed", execution_mode: "manual" },
        }}
      />
    );

    expect(text("Message Facebook proposé")).toBe(true);
    expect(button("Marquer comme envoyé")).toBeTruthy();
  });

  it("renders wait and stop states without contact actions", () => {
    render(
      <GeneratedContentCard
        prospect={prospect}
        plan={{ ...plan, strategy: "WAIT", should_wait: true }}
        content={{ content_required: false, reason: "Wait two weeks" }}
      />
    );

    expect(text("L'agent recommande d'attendre")).toBe(true);

    act(() => {
      root.render(
        <GeneratedContentCard
          prospect={prospect}
          plan={{ ...plan, strategy: "STOP_ENGAGEMENT" }}
          content={{ content_required: false }}
        />
      );
    });

    expect(text("Sollicitations arrêtées")).toBe(true);
    expect(button("Enregistrer l'envoi")).toBeFalsy();
  });

  it("renders blocked policy violations", () => {
    render(
      <PolicyAlert
        policy={{
          status: "BLOCKED",
          allowed: false,
          violations: ["UNSUBSCRIBE"],
          warnings: [],
        }}
      />
    );

    expect(text("Action bloquée")).toBe(true);
    expect(text("Le prospect a demandé à ne plus être contacté.")).toBe(true);
  });

  it("shows response analysis facts and signals", () => {
    render(
      <ResponseAnalysisCard
        analysis={{
          intent: "INTERESTED",
          sentiment: "POSITIVE",
          interest_level: "HIGH",
          current_solution: "Salesforce",
          timing: "Q4",
          confidence: 0.9,
          detected_objections: [{ type: "PRICE" }],
          detected_requests: ["presentation"],
          detected_pain_points: ["manual prospecting"],
          buying_signals: ["asked for deck"],
          summary: "Interested but price sensitive.",
          confirmed_facts: [{ label: "CRM actuel", value: "Salesforce" }],
          inferred_signals: [{ label: "Interet", value: "HIGH" }],
        }}
      />
    );

    expect(text("Analyse de la réponse")).toBe(true);
    expect(text("Salesforce")).toBe(true);
    expect(text("CRM actuel: Salesforce")).toBe(true);
    expect(text("Intérêt: Élevé")).toBe(true);
  });

  it("records interaction and adapts recommendation with a single continue call", async () => {
    startInitialEngagementPlan.mockResolvedValue({
      data: {
        success: true,
        available_channels: { phone: { available: true }, email: { available: true } },
        plan,
        policy: { status: "ALLOWED", allowed: true, violations: [], warnings: [] },
        content: {
          content_required: true,
          channel: "phone",
          call_script: {
            call_objective: "Qualifier le besoin",
            opening: "Bonjour",
            hook: "CRM",
            discovery_questions: [],
            value_proposition: "Valeur",
            possible_objections: [],
            call_to_action: "Demo",
            closing: "Merci",
          },
        },
      },
    });
    recordInteraction.mockResolvedValue({
      data: {
        interaction: {
          id: 22,
          channel: "PHONE",
          action_type: "PHONE_CALL",
          outcome: "OBJECTION",
        },
      },
    });
    continueInteraction.mockResolvedValue({
      data: {
        success: true,
        analysis: { intent: "INTERESTED", summary: "Price objection", confidence: 0.8 },
        engagement_memory: { current_solution: "Salesforce", interest_level: "HIGH" },
        plan: { ...plan, strategy: "VALUE_FIRST", primary_channel: "email" },
        policy: { status: "ALLOWED", allowed: true, violations: [], warnings: [] },
        content: {
          content_required: true,
          channel: "email",
          email: { subject: "Suite a notre echange", body: "Voici la presentation." },
        },
      },
    });

    render(<AgentEngagementCockpit prospect={prospect} />);
    await flush();

    await act(async () => {
      button("Lancer l'agent").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(text("Script d'appel")).toBe(true);

    await act(async () => {
      button("Enregistrer le résultat").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const responseInput = inputByLabel("Réponse du prospect");
    await act(async () => {
      responseInput.value = "Nous utilisons Salesforce mais votre prix est eleve.";
      responseInput.dispatchEvent(new Event("input", { bubbles: true }));
      button("Enregistrer l'interaction").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(recordInteraction).toHaveBeenCalled();

    await act(async () => {
      button("Analyser et adapter la recommandation").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(continueInteraction).toHaveBeenCalledTimes(1);
    expect(continueInteraction).toHaveBeenCalledWith(7, 22);
    expect(text("Analyse de la réponse")).toBe(true);
    expect(text("Ce que l'agent a retenu")).toBe(true);
    expect(text("Nouvelle stratégie recommandée")).toBe(true);
    expect(text("Suite a notre echange")).toBe(true);
  });

  it("refreshes conversation after initial generated message is persisted", async () => {
    const onConversationChanged = jest.fn().mockResolvedValue();
    startInitialEngagementPlan.mockResolvedValue({
      data: {
        success: true,
        available_channels: { linkedin: { available: true } },
        plan: { ...plan, primary_channel: "linkedin" },
        policy: { status: "ALLOWED", allowed: true, violations: [], warnings: [] },
        content: {
          content_required: true,
          channel: "linkedin",
          social_message: {
            channel: "linkedin",
            message: "Bonjour Ahmed, pouvons-nous echanger ?",
          },
        },
        generated_log_id: 31,
      },
    });

    render(
      <AgentEngagementCockpit prospect={prospect} onConversationChanged={onConversationChanged} />
    );
    await flush();

    await act(async () => {
      button("Lancer l'agent").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConversationChanged).toHaveBeenCalledTimes(1);
  });
});
