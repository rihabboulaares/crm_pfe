// src/layouts/authentication/sign-in/index.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  Fade,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Email, Lock, Login, Visibility, VisibilityOff } from "@mui/icons-material";
import { styled, alpha } from "@mui/material/styles";

import { useMaterialUIController, setLayout } from "context";

const crmTheme = {
  primary: {
    main: "#c0392b",
    light: "#e05b4a",
    subtle: "#f7e8e8",
    gradient: "linear-gradient(135deg, #c0392b 0%, #5a0002 100%)",
  },
  neutral: {
    50: "#faf7f4",
    300: "#e8d5d5",
    400: "#b89090",
    500: "#7a5a5a",
    600: "#5f3d3d",
    800: "#1a0808",
  },
};

const StyledCard = styled(Card)(() => ({
  borderRadius: 24,
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: `0 18px 45px ${alpha("#5a0002", 0.12)}`,
  border: `1px solid ${crmTheme.primary.subtle}`,
  overflow: "hidden",
}));

const StyledButton = styled(Button)(() => ({
  borderRadius: 14,
  padding: "12px 24px",
  textTransform: "none",
  fontSize: "1rem",
  fontWeight: 800,
  background: crmTheme.primary.gradient,
  color: "white",
  boxShadow: `0 14px 28px ${alpha(crmTheme.primary.main, 0.24)}`,
  "&:hover": {
    background: crmTheme.primary.gradient,
    boxShadow: `0 18px 34px ${alpha(crmTheme.primary.main, 0.3)}`,
    transform: "translateY(-1px)",
  },
  "&:disabled": {
    background: crmTheme.neutral[300],
    color: crmTheme.neutral[500],
    boxShadow: "none",
  },
  transition: "all 0.2s ease",
}));

const StyledTextField = styled(TextField)(() => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 14,
    backgroundColor: "#fff",
    transition: "all 0.2s ease",
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: crmTheme.primary.light,
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: crmTheme.primary.main,
      borderWidth: 2,
    },
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: crmTheme.primary.main,
  },
}));

function SignIn() {
  const [, dispatch] = useMaterialUIController();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const tokenRes = await axios.post("/api/users/login/", {
        email,
        password,
      });

      const { access, refresh } = tokenRes.data;

      if (!access) {
        setMessage("Réponse invalide du serveur.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", access);
      localStorage.setItem("refresh", refresh);

      const profileRes = await axios.get("/api/users/me/", {
        headers: { Authorization: `Bearer ${access}` },
      });

      const { username, role, profile_completed, company } = profileRes.data;
      const company_created = company?.company_created || false;

      localStorage.setItem(
        "user",
        JSON.stringify({ username, email, role, profile_completed, company_created })
      );

      if (role === "SUPERADMIN") {
        navigate("/superadmin-dashboard", { replace: true });
        return;
      }

      if (role === "ADMIN" && (!profile_completed || !company_created)) {
        navigate("/complete-profile", { replace: true });
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Erreur login:", error.response?.data || error);

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
    <Box className="auth-page auth-login-page">
      <Box className="auth-header">
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box className="public-logo-mark">V</Box>
          <Typography className="public-logo-text">ViewiseCRM</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography className="auth-header-copy">Pas encore de compte ?</Typography>
          <Button className="public-secondary-button" onClick={() => navigate("/register")}>
            Créer un compte
          </Button>
        </Stack>
      </Box>

      <Box className="auth-main">
        <Fade in timeout={500}>
          <Box className="auth-split auth-login">
            <Box className="auth-red-panel">
              <Box className="auth-panel-brand">
                <Box className="public-logo-mark light">V</Box>
                <Typography>ViewiseCRM</Typography>
              </Box>
              <Box className="auth-panel-content">
                <Typography component="h1">Reprenez là où vous vous êtes arrêté.</Typography>
                <Typography>
                  Accédez à vos contacts, opportunités et tableaux de bord en quelques secondes.
                </Typography>
                <Box className="auth-panel-features">
                  {["Connexion sécurisée SSL / TLS", "Session protégée", "Données sécurisées"].map(
                    (item) => (
                      <Box key={item}>{item}</Box>
                    )
                  )}
                </Box>
              </Box>
            </Box>

            <Box className="auth-form-area">
              <StyledCard className="auth-card">
                <Box sx={{ p: 4 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography className="auth-title">Bon retour parmi nous</Typography>
                    <Typography className="auth-subtitle">
                      Connectez-vous pour accéder à votre espace ViewiseCRM
                    </Typography>
                  </Box>

                  <form onSubmit={handleLogin}>
                    <Stack spacing={3}>
                      <StyledTextField
                        className="auth-input"
                        fullWidth
                        label="Adresse e-mail"
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
                        className="auth-input"
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
                        <Alert className="crm-alert" severity="error">
                          {message}
                        </Alert>
                      )}

                      <StyledButton
                        className="auth-button"
                        type="submit"
                        fullWidth
                        disabled={loading}
                        startIcon={<Login />}
                      >
                        {loading ? "Connexion en cours..." : "Se connecter"}
                      </StyledButton>
                    </Stack>
                  </form>

                  <Stack spacing={1.2} alignItems="center" sx={{ mt: 3 }}>
                    <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                      Pas encore de compte ?{" "}
                      <Typography
                        component="span"
                        onClick={() => navigate("/register")}
                        sx={{
                          color: crmTheme.primary.main,
                          fontWeight: 800,
                          cursor: "pointer",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        Créer un compte
                      </Typography>
                    </Typography>
                    <Button
                      variant="text"
                      onClick={() => navigate("/welcome")}
                      sx={{ color: crmTheme.neutral[600], textTransform: "none", fontWeight: 800 }}
                    >
                      Retour à l&apos;accueil
                    </Button>
                  </Stack>
                </Box>
              </StyledCard>
            </Box>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}

export default SignIn;
