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
import { Email, LockReset, Shield, Visibility, VisibilityOff } from "@mui/icons-material";
import { alpha, styled } from "@mui/material/styles";

import { useMaterialUIController, setLayout } from "context";

const crmTheme = {
  primary: {
    main: "#c0392b",
    light: "#e05b4a",
    subtle: "#f7e8e8",
    gradient: "linear-gradient(135deg, #c0392b 0%, #5a0002 100%)",
  },
  neutral: {
    300: "#e8d5d5",
    400: "#b89090",
    500: "#7a5a5a",
    600: "#5f3d3d",
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

function ResetPassword() {
  const [, dispatch] = useMaterialUIController();
  const navigate = useNavigate();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  const requestCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post("/api/users/password-reset/request/", { email });
      setSeverity("success");
      setMessage(response.data.message || "Code envoyé.");
      setStep("confirm");
    } catch (error) {
      setSeverity("error");
      setMessage(error.response?.data?.error || "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setSeverity("error");
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/users/password-reset/confirm/", {
        email,
        code,
        new_password: newPassword,
      });
      setSeverity("success");
      setMessage(response.data.message || "Mot de passe réinitialisé.");
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      const data = error.response?.data || {};
      setSeverity("error");
      setMessage(
        data.error ||
          data.new_password?.[0] ||
          data.code?.[0] ||
          "Impossible de réinitialiser le mot de passe."
      );
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
        <Button className="public-secondary-button" onClick={() => navigate("/login")}>
          Se connecter
        </Button>
      </Box>

      <Box className="auth-main">
        <Fade in timeout={500}>
          <Box className="auth-form-area" sx={{ maxWidth: 520, width: "100%" }}>
            <StyledCard className="auth-card">
              <Box sx={{ p: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography className="auth-title">Réinitialiser le mot de passe</Typography>
                  <Typography className="auth-subtitle">
                    {step === "request"
                      ? "Recevez un code sécurisé sur votre adresse email."
                      : "Saisissez le code reçu et choisissez un nouveau mot de passe."}
                  </Typography>
                </Box>

                <form onSubmit={step === "request" ? requestCode : confirmReset}>
                  <Stack spacing={3}>
                    <StyledTextField
                      fullWidth
                      label="Adresse e-mail"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={step === "confirm"}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email sx={{ color: crmTheme.neutral[400], fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    {step === "confirm" && (
                      <>
                        <StyledTextField
                          fullWidth
                          label="Code de réinitialisation"
                          value={code}
                          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                          required
                          inputProps={{ maxLength: 6 }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Shield sx={{ color: crmTheme.neutral[400], fontSize: 20 }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <StyledTextField
                          fullWidth
                          label="Nouveau mot de passe"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          required
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockReset sx={{ color: crmTheme.neutral[400], fontSize: 20 }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        <StyledTextField
                          fullWidth
                          label="Confirmer le mot de passe"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          required
                        />
                      </>
                    )}

                    {message && (
                      <Alert className="crm-alert" severity={severity}>
                        {message}
                      </Alert>
                    )}

                    <StyledButton type="submit" fullWidth disabled={loading}>
                      {loading
                        ? "Traitement en cours..."
                        : step === "request"
                        ? "Envoyer le code"
                        : "Changer le mot de passe"}
                    </StyledButton>

                    {step === "confirm" && (
                      <Button
                        variant="text"
                        onClick={requestCode}
                        disabled={loading}
                        sx={{
                          color: crmTheme.neutral[600],
                          textTransform: "none",
                          fontWeight: 800,
                        }}
                      >
                        Renvoyer le code
                      </Button>
                    )}
                  </Stack>
                </form>
              </Box>
            </StyledCard>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}

export default ResetPassword;
