/* eslint-disable prettier/prettier */
// src/layouts/authentication/sign-up/index.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";

import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  CheckCircle,
  Email,
  Lock,
  Person,
  Send,
  Verified,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { styled, alpha } from "@mui/material/styles";

import { useMaterialUIController, setLayout } from "context";

const crmTheme = {
  primary: {
    main: "#c0392b",
    light: "#e05b4a",
    subtle: "#f7e8e8",
    gradient: "linear-gradient(135deg, #c0392b 0%, #5a0002 100%)",
  },
  success: { main: "#18a558", subtle: "#dcfce7" },
  warning: { main: "#f59e0b" },
  neutral: {
    50: "#faf7f4",
    200: "#e8d5d5",
    300: "#d8bebe",
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
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: crmTheme.primary.light },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: crmTheme.primary.main,
      borderWidth: 2,
    },
  },
  "& .MuiInputLabel-root.Mui-focused": { color: crmTheme.primary.main },
}));

const PasswordStrengthIndicator = ({ password }) => {
  const getStrength = () => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[!@#$%^&*()_+]/.test(password)) strength += 25;
    return strength;
  };

  const strength = getStrength();
  const color =
    strength <= 25
      ? crmTheme.primary.main
      : strength <= 50
      ? crmTheme.warning.main
      : strength <= 75
      ? crmTheme.primary.light
      : crmTheme.success.main;
  const label =
    strength <= 25 ? "Faible" : strength <= 50 ? "Moyen" : strength <= 75 ? "Bon" : "Fort";

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
          Force du mot de passe
        </Typography>
        <Typography variant="caption" sx={{ color, fontWeight: 800 }}>
          {label}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={strength}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: crmTheme.neutral[200],
          "& .MuiLinearProgress-bar": { borderRadius: 3, backgroundColor: color },
        }}
      />
    </Box>
  );
};

PasswordStrengthIndicator.propTypes = {
  password: PropTypes.string.isRequired,
};

function SignUp() {
  const [, dispatch] = useMaterialUIController();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  const validatePassword = (value) => {
    const minLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*()_+]/.test(value);
    return minLength && hasUpper && hasNumber && hasSpecial;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!validatePassword(password)) {
      setMessage(
        "Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial"
      );
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/users/register/", {
        username: name.trim(),
        email: email.trim(),
        password: password,
        role: "ADMIN",
      });

      console.log("Backend response:", response.data);
      setMessage("Un code de vérification a été envoyé par email.");
      setStep(2);
    } catch (error) {
      console.error(error.response?.data);

      if (error.response?.data?.email) {
        setMessage("Cet email est déjà utilisé");
      } else if (error.response?.data?.username) {
        setMessage("Ce nom d'utilisateur est déjà pris");
      } else {
        setMessage(error.response?.data?.detail || "Erreur lors de la création du compte");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/users/verify-email/", {
        email,
        code,
      });

      console.log("Vérification réponse:", response.data);
      setMessage("Email vérifié avec succès !");

      setTimeout(() => {
        navigate("/authentication/sign-in");
      }, 1500);
    } catch (error) {
      console.error(error.response?.data);
      setMessage(
        error.response?.data?.detail ||
          error.response?.data?.code ||
          "Code de vérification invalide"
      );
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Inscription", "Vérification"];

  return (
    <Box className="auth-page auth-register-page">
      <Box className="auth-header">
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box className="public-logo-mark">V</Box>
          <Typography className="public-logo-text">ViewiseCRM</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography className="auth-header-copy">Déjà un compte ?</Typography>
          <Button className="public-secondary-button" onClick={() => navigate("/login")}>
            Se connecter
          </Button>
        </Stack>
      </Box>

      <Box className="auth-main">
        <Box className="auth-split auth-register">
          <Box className="auth-form-area">
            <StyledCard className="auth-card">
              <Box sx={{ p: 4 }}>
                <Stepper
                  activeStep={step - 1}
                  alternativeLabel
                  sx={{
                    mb: 3,
                    "& .MuiStepLabel-root .Mui-completed": { color: crmTheme.success.main },
                    "& .MuiStepLabel-root .Mui-active": { color: crmTheme.primary.main },
                  }}
                >
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                <Box sx={{ mb: 3 }}>
                  <Typography className="auth-title">
                    {step === 1 ? "Créer votre compte" : "Vérification"}
                  </Typography>
                  <Typography className="auth-subtitle">
                    {step === 1
                      ? "Commencez votre essai gratuit de 14 jours — sans carte bancaire"
                      : "Entrez le code reçu par email."}
                  </Typography>
                </Box>

                {step === 1 && (
                  <form onSubmit={handleRegister}>
                    <Stack spacing={3}>
                      <Box className="auth-form-grid">
                        <StyledTextField
                          className="auth-input"
                          fullWidth
                          label="Nom complet"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField(null)}
                          required
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person
                                  sx={{
                                    color:
                                      focusedField === "name"
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
                          label="E-mail professionnel"
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
                      </Box>

                      <Box>
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
                        {password && <PasswordStrengthIndicator password={password} />}
                      </Box>

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            sx={{
                              color: crmTheme.neutral[400],
                              "&.Mui-checked": { color: crmTheme.primary.main },
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ color: crmTheme.neutral[600] }}>
                            J&apos;accepte les conditions d&apos;utilisation
                          </Typography>
                        }
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
                        disabled={loading || !acceptedTerms}
                        startIcon={<Send />}
                      >
                        {loading ? "Création en cours..." : "Créer mon compte gratuitement"}
                      </StyledButton>
                    </Stack>
                  </form>
                )}

                {step === 2 && (
                  <form onSubmit={handleVerify}>
                    <Stack spacing={3}>
                      <StyledTextField
                        className="auth-input"
                        fullWidth
                        label="Code de vérification"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onFocus={() => setFocusedField("code")}
                        onBlur={() => setFocusedField(null)}
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Verified
                                sx={{
                                  color:
                                    focusedField === "code"
                                      ? crmTheme.primary.main
                                      : crmTheme.neutral[400],
                                  fontSize: 20,
                                }}
                              />
                            </InputAdornment>
                          ),
                        }}
                        helperText="Un code à 6 chiffres vous a été envoyé par email"
                      />

                      {message && (
                        <Alert
                          className="crm-alert"
                          severity={message.includes("succès") ? "success" : "info"}
                        >
                          {message}
                        </Alert>
                      )}

                      <StyledButton
                        className="auth-button"
                        type="submit"
                        fullWidth
                        disabled={loading}
                        startIcon={<CheckCircle />}
                      >
                        {loading ? "Vérification..." : "Vérifier mon email"}
                      </StyledButton>

                      <Button
                        variant="text"
                        onClick={() => setStep(1)}
                        startIcon={<ArrowBack />}
                        sx={{
                          color: crmTheme.neutral[600],
                          textTransform: "none",
                          fontWeight: 800,
                        }}
                      >
                        Retour à l&apos;inscription
                      </Button>
                    </Stack>
                  </form>
                )}
              </Box>
            </StyledCard>
          </Box>

          <Box className="auth-red-panel">
            <Box className="auth-panel-brand">
              <Box className="public-logo-mark light">V</Box>
              <Typography>ViewiseCRM</Typography>
            </Box>
            <Box className="auth-panel-content">
              <Box className="auth-panel-badge">14 jours gratuits</Box>
              <Typography component="h1">
                Tout ce qu&apos;il vous faut pour vendre mieux.
              </Typography>
              <Typography>
                Rejoignez les équipes tunisiennes qui utilisent ViewiseCRM pour structurer leur
                activité commerciale.
              </Typography>
              <Box className="auth-panel-features">
                {[
                  "Aucune carte bancaire requise",
                  "Mise en place rapide",
                  "Support inclus",
                  "Données sécurisées",
                ].map((item) => (
                  <Box key={item}>{item}</Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default SignUp;
