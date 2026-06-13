import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import {
  CheckCircle,
  ErrorOutline,
  Facebook,
  Instagram,
  LinkedIn,
  Login,
  Refresh,
  RestartAlt,
} from "@mui/icons-material";

import {
  checkSocialSession,
  resetSocialSession,
  startSocialLogin,
} from "../../services/engagementApi";

const PLATFORMS = [
  { key: "linkedin", label: "LinkedIn", icon: <LinkedIn fontSize="small" />, color: "#0077b5" },
  { key: "facebook", label: "Facebook", icon: <Facebook fontSize="small" />, color: "#1877f2" },
  { key: "instagram", label: "Instagram", icon: <Instagram fontSize="small" />, color: "#c13584" },
];

function normalizeStatus(result) {
  if (!result) return "unknown";
  if (result.success && result.status === "session_ready") return "connected";
  if (result.status === "login_window_open") return "window_open";
  if (result.status === "checkpoint_required") return "checkpoint";
  if (result.status === "login_required") return "login_required";
  if (result.status === "session_check_error" || result.status === "error") return "error";
  return result.success ? "connected" : "login_required";
}

function statusLabel(status) {
  if (status === "connected") return "Connecte";
  if (status === "window_open") return "Fenetre ouverte";
  if (status === "checkpoint") return "Verification requise";
  if (status === "login_required") return "Non connecte";
  if (status === "checking") return "Verification...";
  if (status === "connecting") return "Ouverture...";
  if (status === "resetting") return "Reinitialisation...";
  if (status === "error") return "Erreur";
  return "Non verifie";
}

function statusColor(status) {
  if (status === "connected") return "#059669";
  if (status === "window_open") return "#2563eb";
  if (status === "checkpoint") return "#d97706";
  if (status === "error") return "#dc2626";
  return "#6b7280";
}

export function isSessionReady(session) {
  return (
    session?.status === "connected" ||
    (session?.success === true && ["connected", "session_ready"].includes(session?.status)) ||
    (session?.ok === true && session?.status === "connected")
  );
}

export default function SocialConnectionBox({
  sessions: externalSessions,
  requiredPlatforms,
  title,
  compact,
  onChange,
  onStatusChange,
  showAllWhenRequired,
}) {
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState({});

  const visiblePlatforms = useMemo(() => {
    if (!requiredPlatforms?.length || showAllWhenRequired) return PLATFORMS;
    const requiredSet = new Set(requiredPlatforms);
    return PLATFORMS.filter((platform) => requiredSet.has(platform.key));
  }, [requiredPlatforms, showAllWhenRequired]);

  const requiredSet = useMemo(() => new Set(requiredPlatforms || []), [requiredPlatforms]);

  const publishSessions = useCallback(
    (next) => {
      if (onChange) onChange(next);
      if (onStatusChange) onStatusChange(next);
    },
    [onChange, onStatusChange]
  );

  const updatePlatformState = useCallback(
    (platform, result) => {
      setSessions((prev) => {
        const next = { ...prev, [platform]: result };
        publishSessions(next);
        return next;
      });
    },
    [publishSessions]
  );

  const checkSession = useCallback(
    async (platform) => {
      setLoading((prev) => ({ ...prev, [platform]: "checking" }));
      try {
        const response = await checkSocialSession(platform);
        updatePlatformState(platform, response.data);
      } catch (error) {
        updatePlatformState(platform, {
          success: false,
          status: "error",
          platform,
          message: error.response?.data?.message || "Erreur pendant la verification.",
        });
      } finally {
        setLoading((prev) => ({ ...prev, [platform]: null }));
      }
    },
    [updatePlatformState]
  );

  const connectSession = async (platform) => {
    setLoading((prev) => ({ ...prev, [platform]: "connecting" }));
    try {
      const response = await startSocialLogin(platform);
      updatePlatformState(platform, response.data);
    } catch (error) {
      updatePlatformState(platform, {
        success: false,
        status: "error",
        platform,
        message: error.response?.data?.message || "Impossible d'ouvrir la fenetre de connexion.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: null }));
    }
  };

  const resetSession = async (platform) => {
    const confirmed = window.confirm(
      `Reinitialiser la session ${platform} ? Vous devrez vous reconnecter.`
    );
    if (!confirmed) return;

    setLoading((prev) => ({ ...prev, [platform]: "resetting" }));
    try {
      const response = await resetSocialSession(platform);
      updatePlatformState(platform, response.data);
    } catch (error) {
      updatePlatformState(platform, {
        success: false,
        status: "error",
        platform,
        message: error.response?.data?.message || "Impossible de reinitialiser la session.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: null }));
    }
  };

  const checkAll = async () => {
    for (const platform of visiblePlatforms) {
      await checkSession(platform.key);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 1.5 : 2,
        borderRadius: 1,
        bgcolor: "#fff",
        borderColor: "#e5e7eb",
      }}
    >
      <Stack spacing={compact ? 1.25 : 1.75}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box>
            <Typography variant={compact ? "subtitle2" : "h6"} fontWeight={800}>
              {title}
            </Typography>
            {!compact && (
              <Typography variant="body2" color="text.secondary">
                Connectez vos comptes avant de lancer l&apos;agent.
              </Typography>
            )}
          </Box>
          <Tooltip title="Verifier toutes les sessions">
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={checkAll}
              sx={{ color: "#C8102E", textTransform: "none" }}
            >
              Verifier tout
            </Button>
          </Tooltip>
        </Stack>

        {visiblePlatforms.map((platform) => {
          const result = externalSessions?.[platform.key] || sessions[platform.key];
          const loadingState = loading[platform.key];
          const computedStatus = loadingState || normalizeStatus(result);
          const color = statusColor(computedStatus);
          const isRequired = requiredSet.has(platform.key);

          return (
            <Paper key={platform.key} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1.25}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Box sx={{ color: platform.color, display: "flex" }}>{platform.icon}</Box>
                    <Typography variant="body2" fontWeight={800}>
                      {platform.label}
                    </Typography>
                    {isRequired && <Chip size="small" label="Requis" sx={{ borderRadius: 1 }} />}
                    <Chip
                      size="small"
                      icon={computedStatus === "connected" ? <CheckCircle /> : <ErrorOutline />}
                      label={statusLabel(computedStatus)}
                      sx={{
                        borderRadius: 1,
                        color,
                        bgcolor: alpha(color, 0.1),
                        border: `1px solid ${alpha(color, 0.25)}`,
                        "& .MuiChip-icon": { color },
                      }}
                    />
                  </Stack>
                  {result?.message && (
                    <Alert severity={result.success ? "info" : "warning"} sx={{ mt: 1, py: 0 }}>
                      {result.message}
                    </Alert>
                  )}
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                  <Button
                    size="small"
                    startIcon={
                      loadingState === "connecting" ? <CircularProgress size={14} /> : <Login />
                    }
                    onClick={() => connectSession(platform.key)}
                    disabled={Boolean(loadingState)}
                    variant="contained"
                    sx={{
                      bgcolor: "#C8102E",
                      "&:hover": { bgcolor: "#9B0D22" },
                      textTransform: "none",
                    }}
                  >
                    Connecter
                  </Button>
                  <Button
                    size="small"
                    startIcon={
                      loadingState === "checking" ? <CircularProgress size={14} /> : <Refresh />
                    }
                    onClick={() => checkSession(platform.key)}
                    disabled={Boolean(loadingState)}
                    sx={{ color: "#C8102E", textTransform: "none" }}
                  >
                    Verifier
                  </Button>
                  <Button
                    size="small"
                    startIcon={
                      loadingState === "resetting" ? <CircularProgress size={14} /> : <RestartAlt />
                    }
                    onClick={() => resetSession(platform.key)}
                    disabled={Boolean(loadingState)}
                    sx={{ color: "#991b1b", textTransform: "none" }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
}

SocialConnectionBox.propTypes = {
  sessions: PropTypes.objectOf(PropTypes.object),
  requiredPlatforms: PropTypes.arrayOf(PropTypes.oneOf(["linkedin", "facebook", "instagram"])),
  title: PropTypes.string,
  compact: PropTypes.bool,
  onChange: PropTypes.func,
  onStatusChange: PropTypes.func,
  showAllWhenRequired: PropTypes.bool,
};

SocialConnectionBox.defaultProps = {
  sessions: null,
  requiredPlatforms: [],
  title: "Connexions sociales",
  compact: false,
  onChange: null,
  onStatusChange: null,
  showAllWhenRequired: true,
};
