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
  MonitorHeart,
  FactCheck,
  BarChart,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

const DRAWER_WIDTH = 260;
const RED = "#C1121F";
const SIDEBAR_BG = "#1F2937";
const SIDEBAR_BORDER = "rgba(255,255,255,0.14)";
const SIDEBAR_TEXT = "#ffffff";
const SIDEBAR_MUTED = "rgba(255,255,255,0.68)";

const NAV_SECTIONS = [
  {
    title: "PRINCIPAL",
    items: [
      {
        label: "Tableau de bord",
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
        icon: <MonitorHeart />,
        path: "/superadmin/monitoring",
      },
      {
        label: "Audit Logs",
        icon: <FactCheck />,
        path: "/superadmin/logs",
      },
      {
        label: "Statistiques",
        icon: <BarChart />,
        path: "/superadmin/stats",
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
          borderRadius: "10px",
          mb: 0.5,
          mx: collapsed ? 1 : 1.5,
          px: collapsed ? 1.5 : 2,
          py: 1,
          justifyContent: collapsed ? "center" : "flex-start",
          bgcolor: active ? "rgba(255,255,255,0.12)" : "transparent",
          border: active ? `1px solid ${SIDEBAR_BORDER}` : "1px solid transparent",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.10)",
            border: `1px solid ${SIDEBAR_BORDER}`,
          },
          transition: "all 0.2s ease",
        }}
      >
        <ListItemIcon
          sx={{
            color: active ? "#ffffff" : SIDEBAR_MUTED,
            minWidth: collapsed ? 0 : 36,
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
                  color: active ? SIDEBAR_TEXT : SIDEBAR_MUTED,
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
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/authentication/sign-in", { replace: true });
  };

  const drawerWidth = collapsed ? 72 : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F8F9FA" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            bgcolor: SIDEBAR_BG,
            borderRight: `1px solid ${SIDEBAR_BORDER}`,
            boxShadow: "0 18px 36px rgba(15,23,42,0.24)",
            transition: "width 0.25s ease",
            overflowX: "hidden",
          },
        }}
      >
        {/* Logo et header */}
        <Box sx={{ p: collapsed ? 2 : 2.5 }}>
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
                      viewisecrm
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: SIDEBAR_MUTED,
                        fontSize: 10,
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
                <IconButton onClick={() => setCollapsed(false)} sx={{ color: SIDEBAR_MUTED, p: 0.5, "&:hover": { color: "#fff" } }}>
                  <Menu fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: SIDEBAR_BORDER, mx: 2 }} />

        {/* Navigation */}
        <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 2 }}>
          {NAV_SECTIONS.map((section) => (
            <Box key={section.title}>
              {!collapsed && (
                <Box sx={{ px: 2.5, py: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(255,255,255,0.46)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontSize: 11,
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
                borderRadius: "10px",
                px: collapsed ? 1.5 : 2,
                py: 1,
                justifyContent: collapsed ? "center" : "flex-start",
                bgcolor: "rgba(255,255,255,0.10)",
                border: `1px solid ${SIDEBAR_BORDER}`,
                "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
              }}
            >
              <ListItemIcon
                sx={{
                  color: "#fff",
                  minWidth: collapsed ? 0 : 36,
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
          background:
            "radial-gradient(circle at top right, rgba(193,18,31,0.07), transparent 28rem), #F8F9FA",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

SuperAdminLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SuperAdminLayout;
