from agentQualification.agent.profile_scoring import (
    calculate_company_fit,
    calculate_compat_profile_fit,
    calculate_completeness,
    calculate_contact_relevance,
    calculate_reachability,
    COMPANY_COMPLETENESS_FIELDS,
    PROFILE_COMPLETENESS_FIELDS,
)


def analyze_profile(state):
    prospect = state.get("prospect") or {}
    company = state.get("company") or {}
    qualification_target = state.get("qualification_target") or {}

    data_completeness_score, missing_profile = calculate_completeness(
        prospect,
        PROFILE_COMPLETENESS_FIELDS,
    )
    company_completeness_score, missing_company = calculate_completeness(
        company,
        COMPANY_COMPLETENESS_FIELDS,
    )
    contact_relevance = calculate_contact_relevance(
        prospect.get("title"),
        qualification_target,
        return_details=True,
    )
    contact_relevance_score = contact_relevance["score"]
    company_fit = calculate_company_fit(
        company,
        qualification_target,
        return_details=True,
    )
    company_fit_score = company_fit["score"]
    reachability_score, contact_channels = calculate_reachability(prospect)
    profile_fit_score = calculate_compat_profile_fit(
        data_completeness_score,
        contact_relevance_score,
        company_fit_score,
    )

    if not prospect.get("title"):
        missing_profile.append("job_title")
    if reachability_score == 0:
        missing_profile.extend(["email", "phone"])
    if not company:
        missing_company.append("company")

    state["profile_signals"] = {
        "data_completeness_score": data_completeness_score,
        "company_completeness_score": company_completeness_score,
        "contact_relevance_score": contact_relevance_score,
        "contact_relevance_source": contact_relevance["source"],
        "contact_relevance_match": {
            "matched_target": contact_relevance["matched_target"],
            "configured_targets": contact_relevance["configured_targets"],
        },
        "company_fit_score": company_fit_score,
        "company_fit_source": company_fit["source"],
        "company_fit_breakdown": company_fit["breakdown"],
        "company_fit_configured_dimensions": company_fit["configured_dimensions"],
        "qualification_target_source": qualification_target.get("source") or "NONE",
        "target_context_available": (qualification_target.get("source") or "NONE") != "NONE",
        "reachability_score": reachability_score,
        "missing_profile_information": sorted(set(missing_profile)),
        "missing_company_information": sorted(set(missing_company)),
        "present_contact_channels": len(contact_channels),
        "contact_channels": contact_channels,
        # Backward compatibility until scoring migration in phase 5.
        "profile_fit_score": profile_fit_score,
    }
    missing = sorted(set(missing_profile + missing_company))
    state["missing_information"] = sorted(set(state.get("missing_information", []) + missing))
    return state
