import React from "react";
import PropTypes from "prop-types";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningIcon from "@mui/icons-material/Warning";

const palette = {
  red: "#dc2626",
  redDeep: "#7f1d1d",
  ink: "#0f172a",
  line: "rgba(255,255,255,0.16)",
  white: "#ffffff",
};

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CRM"
  );
}

function CommandMetric({ label, value, helper, icon, tone }) {
  const color = tone || "#ffffff";
  return (
    <Box
      sx={{
        minWidth: { xs: "calc(50% - 8px)", sm: 148 },
        flex: { xs: "1 1 calc(50% - 8px)", sm: "0 0 auto" },
        p: 1.4,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.18)",
        bgcolor: "rgba(255,255,255,0.10)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.66)" }}>
          {label}
        </Typography>
        {icon && (
          <Box sx={{ color: alpha(color, 0.95), display: "flex", "& svg": { fontSize: 16 } }}>
            {icon}
          </Box>
        )}
      </Stack>
      <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.1, mt: 0.7 }}>
        {value}
      </Typography>
      {helper && (
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.68)", mt: 0.25 }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
}

CommandMetric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  helper: PropTypes.string,
  icon: PropTypes.node,
  tone: PropTypes.string,
};

CommandMetric.defaultProps = {
  helper: "",
  icon: null,
  tone: "#ffffff",
};

export default function DashboardCommandCenter({
  eyebrow,
  title,
  subtitle,
  userName,
  metrics,
  alerts,
  onRefresh,
  feedback,
}) {
  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 2.2, md: 3 },
        borderRadius: 3,
        overflow: "hidden",
        position: "relative",
        background: `linear-gradient(135deg, ${palette.ink} 0%, ${palette.redDeep} 54%, ${palette.red} 100%)`,
        boxShadow: `0 18px 42px ${alpha(palette.redDeep, 0.26)}`,
        border: "1px solid rgba(255,255,255,0.12)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.18))",
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.10), transparent 36%), linear-gradient(180deg, transparent, rgba(15,23,42,0.18))",
          pointerEvents: "none",
        },
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        alignItems={{ xs: "stretch", lg: "center" }}
        justifyContent="space-between"
        spacing={2.4}
        sx={{ position: "relative", zIndex: 1 }}
      >
        <Stack direction="row" spacing={1.8} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.26)",
              color: "#fff",
              fontSize: 18,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {getInitials(userName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 900,
                color: "rgba(255,255,255,0.64)",
                textTransform: "uppercase",
                letterSpacing: 0,
                mb: 0.4,
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 22, md: 28 },
                fontWeight: 950,
                color: "#fff",
                lineHeight: 1.08,
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.70)", mt: 0.7 }}>
              {subtitle}
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.4} sx={{ alignItems: { xs: "stretch", lg: "flex-end" } }}>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1}
            justifyContent={{ xs: "flex-start", lg: "flex-end" }}
          >
            {alerts.map((alert) => (
              <Chip
                key={alert.label}
                icon={alert.icon || <WarningIcon sx={{ color: "#fde68a !important" }} />}
                label={alert.label}
                sx={{
                  color: "#fff",
                  fontWeight: 800,
                  bgcolor: "rgba(255,255,255,0.13)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  "& .MuiChip-icon": { color: "#fff" },
                }}
              />
            ))}
            <Chip
              icon={<RefreshIcon sx={{ color: "#fff !important" }} />}
              label="Actualiser"
              onClick={onRefresh}
              sx={{
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
                bgcolor: "rgba(255,255,255,0.11)",
                border: "1px solid rgba(255,255,255,0.22)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
              }}
            />
            {feedback && (
              <Box
                sx={{
                  "& .MuiButton-root": {
                    borderColor: "rgba(255,255,255,.58)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 20,
                    textTransform: "none",
                    minHeight: 32,
                  },
                }}
              >
                {feedback}
              </Box>
            )}
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {metrics.map((metric) => (
              <CommandMetric key={metric.label} {...metric} />
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

DashboardCommandCenter.propTypes = {
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  userName: PropTypes.string,
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      helper: PropTypes.string,
      icon: PropTypes.node,
      tone: PropTypes.string,
    })
  ),
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
    })
  ),
  onRefresh: PropTypes.func,
  feedback: PropTypes.node,
};

DashboardCommandCenter.defaultProps = {
  userName: "",
  metrics: [],
  alerts: [],
  onRefresh: () => {},
  feedback: null,
};
