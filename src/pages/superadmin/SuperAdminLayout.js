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
  AdminPanelSettings,
  ChevronLeft,
  Group,
  Mail,
  PersonAdd,
  Contacts,
  AttachMoney,
  CheckCircle,
  TrendingUp,
  Settings,
  Assessment,
  Campaign,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

const DRAWER_WIDTH = 260;
const RED = "#dc2626";

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
          bgcolor: active ? alpha(RED, 0.04) : "transparent",
          border: active ? `1px solid ${alpha(RED, 0.2)}` : "1px solid transparent",
          "&:hover": {
            bgcolor: alpha(RED, 0.02),
            border: `1px solid ${alpha(RED, 0.1)}`,
          },
          transition: "all 0.2s ease",
        }}
      >
        <ListItemIcon
          sx={{
            color: active ? RED : "#64748b",
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
                  color: active ? "#0f172a" : "#334155",
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            bgcolor: "#ffffff",
            borderRight: "1px solid",
            borderColor: alpha("#e2e8f0", 0.8),
            boxShadow: "2px 0 12px rgba(0,0,0,0.02)",
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
                      bgcolor: RED,
                      width: 36,
                      height: 36,
                    }}
                  >
                    <AdminPanelSettings sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        color: "#0f172a",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        fontSize: 16,
                      }}
                    >
                      CRM Pro
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#64748b",
                        fontSize: 10,
                      }}
                    >
                      Administration
                    </Typography>
                  </Box>
                </Stack>
                <IconButton
                  onClick={() => setCollapsed(true)}
                  sx={{
                    color: "#64748b",
                    p: 0.5,
                    "&:hover": { bgcolor: alpha(RED, 0.04), color: RED },
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
                    bgcolor: RED,
                    width: 40,
                    height: 40,
                  }}
                >
                  <AdminPanelSettings sx={{ fontSize: 22 }} />
                </Avatar>
                <IconButton onClick={() => setCollapsed(false)} sx={{ color: "#64748b", p: 0.5 }}>
                  <Menu fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#e2e8f0", 0.5), mx: 2 }} />

        {/* Navigation */}
        <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 2 }}>
          {NAV_SECTIONS.map((section) => (
            <Box key={section.title}>
              {!collapsed && (
                <Box sx={{ px: 2.5, py: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#94a3b8",
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

        <Divider sx={{ borderColor: alpha("#e2e8f0", 0.5), mx: 2 }} />

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
                bgcolor: alpha(RED, 0.02),
                border: `1px solid ${alpha(RED, 0.1)}`,
                "&:hover": { bgcolor: alpha(RED, 0.06) },
              }}
            >
              <ListItemIcon
                sx={{
                  color: RED,
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
                    color: RED,
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
          bgcolor: "#f8fafc",
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
