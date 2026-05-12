// src/layouts/authentication/sign-in/index.js
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  Card,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Avatar,
  Divider,
  InputAdornment,
  IconButton,
  Fade,
} from "@mui/material";
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Login,
  Business,
  Security,
} from "@mui/icons-material";
import { styled, alpha } from "@mui/material/styles";

import CoverLayout from "layouts/authentication/components/CoverLayout";
import bgImage from "assets/images/bg-sign-up-cover.jpeg";

const crmTheme = {
  primary: {
    main: "#dc2626",
    light: "#ef4444",
    lighter: "#f87171",
    subtle: "#fee2e2",
    pale: "#fef2f2",
    gradient: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
  },
  secondary: {
    main: "#b91c1c",
    light: "#dc2626",
    lighter: "#ef4444",
    subtle: "#fecaca",
  },
  success: {
    main: "#10b981",
    light: "#34d399",
    subtle: "#d1fae5",
  },
  neutral: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
};

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 24,
  background: "rgba(255, 255, 255, 0.98)",
  backdropFilter: "blur(10px)",
  boxShadow: `0 25px 50px -12px ${alpha(crmTheme.primary.main, 0.25)}`,
  border: `1px solid ${crmTheme.primary.subtle}`,
  overflow: "hidden",
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: crmTheme.primary.gradient,
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  padding: "12px 24px",
  textTransform: "none",
  fontSize: "1rem",
  fontWeight: 600,
  background: crmTheme.primary.gradient,
  color: "white",
  boxShadow: `0 8px 16px ${alpha(crmTheme.primary.main, 0.2)}`,
  "&:hover": {
    background: crmTheme.primary.gradient,
    boxShadow: `0 12px 24px ${alpha(crmTheme.primary.main, 0.3)}`,
    transform: "translateY(-2px)",
  },
  "&:disabled": {
    background: crmTheme.neutral[300],
    color: crmTheme.neutral[500],
    boxShadow: "none",
  },
  transition: "all 0.2s ease",
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 12,
    backgroundColor: crmTheme.neutral[50],
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: "white",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: crmTheme.primary.light,
      },
    },
    "&.Mui-focused": {
      backgroundColor: "white",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: crmTheme.primary.main,
        borderWidth: 2,
      },
    },
  },
  "& .MuiInputLabel-root": {
    color: crmTheme.neutral[500],
    "&.Mui-focused": {
      color: crmTheme.primary.main,
    },
  },
}));

const FeatureItem = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  color: crmTheme.neutral[600],
  "& svg": {
    color: crmTheme.primary.main,
    fontSize: 20,
  },
}));

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // ── Étape 1 : obtenir les tokens JWT ──────────────────────────────
      // TokenObtainPairView attend "email" + "password"
      // et retourne { access, refresh }
      const tokenRes = await axios.post("http://127.0.0.1:8000/api/users/login/", {
        email,
        password,
      });

      const { access, refresh } = tokenRes.data;

      if (!access) {
        setMessage("Réponse invalide du serveur.");
        setLoading(false);
        return;
      }

      // Persister les tokens
      localStorage.setItem("token", access);
      localStorage.setItem("refresh", refresh);

      // ── Étape 2 : récupérer le profil de l'utilisateur ───────────────
      const profileRes = await axios.get("http://127.0.0.1:8000/api/users/me/", {
        headers: { Authorization: `Bearer ${access}` },
      });

      const { username, role, profile_completed, company } = profileRes.data;
      const company_created = company?.company_created || false;

      // Sauvegarder les infos utilisateur
      localStorage.setItem(
        "user",
        JSON.stringify({ username, email, role, profile_completed, company_created })
      );

      // ── Étape 3 : redirection selon le rôle ──────────────────────────
      if (role === "SUPERADMIN") {
        // SuperAdmin → son espace dédié, jamais vers complete-profile
        navigate("/superadmin-dashboard", { replace: true });
        return;
      }

      if (role === "ADMIN" && (!profile_completed || !company_created)) {
        // Admin qui n'a pas encore complété son profil
        navigate("/complete-profile", { replace: true });
        return;
      }

      // Tous les autres rôles → dashboard standard
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Erreur login:", error.response?.data || error);

      // Distinguer les erreurs 401 (mauvais credentials) des autres
      if (error.response?.status === 401) {
        setMessage("Email ou mot de passe incorrect.");
      } else if (error.response?.status === 400) {
        setMessage("Email ou mot de passe incorrect.");
      } else {
        setMessage("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <CoverLayout image={bgImage}>
      <Fade in={true} timeout={500}>
        <Box sx={{ width: "100%", maxWidth: 450, mx: "auto" }}>
          <StyledCard>
            {/* Avatar */}
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 2 }}>
              <Avatar
                sx={{
                  width: 70,
                  height: 70,
                  background: crmTheme.primary.gradient,
                  boxShadow: `0 8px 16px ${alpha(crmTheme.primary.main, 0.3)}`,
                }}
              >
                <Business sx={{ fontSize: 35, color: "white" }} />
              </Avatar>
            </Box>

            <Box sx={{ px: 4, pb: 2, textAlign: "center" }}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: crmTheme.neutral[800], mb: 1 }}
              >
                Bienvenue
              </Typography>
              <Typography variant="body2" sx={{ color: crmTheme.neutral[500], mb: 3 }}>
                Connectez-vous à votre espace CRM
              </Typography>
            </Box>

            <Divider sx={{ mx: 4, borderColor: crmTheme.neutral[200] }}>
              <Typography
                variant="caption"
                sx={{
                  color: crmTheme.neutral[400],
                  backgroundColor: "white",
                  px: 2,
                }}
              >
                Accès sécurisé
              </Typography>
            </Divider>

            <Box sx={{ p: 4 }}>
              <form onSubmit={handleLogin}>
                <Stack spacing={3}>
                  <StyledTextField
                    fullWidth
                    label="Adresse email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email
                            sx={{
                              color:
                                focusedField === "email"
                                  ? crmTheme.primary.main
                                  : crmTheme.neutral[400],
                              fontSize: 20,
                            }}
                          />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <StyledTextField
                    fullWidth
                    label="Mot de passe"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock
                            sx={{
                              color:
                                focusedField === "password"
                                  ? crmTheme.primary.main
                                  : crmTheme.neutral[400],
                              fontSize: 20,
                            }}
                          />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{
                              color: crmTheme.neutral[500],
                              "&:hover": { color: crmTheme.primary.main },
                            }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {message && (
                    <Alert
                      severity="error"
                      sx={{
                        borderRadius: 2,
                        backgroundColor: crmTheme.primary.subtle,
                        color: crmTheme.primary.main,
                        border: `1px solid ${crmTheme.primary.lighter}`,
                        "& .MuiAlert-icon": { color: crmTheme.primary.main },
                      }}
                    >
                      {message}
                    </Alert>
                  )}

                  <StyledButton
                    type="submit"
                    fullWidth
                    disabled={loading}
                    startIcon={<Login />}
                    sx={{ mt: 2 }}
                  >
                    {loading ? "Connexion en cours..." : "Se connecter"}
                  </StyledButton>
                </Stack>
              </form>

              <Box sx={{ mt: 4 }}>
                <Stack
                  direction="row"
                  spacing={2}
                  justifyContent="center"
                  divider={
                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{ borderColor: crmTheme.neutral[200] }}
                    />
                  }
                >
                  <FeatureItem>
                    <Security />
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      Sécurisé
                    </Typography>
                  </FeatureItem>
                  <FeatureItem>
                    <Business />
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      Professionnel
                    </Typography>
                  </FeatureItem>
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                p: 2,
                backgroundColor: crmTheme.neutral[50],
                borderTop: `1px solid ${crmTheme.neutral[200]}`,
                textAlign: "center",
              }}
            >
              <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                CRM Intelligent • Gestion de la relation client
              </Typography>
            </Box>
          </StyledCard>
        </Box>
      </Fade>
    </CoverLayout>
  );
}

export default SignIn;
