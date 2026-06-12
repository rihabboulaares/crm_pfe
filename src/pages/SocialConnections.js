/* eslint-disable prettier/prettier */
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Delete, Facebook, Instagram, LinkedIn, Refresh, UploadFile } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  checkSocialSession,
  deleteSocialSession,
  getSocialSessions,
  uploadSocialSession,
} from "services/socialSessionsApi";

const RED = "#C1121F";
const toolUrl = "/tools/CRM-Social-Connector.exe";
const toolManifestUrl = "/tools/tool-manifest.json";

const PLATFORMS = [
  { key: "linkedin", label: "LinkedIn", icon: <LinkedIn />, color: "#0A66C2" },
  { key: "facebook", label: "Facebook", icon: <Facebook />, color: "#1877F2" },
  { key: "instagram", label: "Instagram", icon: <Instagram />, color: "#C13584" },
];

const STATUS = {
  connected: { label: "Connecté", bg: "#DCFCE7", color: "#059669" },
  not_connected: { label: "Non connecté", bg: "#F3F4F6", color: "#6B7280" },
  expired: { label: "Session expirée", bg: "#FEF3C7", color: "#D97706" },
  verification_required: { label: "Vérification requise", bg: "#FEE2E2", color: RED },
  error: { label: "Erreur", bg: "#FEE2E2", color: RED },
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Jamais";

export default function SocialConnections() {
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const fileInputs = useRef({});

  const load = () => {
    setLoading(true);
    getSocialSessions()
      .then((res) => {
        const next = {};
        (res.data || []).forEach((item) => {
          next[item.platform] = item;
        });
        setSessions(next);
      })
      .catch(() => setNotice({ type: "error", text: "Impossible de charger les connexions sociales." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = (platform, file) => {
    if (!file) return;
    setBusy(platform);
    uploadSocialSession(platform, file)
      .then((res) => {
        setNotice({ type: "success", text: res.data?.message || "Session importée." });
        load();
      })
      .catch((err) =>
        setNotice({
          type: "error",
          text: err?.response?.data?.message || "Import impossible. Vérifiez le fichier JSON.",
        })
      )
      .finally(() => setBusy(""));
  };

  const handleCheck = (platform) => {
    setBusy(platform);
    checkSocialSession(platform)
      .then((res) => {
        setNotice({ type: res.data?.ok ? "success" : "warning", text: res.data?.message || "Vérification terminée." });
        load();
      })
      .catch(() => setNotice({ type: "error", text: "Vérification impossible." }))
      .finally(() => setBusy(""));
  };

  const handleDelete = (platform) => {
    setBusy(platform);
    deleteSocialSession(platform)
      .then((res) => {
        setNotice({ type: "success", text: res.data?.message || "Session supprimée." });
        load();
      })
      .catch(() => setNotice({ type: "error", text: "Suppression impossible." }))
      .finally(() => setBusy(""));
  };

  const handleDownloadTool = async () => {
    try {
      const response = await fetch(toolManifestUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("manifest_not_found");

      const manifest = await response.json();
      if (!manifest.available) throw new Error("tool_not_available");

      const link = document.createElement("a");
      link.href = toolUrl;
      link.download = "CRM-Social-Connector.exe";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setNotice({
        type: "warning",
        text: "L'outil n'est pas encore disponible. Générez CRM-Social-Connector.exe depuis le dossier social_session_tool.",
      });
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#111827" }}>
              Mes connexions sociales
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280" }}>
              Importez vos sessions locales pour LinkedIn, Facebook et Instagram.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={handleDownloadTool}
            sx={{ borderColor: RED, color: RED, textTransform: "none" }}
          >
            Télécharger outil
          </Button>
        </Stack>

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress sx={{ color: RED }} />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {PLATFORMS.map((platform) => {
              const session = sessions[platform.key] || { platform: platform.key, status: "not_connected" };
              const status = STATUS[session.status] || STATUS.error;
              const isBusy = busy === platform.key;
              return (
                <Grid item xs={12} md={4} key={platform.key}>
                  <Card sx={{ borderRadius: 3, p: 3, height: "100%", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Avatar sx={{ bgcolor: alpha(platform.color, 0.12), color: platform.color }}>
                        {platform.icon}
                      </Avatar>
                      <Chip label={status.label} sx={{ bgcolor: status.bg, color: status.color, fontWeight: 800 }} />
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {platform.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#6B7280", mt: 0.5 }}>
                      Dernière vérification : {formatDate(session.last_checked_at)}
                    </Typography>
                    {session.last_error && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {session.last_error}
                      </Alert>
                    )}

                    <input
                      hidden
                      type="file"
                      accept=".json,application/json"
                      ref={(el) => {
                        fileInputs.current[platform.key] = el;
                      }}
                      onChange={(event) => handleUpload(platform.key, event.target.files?.[0])}
                    />
                    <Stack spacing={1.2} mt={3}>
                      <Button
                        variant="contained"
                        startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <UploadFile />}
                        onClick={() => fileInputs.current[platform.key]?.click()}
                        disabled={isBusy}
                        sx={{ bgcolor: RED, textTransform: "none", "&:hover": { bgcolor: "#9B0D22" } }}
                      >
                        Importer session
                      </Button>
                      <Button startIcon={<Refresh />} disabled={isBusy} onClick={() => handleCheck(platform.key)} sx={{ textTransform: "none" }}>
                        Vérifier session
                      </Button>
                      <Button color="error" startIcon={<Delete />} disabled={isBusy} onClick={() => handleDelete(platform.key)} sx={{ textTransform: "none" }}>
                        Supprimer session
                      </Button>
                    </Stack>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
      <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice(null)}>
        {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      </Snackbar>
    </DashboardLayout>
  );
}
