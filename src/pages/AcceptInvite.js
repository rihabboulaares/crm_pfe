// src/pages/AcceptInvite.js
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Card,
  Checkbox,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Alert,
  alpha,
  Paper,
  Avatar,
  Divider,
  Chip,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  Verified as VerifiedIcon,
  Security as SecurityIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

import CoverLayout from "layouts/authentication/components/CoverLayout";

import bgImage from "assets/images/bg-sign-up-cover.jpeg";

// ==============================
// THÈME PERSONNALISÉ
// ==============================
const THEME = {
  primary: "#d32f2f",
  primaryLight: "#ff6659",
  primaryDark: "#9a0007",
  secondary: "#ffebee",
  gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#2196f3",
  error: "#f44336",
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

// ==============================
// STYLES PERSONNALISÉS
// ==============================
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 24,
  boxShadow: `0 8px 16px ${alpha(THEME.primary, 0.1)}`,
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  overflow: "hidden",
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: THEME.gradient,
  },
}));

const GradientHeader = styled(Box)(({ theme }) => ({
  background: THEME.gradient,
  borderRadius: "16px 16px 16px 16px",
  padding: theme.spacing(3),
  color: "white",
  textAlign: "center",
  marginBottom: theme.spacing(3),
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
}));

const GradientButton = styled(MDButton)(({ theme }) => ({
  background: THEME.gradient,
  color: "white",
  borderRadius: 12,
  padding: "10px 24px",
  fontWeight: 600,
  textTransform: "none",
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
  "&:hover": {
    background: THEME.gradient,
    boxShadow: `0 6px 16px ${alpha(THEME.primary, 0.4)}`,
  },
  "&:disabled": {
    opacity: 0.6,
  },
}));

const ColorStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: alpha(THEME.primary, 0.1),
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    background: THEME.gradient,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    background: THEME.gradient,
  },
}));

const ColorStepIcon = styled(Box)(({ theme, active, completed }) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: completed ? THEME.success : active ? THEME.primary : alpha(THEME.primary, 0.1),
  color: completed || active ? "white" : THEME.primary,
  transition: "all 0.3s ease",
  fontSize: 18,
  fontWeight: 600,
  boxShadow: active ? `0 4px 12px ${alpha(THEME.primary, 0.3)}` : "none",
}));

const StyledInput = styled(MDInput)(({ theme }) => ({
  "& .MuiInput-root": {
    "&:before": {
      borderBottomColor: alpha(THEME.primary, 0.3),
    },
    "&:hover:not(.Mui-disabled):before": {
      borderBottomColor: THEME.primaryLight,
    },
    "&:after": {
      borderBottomColor: THEME.primary,
    },
  },
  "& .MuiInputLabel-root": {
    "&.Mui-focused": {
      color: THEME.primary,
    },
  },
}));

const InfoChip = styled(Chip)(({ theme, color = "primary" }) => ({
  borderRadius: 8,
  fontWeight: 500,
  height: 32,
  margin: theme.spacing(0.5),
  backgroundColor: alpha(THEME[color], 0.1),
  color: THEME[color],
  border: `1px solid ${alpha(THEME[color], 0.3)}`,
}));

// Étapes du processus
const STEPS = [
  {
    label: "Création du compte",
    description: "Choisissez votre identifiant et mot de passe",
  },
  {
    label: "Vérification email",
    description: "Validez votre adresse email",
  },
];

function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState(""); // email récupéré depuis le token
  const [userId, setUserId] = useState(null); // ID de l'utilisateur créé
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation du mot de passe
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordValidations, setPasswordValidations] = useState({
    minLength: false,
    hasNumber: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasSpecialChar: false,
  });

  // Vérifier la force du mot de passe
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      setPasswordValidations({
        minLength: false,
        hasNumber: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasSpecialChar: false,
      });
      return;
    }

    const validations = {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    setPasswordValidations(validations);

    const strength = Object.values(validations).filter(Boolean).length;
    setPasswordStrength(strength);
  }, [password]);

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return THEME.error;
      case 2:
      case 3:
        return THEME.warning;
      case 4:
      case 5:
        return THEME.success;
      default:
        return THEME.neutral[500];
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return "Très faible";
      case 2:
        return "Faible";
      case 3:
        return "Moyen";
      case 4:
        return "Fort";
      case 5:
        return "Très fort";
      default:
        return "";
    }
  };

  // --- Création du compte à partir de l'invitation ---
  const handleAccept = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "success" });

    // Validation
    if (!username || !password || !confirmPassword) {
      setMessage({ text: "Tous les champs sont obligatoires", type: "error" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Les mots de passe ne correspondent pas", type: "error" });
      return;
    }

    if (passwordStrength < 3) {
      setMessage({ text: "Veuillez choisir un mot de passe plus sécurisé", type: "error" });
      return;
    }

    if (!agreed) {
      setMessage({ text: "Vous devez accepter les conditions d'utilisation", type: "error" });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`http://127.0.0.1:8000/api/users/accept-invite/${token}/`, {
        username,
        password,
      });

      console.log("Réponse accept-invite:", response.data); // Pour déboguer

      // Récupérer l'email et l'ID utilisateur depuis la réponse
      // Adaptez ces lignes selon la structure réelle de votre réponse API
      if (response.data && response.data.email) {
        setEmail(response.data.email);
      } else if (response.data && response.data.user && response.data.user.email) {
        setEmail(response.data.user.email);
      }

      if (response.data && response.data.user_id) {
        setUserId(response.data.user_id);
      } else if (response.data && response.data.id) {
        setUserId(response.data.id);
      }

      setMessage({
        text: "Compte créé avec succès ! Un code de vérification vous a été envoyé par email.",
        type: "success",
      });

      // Passer à l'étape 2 après un délai
      setTimeout(() => {
        setStep(2);
      }, 1500);
    } catch (error) {
      console.error("Erreur accept-invite:", error.response?.data);
      setMessage({
        text:
          error.response?.data?.error ||
          error.response?.data?.username ||
          error.response?.data?.password ||
          "Erreur lors de l'acceptation",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Vérification email ---
  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "success" });

    if (!code) {
      setMessage({ text: "Veuillez entrer le code de vérification", type: "error" });
      return;
    }

    // Vérifier que nous avons un email
    if (!email) {
      setMessage({
        text: "Email non disponible. Veuillez réessayer ou contacter le support.",
        type: "error",
      });
      return;
    }

    console.log("Tentative de vérification avec:", { email, code }); // Pour déboguer

    setLoading(true);

    try {
      // Envoyer l'email et le code pour vérification
      const response = await axios.post("http://127.0.0.1:8000/api/users/verify-email/", {
        email: email, // Utiliser l'email récupéré
        code: code,
      });

      console.log("Réponse verify-email:", response.data); // Pour déboguer

      setMessage({ text: "Email vérifié avec succès !", type: "success" });

      // Rediriger vers la page de connexion après un délai
      setTimeout(() => {
        navigate("/authentication/sign-in");
      }, 1500);
    } catch (error) {
      console.error("Erreur verify-email:", error.response?.data);

      // Afficher un message d'erreur plus précis
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Code de vérification invalide";

      setMessage({
        text: errorMessage,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setMessage({ text: "Email non disponible", type: "error" });
      return;
    }

    setLoading(true);
    try {
      // Appel pour renvoyer le code de vérification
      await axios.post("http://127.0.0.1:8000/api/users/resend-verification/", {
        email: email,
      });
      setMessage({ text: "Nouveau code envoyé !", type: "success" });
    } catch (error) {
      console.error("Erreur resend:", error.response?.data);
      setMessage({
        text: error.response?.data?.error || "Erreur lors de l'envoi du code",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CoverLayout image={bgImage}>
      <StyledCard>
        <MDBox p={4}>
          {/* Logo ou icône */}
          <Box display="flex" justifyContent="center" mb={2}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                background: THEME.gradient,
                boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
              }}
            >
              {step === 1 ? (
                <PersonIcon sx={{ fontSize: 40 }} />
              ) : (
                <VerifiedIcon sx={{ fontSize: 40 }} />
              )}
            </Avatar>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={step - 1} connector={<ColorStepConnector />} sx={{ mb: 4 }}>
            {STEPS.map((stepItem, index) => (
              <Step key={index}>
                <StepLabel
                  StepIconComponent={({ active, completed }) => (
                    <ColorStepIcon active={active} completed={completed}>
                      {completed ? <CheckCircleIcon /> : index + 1}
                    </ColorStepIcon>
                  )}
                >
                  <Typography variant="subtitle2" fontWeight={600}>
                    {stepItem.label}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {stepItem.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Message d'alerte */}
          {message.text && (
            <Alert
              severity={message.type}
              sx={{
                mb: 3,
                borderRadius: 2,
                border: `1px solid ${alpha(
                  message.type === "success" ? THEME.success : THEME.error,
                  0.3
                )}`,
              }}
            >
              {message.text}
            </Alert>
          )}

          {/* Étape 1 : Création du compte */}
          {step === 1 && (
            <MDBox component="form" role="form" onSubmit={handleAccept}>
              <MDBox mb={3}>
                <StyledInput
                  type="text"
                  label="Nom d'utilisateur"
                  variant="standard"
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </MDBox>

              <MDBox mb={2}>
                <StyledInput
                  type={showPassword ? "text" : "password"}
                  label="Mot de passe"
                  variant="standard"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </MDBox>

              {/* Indicateur de force du mot de passe */}
              {password && (
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="caption" color="textSecondary">
                      Force du mot de passe
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{ color: getPasswordStrengthColor() }}
                    >
                      {getPasswordStrengthText()}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: alpha(THEME.neutral[500], 0.1),
                      position: "relative",
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${(passwordStrength / 5) * 100}%`,
                        borderRadius: 2,
                        background: THEME.gradient,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {Object.entries(passwordValidations).map(([key, value]) => (
                      <Chip
                        key={key}
                        size="small"
                        label={
                          key === "minLength"
                            ? "8+ caractères"
                            : key === "hasNumber"
                            ? "Chiffre"
                            : key === "hasUpperCase"
                            ? "Majuscule"
                            : key === "hasLowerCase"
                            ? "Minuscule"
                            : "Caractère spécial"
                        }
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          bgcolor: value ? alpha(THEME.success, 0.1) : alpha(THEME.error, 0.1),
                          color: value ? THEME.success : THEME.error,
                          border: `1px solid ${
                            value ? alpha(THEME.success, 0.3) : alpha(THEME.error, 0.3)
                          }`,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              <MDBox mb={3}>
                <StyledInput
                  type={showConfirmPassword ? "text" : "password"}
                  label="Confirmer le mot de passe"
                  variant="standard"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  error={confirmPassword && password !== confirmPassword}
                  helperText={
                    confirmPassword && password !== confirmPassword
                      ? "Les mots de passe ne correspondent pas"
                      : ""
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          size="small"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </MDBox>

              <Box display="flex" alignItems="center" mb={3}>
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  sx={{
                    color: alpha(THEME.primary, 0.3),
                    "&.Mui-checked": {
                      color: THEME.primary,
                    },
                  }}
                />
                <Typography variant="button" fontWeight="regular" color="text">
                  J&apos;accepte les&nbsp;
                </Typography>
                <Typography
                  component="a"
                  href="#"
                  variant="button"
                  fontWeight="bold"
                  sx={{ color: THEME.primary, cursor: "pointer", textDecoration: "none" }}
                >
                  conditions d&apos;utilisation
                </Typography>
              </Box>

              <GradientButton type="submit" fullWidth disabled={loading}>
                {loading ? (
                  <CircularProgress size={24} sx={{ color: "white" }} />
                ) : (
                  "Créer mon compte"
                )}
              </GradientButton>

              <Divider sx={{ my: 3 }}>
                <InfoChip label="Déjà invité ?" size="small" color="primary" />
              </Divider>

              <Box textAlign="center">
                <Typography variant="button" color="textSecondary">
                  Vous avez déjà un compte ?{" "}
                </Typography>
                <Typography
                  component="a"
                  href="/authentication/sign-in"
                  variant="button"
                  fontWeight="bold"
                  sx={{ color: THEME.primary, cursor: "pointer", textDecoration: "none", ml: 1 }}
                >
                  Se connecter
                </Typography>
              </Box>
            </MDBox>
          )}

          {/* Étape 2 : Vérification email */}
          {step === 2 && (
            <MDBox component="form" role="form" onSubmit={handleVerify}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: alpha(THEME.primary, 0.04),
                  borderRadius: 2,
                  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Avatar sx={{ bgcolor: alpha(THEME.primary, 0.1), color: THEME.primary }}>
                  <EmailIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Email de vérification envoyé à
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {email || "Chargement..."}
                  </Typography>
                  {!email && (
                    <Typography variant="caption" color="error">
                      Email non disponible
                    </Typography>
                  )}
                </Box>
              </Paper>

              <MDBox mb={3}>
                <StyledInput
                  type="text"
                  label="Code de vérification"
                  variant="standard"
                  fullWidth
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SecurityIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </MDBox>

              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="caption" color="textSecondary">
                  Vous n&apos;avez pas reçu le code ?
                </Typography>
                <Typography
                  component="a"
                  onClick={handleResendCode}
                  variant="caption"
                  fontWeight="bold"
                  sx={{
                    color: THEME.primary,
                    cursor: "pointer",
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Renvoyer
                </Typography>
              </Box>

              <GradientButton type="submit" fullWidth disabled={loading || !email}>
                {loading ? (
                  <CircularProgress size={24} sx={{ color: "white" }} />
                ) : (
                  "Vérifier mon email"
                )}
              </GradientButton>

              <Box mt={3} textAlign="center">
                <Typography
                  component="a"
                  onClick={() => setStep(1)}
                  variant="button"
                  sx={{
                    color: THEME.primary,
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                  Retour à la création du compte
                </Typography>
              </Box>
            </MDBox>
          )}

          {/* Indicateur de sécurité */}
          <Box mt={3} display="flex" justifyContent="center" gap={2}>
            <InfoChip icon={<LockIcon />} label="Sécurisé" size="small" color="success" />
            <InfoChip icon={<VerifiedIcon />} label="Vérifié" size="small" color="info" />
          </Box>
        </MDBox>
      </StyledCard>
    </CoverLayout>
  );
}

export default AcceptInvite;
