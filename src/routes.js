/* eslint-disable prettier/prettier */
// src/routes.js
import Dashboard from "./pages/modules/Dashboard";
import Welcome from "layouts/authentication/welcome";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import SubscriptionForm from "pages/SubscriptionForm";
import Icon from "@mui/material/Icon";
import InviteMember from "./pages/InviteMember";
import AcceptInvite from "./pages/AcceptInvite";
import CompleteProfile from "./pages/CompleteProfile";
import Prospects from "./pages/modules/Prospects";
import Contacts from "./pages/modules/Contacts";
import Tasks from "./pages/modules/Tasks";
import Campaigns from "./pages/modules/Campaigns";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";
import Opportunities from "./pages/modules/Opportunities";
import History from "./pages/modules/Historypage";
import PipelineAdmin from "pages/modules/PipelineAdmin";
import CRMCalendar from "./pages/modules/CalendarPage";
import EngagementDashboard from "./pages/modules/EngagementDashboard";
// ── Super Admin ───────────────────────────────────────────────
import SuperAdminRoute from "./SuperAdminRoute";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminCompanies from "./pages/superadmin/SuperAdminCompanies";
import SuperAdminUsers from "./pages/superadmin/SuperAdminUsers";
import SuperAdminPlans from "./pages/superadmin/SuperAdminPlans";
import SuperAdminTeams from "./pages/superadmin/SuperAdminTeams";
import SuperAdminInvitations from "./pages/superadmin/SuperAdminInvitations";
import SuperAdminProspects from "./pages/superadmin/SuperAdminProspects";
import SuperAdminContacts from "./pages/superadmin/SuperAdminContacts";
import SuperAdminOpportunities from "./pages/superadmin/SuperAdminOpportunities";
import SuperAdminTasks from "./pages/superadmin/SuperAdminTasks";
import AgentChat from "./pages/Agentchat"; // adapte le chemin selon où tu mets le composant
import ProspectSearch from "./pages/ProspectSearch";

const sa = (component) => <SuperAdminRoute>{component}</SuperAdminRoute>;

const routes = [
  {
    type: "route",
    key: "root",
    route: "/",
    component: <Welcome />,
  },
  {
    type: "route",
    key: "welcome",
    route: "/welcome",
    component: <Welcome />,
  },
  // ── CRM normal ─────────────────────────────────────────────
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
  },
  {
    type: "collapse",
    name: "Prospects",
    key: "prospects",
    icon: <Icon fontSize="small">person_add</Icon>,
    route: "/prospects",
    component: <Prospects />,
  },
  {
    type: "collapse",
    name: "Contacts",
    key: "contacts",
    icon: <Icon fontSize="small">contacts</Icon>,
    route: "/contacts",
    component: <Contacts />,
  },
  {
    type: "collapse",
    name: "Opportunities",
    key: "opportunities",
    icon: <Icon fontSize="small">attach_money</Icon>,
    route: "/opportunities",
    component: <Opportunities />,
  },
  {
    type: "collapse",
    name: "Tâches",
    key: "tasks",
    icon: <Icon fontSize="small">check_circle</Icon>,
    route: "/tasks",
    component: <Tasks />,
  },

  {
    type: "collapse", // ← AJOUT SIDEBAR
    name: "Calendrier",
    key: "calendar",
    icon: <Icon fontSize="small">calendar_month</Icon>,
    route: "/calendar",
    component: <CRMCalendar />,
  },

  {
    type: "collapse",
    name: "Campagnes",
    key: "campaigns",
    icon: <Icon fontSize="small">campaign</Icon>,
    route: "/campaigns",
    component: <Campaigns />,
  },
  {
    type: "collapse",
    name: "Historique",
    key: "history",
    icon: <Icon fontSize="small">history</Icon>,
    route: "/history",
    component: <History />,
  },
  {
    type: "collapse",
    name: "Pipeline",
    key: "pipeline-admin",
    icon: <Icon fontSize="small">account_tree</Icon>,
    route: "/pipeline-admin",
    component: <PipelineAdmin />,
  },
  {
    type: "collapse",
    name: "Profile",
    key: "profile",
    icon: <Icon fontSize="small">person</Icon>,
    route: "/profile",
    component: <Profile />,
  },
  {
    type: "collapse",
    name: "Agent CRM",
    key: "agent",
    icon: <Icon fontSize="small">smart_toy</Icon>,
    route: "/agent",
    component: <AgentChat />,
  },

  {
    type: "collapse",
    name: "Agent Prospection",
    key: "prospect-search",
    icon: <Icon fontSize="small">travel_explore</Icon>,
    route: "/prospect-search",
    component: <ProspectSearch />,
  },
  {
    type: "collapse",
    name: "Agent Engagement IA",
    key: "engagement",
    icon: <Icon fontSize="small">mark_email_read</Icon>,
    route: "/engagement",
    component: <EngagementDashboard />,
  },

  {
    type: "route",
    key: "sign-in",
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    type: "route",
    key: "login",
    route: "/login",
    component: <SignIn />,
  },
  {
    type: "route",
    key: "signin",
    route: "/signin",
    component: <SignIn />,
  },
  {
    type: "route",
    key: "sign-up",
    route: "/authentication/sign-up",
    component: <SignUp />,
  },
  {
    type: "route",
    key: "register",
    route: "/register",
    component: <SignUp />,
  },
  {
    type: "route",
    key: "signup",
    route: "/signup",
    component: <SignUp />,
  },

  // ── Routes sans sidebar ────────────────────────────────────
  { type: "route", key: "invite-member", route: "/invite-member", component: <InviteMember /> },
  {
    type: "route",
    key: "accept-invite",
    route: "/accept-invite/:token",
    component: <AcceptInvite />,
  },
  { type: "route", key: "subscriptions", route: "/subscriptions", component: <SubscriptionForm /> },
  {
    type: "route",
    key: "complete-profile",
    route: "/complete-profile",
    component: <CompleteProfile />,
  },
  {
    type: "route",
    key: "change-password",
    route: "/change-password",
    component: <ChangePassword />,
  },

  // ── Super Admin ────────────────────────────────────────────
  {
    type: "route",
    key: "sa-redirect",
    route: "/superadmin-dashboard",
    component: sa(<SuperAdminDashboard />),
  },
  {
    type: "route",
    key: "sa-dashboard",
    route: "/superadmin/dashboard",
    component: sa(<SuperAdminDashboard />),
  },
  {
    type: "route",
    key: "sa-companies",
    route: "/superadmin/companies",
    component: sa(<SuperAdminCompanies />),
  },
  {
    type: "route",
    key: "sa-users",
    route: "/superadmin/users",
    component: sa(<SuperAdminUsers />),
  },
  {
    type: "route",
    key: "sa-plans",
    route: "/superadmin/plans",
    component: sa(<SuperAdminPlans />),
  },
  {
    type: "route",
    key: "sa-teams",
    route: "/superadmin/teams",
    component: sa(<SuperAdminTeams />),
  },
  {
    type: "route",
    key: "sa-invitations",
    route: "/superadmin/invitations",
    component: sa(<SuperAdminInvitations />),
  },
  {
    type: "route",
    key: "sa-prospects",
    route: "/superadmin/prospects",
    component: sa(<SuperAdminProspects />),
  },
  {
    type: "route",
    key: "sa-contacts",
    route: "/superadmin/contacts",
    component: sa(<SuperAdminContacts />),
  },
  {
    type: "route",
    key: "sa-opportunities",
    route: "/superadmin/opportunities",
    component: sa(<SuperAdminOpportunities />),
  },
  {
    type: "route",
    key: "sa-tasks",
    route: "/superadmin/tasks",
    component: sa(<SuperAdminTasks />),
  },
];

export default routes;
