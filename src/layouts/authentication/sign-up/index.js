// src/layouts/authentication/sign-up/index.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";

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
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Fade,
  Zoom,
} from "@mui/material";
import {
  Person,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Verified,
  Send,
  Business,
  CheckCircle,
  ArrowBack,
} from "@mui/icons-material";
import { styled, alpha } from "@mui/material/styles";

import CoverLayout from "layouts/authentication/components/CoverLayout";

import bgImage from "assets/images/bg-sign-up-cover.jpeg";

// Palette de couleurs identique au profil et au sign-in
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
  warning: {
    main: "#f59e0b",
    light: "#fbbf24",
    subtle: "#fed7aa",
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

// Composants stylisés
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

// Composant PasswordStrengthIndicator avec PropTypes
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

  const getColor = () => {
    if (strength <= 25) return crmTheme.error?.main || "#ef4444";
    if (strength <= 50) return crmTheme.warning?.main || "#f59e0b";
    if (strength <= 75) return crmTheme.secondary?.main || "#b91c1c";
    return crmTheme.success?.main || "#10b981";
  };

  const getLabel = () => {
    if (strength <= 25) return "Faible";
    if (strength <= 50) return "Moyen";
    if (strength <= 75) return "Bon";
    return "Fort";
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
          Force du mot de passe
        </Typography>
        <Typography variant="caption" sx={{ color: getColor(), fontWeight: 600 }}>
          {getLabel()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={strength}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: crmTheme.neutral[200],
          "& .MuiLinearProgress-bar": {
            borderRadius: 3,
            backgroundColor: getColor(),
          },
        }}
      />
    </Box>
  );
};

// Validation des props pour PasswordStrengthIndicator
PasswordStrengthIndicator.propTypes = {
  password: PropTypes.string.isRequired,
};

function SignUp() {
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

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const steps = ["Inscription", "Vérification"];

  return (
    <CoverLayout image={bgImage}>
      <Fade in={true} timeout={500}>
        <Box
          sx={{
            width: "100%",
            maxWidth: 500,
            mx: "auto",
          }}
        >
          <StyledCard>
            {/* Stepper */}
            <Box sx={{ px: 4, pt: 4 }}>
              <Stepper
                activeStep={step - 1}
                alternativeLabel
                sx={{
                  "& .MuiStepLabel-root .Mui-completed": {
                    color: crmTheme.success.main,
                  },
                  "& .MuiStepLabel-root .Mui-active": {
                    color: crmTheme.primary.main,
                  },
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            {/* Logo ou icône */}
            <Zoom in={true}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mt: 2,
                  mb: 1,
                }}
              >
                <Avatar
                  sx={{
                    width: 70,
                    height: 70,
                    background: crmTheme.primary.gradient,
                    boxShadow: `0 8px 16px ${alpha(crmTheme.primary.main, 0.3)}`,
                  }}
                >
                  {step === 1 ? (
                    <Person sx={{ fontSize: 35, color: "white" }} />
                  ) : (
                    <Verified sx={{ fontSize: 35, color: "white" }} />
                  )}
                </Avatar>
              </Box>
            </Zoom>

            <Box sx={{ px: 4, pb: 2, textAlign: "center" }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: crmTheme.neutral[800],
                  mb: 1,
                }}
              >
                {step === 1 ? "Créer un compte" : "Vérification"}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: crmTheme.neutral[500],
                  mb: 2,
                }}
              >
                {step === 1 ? "Rejoignez notre CRM intelligent" : "Entrez le code reçu par email"}
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
                {step === 1 ? "Informations personnelles" : "Code de vérification"}
              </Typography>
            </Divider>

            <Box sx={{ p: 4 }}>
              {step === 1 && (
                <form onSubmit={handleRegister}>
                  <Stack spacing={3}>
                    <StyledTextField
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
                      fullWidth
                      label="Email professionnel"
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

                    <Box>
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
                                onClick={handleClickShowPassword}
                                edge="end"
                                sx={{
                                  color: crmTheme.neutral[500],
                                  "&:hover": {
                                    color: crmTheme.primary.main,
                                  },
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
                            "&.Mui-checked": {
                              color: crmTheme.primary.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ color: crmTheme.neutral[600] }}>
                          J&apos;accepte les{" "}
                          <Typography
                            component="span"
                            sx={{
                              color: crmTheme.primary.main,
                              fontWeight: 600,
                              cursor: "pointer",
                              "&:hover": {
                                textDecoration: "underline",
                              },
                            }}
                          >
                            conditions d&apos;utilisation
                          </Typography>
                        </Typography>
                      }
                    />

                    {message && (
                      <Alert
                        severity="error"
                        sx={{
                          borderRadius: 2,
                          backgroundColor: crmTheme.primary.subtle,
                          color: crmTheme.primary.main,
                          border: `1px solid ${crmTheme.primary.lighter}`,
                          "& .MuiAlert-icon": {
                            color: crmTheme.primary.main,
                          },
                        }}
                      >
                        {message}
                      </Alert>
                    )}

                    <StyledButton
                      type="submit"
                      fullWidth
                      disabled={loading || !acceptedTerms}
                      startIcon={<Send />}
                      sx={{ mt: 2 }}
                    >
                      {loading ? "Création en cours..." : "S'inscrire"}
                    </StyledButton>
                  </Stack>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleVerify}>
                  <Stack spacing={3}>
                    <StyledTextField
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
                      FormHelperTextProps={{
                        sx: { color: crmTheme.neutral[500], mt: 1 },
                      }}
                    />

                    {message && (
                      <Alert
                        severity={message.includes("succès") ? "success" : "info"}
                        sx={{
                          borderRadius: 2,
                          backgroundColor: message.includes("succès")
                            ? crmTheme.success.subtle
                            : crmTheme.primary.subtle,
                          color: message.includes("succès")
                            ? crmTheme.success.main
                            : crmTheme.primary.main,
                          border: `1px solid ${
                            message.includes("succès")
                              ? crmTheme.success.light
                              : crmTheme.primary.lighter
                          }`,
                        }}
                      >
                        {message}
                      </Alert>
                    )}

                    <StyledButton
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
                        "&:hover": {
                          color: crmTheme.primary.main,
                          backgroundColor: "transparent",
                        },
                      }}
                    >
                      Retour à l&apos;inscription
                    </Button>
                  </Stack>
                </form>
              )}
            </Box>

            {/* Footer */}
            <Box
              sx={{
                p: 2,
                backgroundColor: crmTheme.neutral[50],
                borderTop: `1px solid ${crmTheme.neutral[200]}`,
                textAlign: "center",
              }}
            >
              <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                Déjà un compte ?{" "}
                <Typography
                  component="span"
                  onClick={() => navigate("/authentication/sign-in")}
                  sx={{
                    color: crmTheme.primary.main,
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  Se connecter
                </Typography>
              </Typography>
            </Box>
          </StyledCard>
        </Box>
      </Fade>
    </CoverLayout>
  );
}

export default SignUp;
