/* eslint-disable prettier/prettier */
// src/components/NotificationBell/index.jsx
// Cloche de notifications à intégrer dans DashboardNavbar

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Badge,
  IconButton,
  Typography,
  Stack,
  Avatar,
  Chip,
  Divider,
  Tooltip,
  CircularProgress,
  ClickAwayListener,
} from "@mui/material";
import {
  Notifications as BellIcon,
  NotificationsNone as BellEmptyIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  FiberManualRecord as DotIcon,
  Person as PersonIcon,
  Assignment as TaskIcon,
  Business as BusinessIcon,
  ContactPage as ContactIcon,
  TrendingUp as OpportunityIcon,
  Campaign as ActivityIcon,
  Group as TeamIcon,
  DoneAll as DoneAllIcon,
} from "@mui/icons-material";
import { alpha, styled, keyframes } from "@mui/material/styles";
import { useNotifications } from "../../hooks/useNotifications";

// ─── TOKENS ──────────────────────────────────────────────────────
const C = {
  red: "#dc2626",
  grad: "linear-gradient(135deg,#dc2626,#991b1b)",
  green: "#059669",
  blue: "#2563eb",
  amber: "#d97706",
  purple: "#7c3aed",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n400: "#94a3b8",
  n500: "#64748b",
  n800: "#1e293b",
};

// ─── KEYFRAMES ────────────────────────────────────────────────────
const popIn = keyframes`
  0%   { opacity:0; transform:scale(0.92) translateY(-8px); }
  100% { opacity:1; transform:scale(1)    translateY(0);    }
`;
const pulse = keyframes`
  0%,100% { transform:scale(1);    }
  50%      { transform:scale(1.18); }
`;

// ─── STYLED ──────────────────────────────────────────────────────
const Dropdown = styled(Box)(() => ({
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: 380,
  maxHeight: 520,
  background: "#fff",
  borderRadius: 20,
  border: `1px solid ${C.n200}`,
  boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
  overflow: "hidden",
  animation: `${popIn} 0.18s cubic-bezier(0.34,1.56,0.64,1)`,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
}));

const NotifItem = styled(Box)(({ unread }) => ({
  padding: "12px 16px",
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
  transition: "background 0.12s",
  background: unread ? alpha(C.red, 0.03) : "transparent",
  borderLeft: unread ? `3px solid ${C.red}` : "3px solid transparent",
  "&:hover": { background: alpha(C.n50, 0.9) },
}));

// ─── ICONS PAR TYPE D'ENTITÉ ──────────────────────────────────────
const entityIcon = (type) => {
  const map = {
    prospect: { icon: <PersonIcon sx={{ fontSize: 16 }} />, color: C.blue },
    contact: { icon: <ContactIcon sx={{ fontSize: 16 }} />, color: C.purple },
    opportunity: { icon: <OpportunityIcon sx={{ fontSize: 16 }} />, color: C.amber },
    task: { icon: <TaskIcon sx={{ fontSize: 16 }} />, color: C.green },
    activity: { icon: <ActivityIcon sx={{ fontSize: 16 }} />, color: C.red },
    team: { icon: <TeamIcon sx={{ fontSize: 16 }} />, color: C.n500 },
    company: { icon: <BusinessIcon sx={{ fontSize: 16 }} />, color: C.n500 },
    user: { icon: <PersonIcon sx={{ fontSize: 16 }} />, color: C.n500 },
  };
  return map[type] || { icon: <BellIcon sx={{ fontSize: 16 }} />, color: C.n400 };
};

const notifTypeColor = { info: C.blue, success: C.green, warning: C.amber, error: C.red };

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotif,
  } = useNotifications();

  // Charger au clic sur la cloche
  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen((o) => !o);
  };

  const handleMarkOne = (e, id) => {
    e.stopPropagation();
    markRead([id]);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteNotif(id);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={wrapRef} sx={{ position: "relative", display: "inline-flex" }}>
        {/* ── CLOCHE ── */}
        <Tooltip title="Notifications" placement="bottom">
          <IconButton
            onClick={handleOpen}
            size="small"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 10,
              bgcolor: open ? alpha(C.red, 0.08) : "transparent",
              "&:hover": { bgcolor: alpha(C.red, 0.06) },
              transition: "background 0.15s",
            }}
          >
            <Badge
              badgeContent={unreadCount || 0}
              max={99}
              sx={{
                "& .MuiBadge-badge": {
                  background: C.grad,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 17,
                  height: 17,
                  animation: unreadCount > 0 ? `${pulse} 2s ease infinite` : "none",
                },
              }}
            >
              {unreadCount > 0 ? (
                <BellIcon sx={{ fontSize: 20, color: C.red }} />
              ) : (
                <BellEmptyIcon sx={{ fontSize: 20, color: C.n400 }} />
              )}
            </Badge>
          </IconButton>
        </Tooltip>

        {/* ── DROPDOWN ── */}
        {open && (
          <Dropdown>
            {/* Header */}
            <Box
              sx={{
                px: 2.5,
                py: 2,
                borderBottom: `1px solid ${C.n200}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: C.n800 }}>
                  Notifications
                </Typography>
                {unreadCount > 0 && (
                  <Typography sx={{ fontSize: 11, color: C.red, fontWeight: 600, mt: 0.1 }}>
                    {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </Typography>
                )}
              </Box>
              {unreadCount > 0 && (
                <Tooltip title="Tout marquer comme lu">
                  <IconButton
                    size="small"
                    onClick={markAllRead}
                    sx={{
                      bgcolor: alpha(C.green, 0.08),
                      borderRadius: 8,
                      "&:hover": { bgcolor: alpha(C.green, 0.15) },
                    }}
                  >
                    <DoneAllIcon sx={{ fontSize: 16, color: C.green }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Body */}
            <Box
              sx={{
                overflowY: "auto",
                flex: 1,
                "&::-webkit-scrollbar": { width: 4 },
                "&::-webkit-scrollbar-thumb": { bgcolor: C.n200, borderRadius: 2 },
              }}
            >
              {loading ? (
                <Box sx={{ textAlign: "center", py: 5 }}>
                  <CircularProgress size={24} sx={{ color: C.red }} />
                </Box>
              ) : notifications.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <BellEmptyIcon sx={{ fontSize: 40, color: C.n300, mb: 1 }} />
                  <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune notification</Typography>
                </Box>
              ) : (
                notifications.map((n, idx) => {
                  const { icon, color } = entityIcon(n.entity_type);
                  const tc = notifTypeColor[n.notif_type] || C.blue;
                  return (
                    <React.Fragment key={n.id}>
                      <NotifItem
                        unread={!n.is_read ? 1 : 0}
                        onClick={() => !n.is_read && markRead([n.id])}
                      >
                        {/* Icon */}
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            bgcolor: alpha(color, 0.1),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            mt: 0.2,
                          }}
                        >
                          {React.cloneElement(icon, { sx: { fontSize: 16, color } })}
                        </Box>

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={0.8} mb={0.2}>
                            <Typography
                              sx={{
                                fontSize: 13,
                                fontWeight: n.is_read ? 500 : 700,
                                color: C.n800,
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {n.title}
                            </Typography>
                            {!n.is_read && (
                              <DotIcon sx={{ fontSize: 8, color: C.red, flexShrink: 0 }} />
                            )}
                          </Stack>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: C.n500,
                              lineHeight: 1.4,
                              mb: 0.5,
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {n.message}
                          </Typography>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography sx={{ fontSize: 10, color: C.n400 }}>
                              {timeAgo(n.created_at)}
                            </Typography>
                            {n.entity_name && (
                              <Chip
                                label={n.entity_name}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: 9,
                                  bgcolor: alpha(color, 0.08),
                                  color,
                                  fontWeight: 600,
                                  maxWidth: 100,
                                  "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  },
                                }}
                              />
                            )}
                          </Stack>
                        </Box>

                        {/* Actions */}
                        <Stack spacing={0.4} flexShrink={0} ml={0.5}>
                          {!n.is_read && (
                            <Tooltip title="Marquer lu">
                              <IconButton
                                size="small"
                                onClick={(e) => handleMarkOne(e, n.id)}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  bgcolor: alpha(C.green, 0.08),
                                  borderRadius: 6,
                                  "&:hover": { bgcolor: alpha(C.green, 0.15) },
                                }}
                              >
                                <CheckIcon sx={{ fontSize: 13, color: C.green }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              onClick={(e) => handleDelete(e, n.id)}
                              sx={{
                                width: 24,
                                height: 24,
                                bgcolor: alpha(C.red, 0.06),
                                borderRadius: 6,
                                "&:hover": { bgcolor: alpha(C.red, 0.14) },
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 13, color: C.red }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </NotifItem>
                      {idx < notifications.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })
              )}
            </Box>

            {/* Footer */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderTop: `1px solid ${C.n200}`,
                flexShrink: 0,
                textAlign: "center",
              }}
            >
              <Typography
                component="a"
                href="/history"
                sx={{
                  fontSize: 12,
                  color: C.red,
                  fontWeight: 700,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Voir tout l&apos;historique →
              </Typography>
            </Box>
          </Dropdown>
        )}
      </Box>
    </ClickAwayListener>
  );
}
