/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminLayout.js
import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  Dashboard,
  Business,
  People,
  Subscriptions,
  Logout,
  Menu,
  ChevronLeft,
  Group,
  Mail,
  PersonAdd,
  Contacts,
  AttachMoney,
  CheckCircle,
  SmartToy,
  FactCheck,
  DarkMode,
  LightMode,
} from "@mui/icons-material";
import { useMaterialUIController, setDarkMode } from "context";

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 96;
const RED = "#C1121F";
const SIDEBAR_BG = "linear-gradient(180deg, #5A0002 0%, #780000 44%, #9B0008 100%)";
const SIDEBAR_BORDER = "rgba(255,255,255,0.12)";
const SIDEBAR_TEXT = "#ffffff";
const SIDEBAR_MUTED = "rgba(255,255,255,0.84)";
const ACTIVE_BG = "rgba(255,255,255,0.94)";
const HOVER_BG = "rgba(255,255,255,0.12)";
const ICON_BG = "rgba(255,255,255,0.08)";
const ICON_HOVER_BG = "rgba(255,255,255,0.14)";
const ICON_ACTIVE_BG = "rgba(193,18,31,0.10)";

const NAV_SECTIONS = [
  {
    title: "PRINCIPAL",
    items: [
      {
        label: "Dashboard",
        icon: <Dashboard />,
        path: "/superadmin/dashboard",
      },
    ],
  },
  {
    title: "ENTREPRISES",
    items: [
      {
        label: "Entreprises",
        icon: <Business />,
        path: "/superadmin/companies",
      },
      {
        label: "Utilisateurs",
        icon: <People />,
        path: "/superadmin/users",
      },
      {
        label: "Équipes",
        icon: <Group />,
        path: "/superadmin/teams",
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        label: "Prospects",
        icon: <PersonAdd />,
        path: "/superadmin/prospects",
      },
      {
        label: "Contacts",
        icon: <Contacts />,
        path: "/superadmin/contacts",
      },
      {
        label: "Opportunités",
        icon: <AttachMoney />,
        path: "/superadmin/opportunities",
      },
      {
        label: "Tâches",
        icon: <CheckCircle />,
        path: "/superadmin/tasks",
      },
    ],
  },

  {
    title: "SYSTÈME",
    items: [
      {
        label: "Invitations",
        icon: <Mail />,
        path: "/superadmin/invitations",
      },
      {
        label: "Plans",
        icon: <Subscriptions />,
        path: "/superadmin/plans",
      },
    ],
  },
  {
    title: "SUPERVISION",
    items: [
      {
        label: "Agents IA",
        icon: <SmartToy />,
        path: "/superadmin/agents",
      },
      {
        label: "Monitoring",
        icon: <FactCheck />,
        path: "/superadmin/monitoring",
      },
      {
        label: "Audit Logs",
        icon: <FactCheck />,
        path: "/superadmin/logs",
      },
    ],
  },
];

function NavItem({ item, collapsed, active }) {
  const navigate = useNavigate();

  return (
    <Tooltip title={collapsed ? item.label : ""} placement="right" arrow>
      <ListItem
        button
        onClick={() => navigate(item.path)}
        sx={{
          borderRadius: "14px",
          mb: "3px",
          mx: "12px",
          px: "12px",
          py: "11px",
          justifyContent: collapsed ? "center" : "flex-start",
          bgcolor: active ? ACTIVE_BG : "transparent",
          color: active ? RED : SIDEBAR_MUTED,
          border: active ? "1px solid rgba(255,255,255,0.95)" : "1px solid transparent",
          boxShadow: active ? "0 12px 24px rgba(0,0,0,0.16)" : "none",
          "&:hover": {
            bgcolor: active ? ACTIVE_BG : HOVER_BG,
            color: active ? RED : "#fff",
            transform: "translateX(2px)",
            "& .MuiListItemIcon-root": {
              color: active ? RED : "#fff",
              bgcolor: active ? ICON_ACTIVE_BG : ICON_HOVER_BG,
            },
          },
          transition: "all 0.2s ease",
        }}
      >
        <ListItemIcon
          sx={{
            color: active ? RED : "rgba(255,255,255,0.72)",
            bgcolor: active ? ICON_ACTIVE_BG : ICON_BG,
            borderRadius: "8px",
            width: 32,
            height: 32,
            display: "grid",
            placeItems: "center",
            minWidth: collapsed ? 32 : 32,
            mr: collapsed ? 0 : 1,
            "& svg": { fontSize: 20 },
          }}
        >
          {item.icon}
        </ListItemIcon>

        {!collapsed && (
          <ListItemText
            primary={
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? RED : "rgba(255,255,255,0.84)",
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </Typography>
            }
          />
        )}
      </ListItem>
    </Tooltip>
  );
}

NavItem.propTypes = {
  item: PropTypes.object.isRequired,
  collapsed: PropTypes.bool.isRequired,
  active: PropTypes.bool.isRequired,
};

function SuperAdminLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [controller, dispatch] = useMaterialUIController();
  const { darkMode } = controller;
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/authentication/sign-in", { replace: true });
  };

  const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "var(--crm-bg)" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            color: SIDEBAR_TEXT,
            backgroundColor: "#780000",
            backgroundImage: SIDEBAR_BG,
            borderRight: "none",
            boxShadow: "18px 0 42px rgba(90,0,2,0.22)",
            transition: "width 0.25s ease",
            overflowX: "hidden",
            overflowY: "hidden",
          },
        }}
      >
        {/* Logo et header */}
        <Box sx={{ px: collapsed ? 2 : 3, pt: 3, pb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {!collapsed ? (
              <>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #E5383B, #C1121F)",
                      boxShadow: "0 12px 24px rgba(0,0,0,0.22)",
                      fontWeight: 800,
                    }}
                  >
                    V
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        color: SIDEBAR_TEXT,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        fontSize: 16,
                      }}
                    >
                      ViewiseCRM
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: SIDEBAR_MUTED,
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      Super Admin
                    </Typography>
                  </Box>
                </Stack>
                <IconButton
                  onClick={() => setCollapsed(true)}
                  sx={{
                    color: SIDEBAR_MUTED,
                    p: 0.5,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)", color: "#fff" },
                  }}
                >
                  <ChevronLeft fontSize="small" />
                </IconButton>
              </>
            ) : (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Avatar
                  sx={{
                    background: "linear-gradient(135deg, #E5383B, #C1121F)",
                    width: 40,
                    height: 40,
                    borderRadius: "10px",
                    fontWeight: 800,
                  }}
                >
                  V
                </Avatar>
                <IconButton
                  onClick={() => setCollapsed(false)}
                  sx={{
                    color: SIDEBAR_MUTED,
                    p: 0.5,
                    "&:hover": { color: "#fff", bgcolor: HOVER_BG },
                  }}
                >
                  <Menu fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: SIDEBAR_BORDER, mx: 2 }} />

        {/* Navigation */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            py: 1,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.30) transparent",
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(255,255,255,0.30)",
              borderRadius: 8,
            },
            "&::-webkit-scrollbar-track": { background: "transparent" },
          }}
        >
          {NAV_SECTIONS.map((section) => (
            <Box key={section.title}>
              {!collapsed && (
                <Box sx={{ px: 3, pt: 1.5, pb: 0.75 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(255,255,255,0.50)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: 10.5,
                    }}
                  >
                    {section.title}
                  </Typography>
                </Box>
              )}
              <List sx={{ py: 0 }}>
                {section.items.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    active={pathname === item.path}
                  />
                ))}
              </List>
            </Box>
          ))}
        </Box>

        <Divider sx={{ borderColor: SIDEBAR_BORDER, mx: 2 }} />

        {/* Logout seulement */}
        <Box sx={{ p: collapsed ? 1.5 : 2 }}>
          <Tooltip title="Déconnexion" placement="right" arrow>
            <ListItem
              button
              onClick={handleLogout}
              sx={{
                borderRadius: "14px",
                px: "12px",
                py: "11px",
                justifyContent: collapsed ? "center" : "flex-start",
                bgcolor: HOVER_BG,
                border: `1px solid ${SIDEBAR_BORDER}`,
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: "rgba(255,255,255,0.18)", transform: "translateY(-1px)" },
              }}
            >
              <ListItemIcon
                sx={{
                  color: "#fff",
                  bgcolor: ICON_BG,
                  borderRadius: "8px",
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  minWidth: collapsed ? 32 : 32,
                  mr: collapsed ? 0 : 1,
                }}
              >
                <Logout sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary="Déconnexion"
                  primaryTypographyProps={{
                    fontSize: 14,
                    color: "#fff",
                    fontWeight: 500,
                  }}
                />
              )}
            </ListItem>
          </Tooltip>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: 3,
          overflow: "auto",
          color: "var(--crm-text)",
          background:
            "radial-gradient(circle at top right, rgba(193,18,31,0.07), transparent 28rem), var(--crm-bg)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Tooltip title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"} arrow>
            <IconButton
              onClick={() => setDarkMode(dispatch, !darkMode)}
              aria-label="Basculer le theme clair sombre"
              sx={{
                width: 42,
                height: 42,
                color: "var(--crm-text)",
                bgcolor: "var(--crm-surface)",
                border: "1px solid var(--crm-border)",
                boxShadow: "var(--crm-shadow-sm)",
                "&:hover": {
                  bgcolor: "var(--crm-red-soft)",
                  color: "var(--crm-red-700)",
                },
              }}
            >
              {darkMode ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        {children}
      </Box>
    </Box>
  );
}

SuperAdminLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SuperAdminLayout;
