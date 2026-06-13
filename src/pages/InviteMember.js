// src/pages/InviteMember.jsx
import { useState, useEffect } from "react";
import {
  Typography,
  TextField,
  MenuItem,
  Paper,
  Grid,
  Box,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Divider,
  Avatar,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
} from "@mui/material";
import {
  Send,
  Mail,
  PersonAdd,
  AdminPanelSettings,
  SupervisorAccount,
  BusinessCenter,
  Info,
  CheckCircle,
  Error,
  Close,
  GroupAdd,
  Email,
  Security,
  ArrowBack,
} from "@mui/icons-material";
import { styled, keyframes, alpha } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useMaterialUIController, setLayout } from "context";

// Animations
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

// Thème rouge cohérent avec le profil
const redTheme = {
  primary: {
    main: "#dc2626",
    light: "#ef4444",
    lighter: "#f87171",
    subtle: "#fee2e2",
    pale: "#fef2f2",
    gradient: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
    glow: "0 0 20px rgba(220, 38, 38, 0.3)",
  },
  success: {
    main: "#10b981",
    light: "#34d399",
    subtle: "#d1fae5",
  },
  warning: {
    main: "#f59e0b",
    light: "#fbbf24",
  },
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },
};

// Composants stylisés
const AnimatedCard = styled(motion(Card))(({ theme }) => ({
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(10px)",
  borderRadius: 24,
  border: `2px solid ${redTheme.primary.subtle}`,
  boxShadow: `0 20px 40px ${alpha(redTheme.primary.main, 0.1)}`,
  overflow: "hidden",
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: redTheme.primary.gradient,
    animation: `${shimmer} 3s infinite linear`,
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 16,
    backgroundColor: "white",
    transition: "all 0.3s ease",
    "&:hover": {
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: redTheme.primary.light,
        borderWidth: 2,
      },
    },
    "&.Mui-focused": {
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: redTheme.primary.main,
        borderWidth: 2,
      },
    },
  },
  "& .MuiInputLabel-root": {
    "&.Mui-focused": {
      color: redTheme.primary.main,
    },
  },
}));

const RoleCard = styled(motion(Paper))(({ theme, selected }) => ({
  padding: theme.spacing(2),
  borderRadius: 20,
  border: `2px solid ${selected ? redTheme.primary.main : redTheme.primary.subtle}`,
  background: selected ? redTheme.primary.pale : "white",
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    borderColor: redTheme.primary.main,
    boxShadow: redTheme.primary.glow,
  },
}));

const AnimatedButton = styled(motion(MDButton))(({ theme }) => ({
  borderRadius: 16,
  padding: "12px 24px",
  textTransform: "none",
  fontWeight: 600,
  fontSize: "1rem",
  position: "relative",
  overflow: "hidden",
  background: redTheme.primary.gradient,
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: "-100%",
    width: "100%",
    height: "100%",
    background: `linear-gradient(90deg, transparent, ${alpha("#ffffff", 0.3)}, transparent)`,
    transition: "left 0.5s ease",
  },
  "&:hover::before": {
    left: "100%",
  },
}));

const roleConfig = {
  ADMIN: {
    label: "Administrateur",
    icon: <AdminPanelSettings sx={{ fontSize: 40, color: redTheme.primary.main }} />,
    description: "Accès complet à toutes les fonctionnalités",
    color: redTheme.primary.gradient,
    permissions: [
      "Gérer les utilisateurs",
      "Configurer le CRM",
      "Accès aux paramètres",
      "Toutes les permissions",
    ],
  },
  MANAGER: {
    label: "Manager",
    icon: <SupervisorAccount sx={{ fontSize: 40, color: redTheme.warning.main }} />,
    description: "Gère les équipes et les projets",
    color: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
    permissions: [
      "Gérer son équipe",
      "Voir les rapports",
      "Assigner des tâches",
      "Valider les projets",
    ],
  },
  COMMERCIAL: {
    label: "Commercial",
    icon: <BusinessCenter sx={{ fontSize: 40, color: redTheme.success.main }} />,
    description: "Gère les clients et les ventes",
    color: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
    permissions: ["Gérer les prospects", "Créer des devis", "Suivre les ventes", "Accès client"],
  },
};

const InviteMember = () => {
  const [, dispatch] = useMaterialUIController();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("COMMERCIAL");
  const [teamId, setTeamId] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [showRoleInfo, setShowRoleInfo] = useState(false);

  const navigate = useNavigate();
  const accessToken = localStorage.getItem("token");

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  useEffect(() => {
    if (!accessToken) {
      navigate("/sign-in");
      return;
    }

    const fetchUser = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/users/me/", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const userData = await res.json();

        if (userData.teams && userData.teams.length > 0) {
          setTeamId(userData.teams[0].id);
          setTeamName(userData.teams[0].name || "Mon équipe");
        } else {
          setMessage("Aucune équipe trouvée. Vous devez d'abord créer une équipe.");
          setMessageType("warning");
        }
      } catch (err) {
        console.error(err);
        setMessage("Erreur lors de la récupération des données.");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [accessToken, navigate]);

  const handleInvite = async () => {
    if (!teamId) {
      setMessage("Équipe introuvable. Veuillez réessayer.");
      setMessageType("error");
      setOpenSnackbar(true);
      return;
    }

    if (!email) {
      setMessage("Veuillez entrer une adresse email.");
      setMessageType("warning");
      setOpenSnackbar(true);
      return;
    }

    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage("Veuillez entrer une adresse email valide.");
      setMessageType("warning");
      setOpenSnackbar(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/users/invite-member/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email, role, team_id: teamId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(
          `✅ Invitation envoyée avec succès à ${email} en tant que ${roleConfig[role].label}`
        );
        setMessageType("success");
        setEmail("");
        setOpenSnackbar(true);

        // Animation de succès
        setTimeout(() => {
          // Optionnel : rediriger vers la page d'équipe
          // navigate("/profile?tab=team");
        }, 2000);
      } else {
        setMessage(data.error || "Erreur lors de l'envoi de l'invitation.");
        setMessageType("error");
        setOpenSnackbar(true);
      }
    } catch (err) {
      console.error(err);
      setMessage("Erreur de connexion au serveur.");
      setMessageType("error");
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
  };

  return (
    <Box className="auth-shell team-page">
      <Box className="auth-header">
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box className="public-logo-mark">V</Box>
          <Typography className="public-logo-text">ViewiseCRM</Typography>
        </Stack>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* En-tête avec animation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Avatar
                sx={{
                  bgcolor: redTheme.primary.main,
                  width: 56,
                  height: 56,
                }}
              >
                <GroupAdd sx={{ fontSize: 30 }} />
              </Avatar>
            </motion.div>
            <Box>
              <Typography variant="h3" fontWeight="700" gutterBottom>
                Inviter un membre
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Ajoutez un collaborateur à votre équipe ViewiseCRM.
              </Typography>
            </Box>
          </Box>
        </motion.div>

        <Grid container spacing={3}>
          {/* Formulaire d'invitation */}
          <Grid item xs={12} md={7}>
            <AnimatedCard
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              sx={{ p: 4 }}
            >
              <Typography variant="h5" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
                Informations du membre
              </Typography>

              <Stack spacing={3}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <StyledTextField
                    label="Adresse email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    placeholder="exemple@email.com"
                    InputProps={{
                      startAdornment: <Email sx={{ mr: 1, color: redTheme.neutral[400] }} />,
                    }}
                  />
                </motion.div>

                <Box>
                  <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                    Rôle
                  </Typography>

                  <Grid container spacing={2}>
                    {Object.entries(roleConfig).map(([key, config], index) => (
                      <Grid item xs={12} key={key}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                        >
                          <RoleCard
                            selected={role === key}
                            onClick={() => handleRoleSelect(key)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                              <Box
                                sx={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 3,
                                  background: config.color,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {config.icon}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box
                                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
                                >
                                  <Typography variant="h6" fontWeight="600">
                                    {config.label}
                                  </Typography>
                                  {role === key && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: "spring" }}
                                    >
                                      <CheckCircle
                                        sx={{ color: redTheme.success.main, fontSize: 20 }}
                                      />
                                    </motion.div>
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {config.description}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Afficher les permissions si le rôle est sélectionné */}
                            {role === key && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                transition={{ duration: 0.3 }}
                              >
                                <Divider sx={{ my: 2 }} />
                                <Typography
                                  variant="caption"
                                  fontWeight="600"
                                  color="text.secondary"
                                  gutterBottom
                                >
                                  Permissions :
                                </Typography>
                                <Grid container spacing={1} sx={{ mt: 1 }}>
                                  {config.permissions.map((perm, i) => (
                                    <Grid item xs={6} key={i}>
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <CheckCircle
                                          sx={{ color: redTheme.success.main, fontSize: 14 }}
                                        />
                                        <Typography variant="caption">{perm}</Typography>
                                      </Box>
                                    </Grid>
                                  ))}
                                </Grid>
                              </motion.div>
                            )}
                          </RoleCard>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  <AnimatedButton
                    variant="contained"
                    onClick={handleInvite}
                    fullWidth
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    sx={{
                      py: 2,
                      background: redTheme.primary.gradient,
                      "&:hover": {
                        boxShadow: redTheme.primary.glow,
                      },
                    }}
                  >
                    {loading ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Send />
                        </motion.div>
                        Envoi en cours...
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Send />
                        Envoyer l&apos;invitation
                      </Box>
                    )}
                  </AnimatedButton>
                </motion.div>
              </Stack>
            </AnimatedCard>
          </Grid>

          {/* Sidebar d'information */}
          <Grid item xs={12} md={5}>
            <AnimatedCard
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              sx={{ p: 3 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Info sx={{ color: redTheme.primary.main }} />
                <Typography variant="h6" fontWeight="600">
                  À propos des rôles
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <Paper sx={{ p: 2, bgcolor: redTheme.primary.pale, borderRadius: 3 }}>
                  <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                    👑 Administrateur
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Accès complet à toutes les fonctionnalités. Peut gérer les utilisateurs,
                    configurer le CRM et modifier les paramètres.
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, bgcolor: redTheme.neutral[50], borderRadius: 3 }}>
                  <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                    ⭐ Manager
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gère les équipes et les projets. Peut assigner des tâches, voir les rapports et
                    valider les projets.
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, bgcolor: redTheme.neutral[50], borderRadius: 3 }}>
                  <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                    💼 Commercial
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gère les clients et les ventes. Peut créer des devis, suivre les prospects et
                    gérer le pipeline.
                  </Typography>
                </Paper>

                <Box sx={{ mt: 2 }}>
                  <Alert
                    severity="info"
                    icon={<Security />}
                    sx={{
                      borderRadius: 3,
                      border: `2px solid ${redTheme.primary.subtle}`,
                    }}
                  >
                    <Typography variant="body2">
                      Les invitations envoyées sont valables 7 jours. Le membre recevra un email
                      avec un lien pour rejoindre votre équipe.
                    </Typography>
                  </Alert>
                </Box>
              </Stack>
            </AnimatedCard>
          </Grid>
        </Grid>

        {/* Snackbar pour les notifications */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={() => setOpenSnackbar(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Alert
              onClose={() => setOpenSnackbar(false)}
              severity={messageType}
              icon={messageType === "success" ? <CheckCircle /> : <Error />}
              sx={{
                borderRadius: 3,
                border: `2px solid ${
                  messageType === "success"
                    ? redTheme.success.main
                    : messageType === "error"
                    ? redTheme.primary.main
                    : redTheme.warning.main
                }`,
              }}
            >
              {message}
            </Alert>
          </motion.div>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default InviteMember;
