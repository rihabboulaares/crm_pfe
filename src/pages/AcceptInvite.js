/* eslint-disable prettier/prettier */
// src/pages/AcceptInvite.js
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Alert,
  alpha,
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
  Shield,
  Verified,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

import { useMaterialUIController, setLayout } from "context";

const crmTheme = {
  primary: {
    main: "#c0392b",
    light: "#e05b4a",
    subtle: "#f7e8e8",
    gradient: "linear-gradient(135deg, #c0392b 0%, #5a0002 100%)",
  },
  success: { main: "#18a558", subtle: "#dcfce7" },
  warning: { main: "#f59e0b", subtle: "#fff7ed" },
  error: { main: "#dc2626", subtle: "#fee2e2" },
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

const passwordValidationLabels = {
  minLength: "8+ caracteres",
  hasNumber: "Chiffre",
  hasUpperCase: "Majuscule",
  hasLowerCase: "Minuscule",
  hasSpecialChar: "Caractere special",
};

function AcceptInvite() {
  const [, dispatch] = useMaterialUIController();
  const { token } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordValidations, setPasswordValidations] = useState({
    minLength: false,
    hasNumber: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

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
    setPasswordStrength(Object.values(validations).filter(Boolean).length);
  }, [password]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return crmTheme.error.main;
    if (passwordStrength <= 3) return crmTheme.warning.main;
    return crmTheme.success.main;
  };

  const getPasswordStrengthText = () => {
    if (!password) return "";
    if (passwordStrength <= 1) return "Tres faible";
    if (passwordStrength === 2) return "Faible";
    if (passwordStrength === 3) return "Moyen";
    if (passwordStrength === 4) return "Fort";
    return "Tres fort";
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "success" });

    if (!username || !password || !confirmPassword) {
      setMessage({ text: "Tous les champs sont obligatoires", type: "error" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Les mots de passe ne correspondent pas", type: "error" });
      return;
    }

    if (passwordStrength < 3) {
      setMessage({ text: "Veuillez choisir un mot de passe plus securise", type: "error" });
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

      if (response.data?.email) {
        setEmail(response.data.email);
      } else if (response.data?.user?.email) {
        setEmail(response.data.user.email);
      }

      setMessage({
        text: "Compte cree avec succes. Un code de verification vous a ete envoye par email.",
        type: "success",
      });

      setTimeout(() => {
        setStep(2);
        setMessage({ text: "", type: "success" });
      }, 1200);
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

  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "success" });

    if (!code) {
      setMessage({ text: "Veuillez entrer le code de verification", type: "error" });
      return;
    }

    if (!email) {
      setMessage({
        text: "Email non disponible. Veuillez reessayer ou contacter le support.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    try {
      await axios.post("http://127.0.0.1:8000/api/users/verify-email/", {
        email,
        code,
      });

      setMessage({ text: "Email verifie avec succes !", type: "success" });

      setTimeout(() => {
        navigate("/authentication/sign-in");
      }, 1500);
    } catch (error) {
      console.error("Erreur verify-email:", error.response?.data);
      setMessage({
        text:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "Code de verification invalide",
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
      await axios.post("http://127.0.0.1:8000/api/users/resend-verification/", {
        email,
      });
      setMessage({ text: "Nouveau code envoye !", type: "success" });
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

  const steps = ["Compte", "Verification"];
  const inputIconColor = (field) =>
    focusedField === field ? crmTheme.primary.main : crmTheme.neutral[400];

  return (
    <Box className="auth-page auth-invite-page">
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
        <Box className="auth-split auth-invite">
          <Box className="auth-red-panel">
            <Box className="auth-panel-brand">
              <Box className="public-logo-mark light">V</Box>
              <Typography>ViewiseCRM</Typography>
            </Box>
            <Box className="auth-panel-content">
              <Box className="auth-panel-badge">Invitation equipe</Box>
              <Typography component="h1">Finalisez votre acces en quelques instants.</Typography>
              <Typography>
                Creez votre compte, verifiez votre adresse email et rejoignez directement l&apos;espace
                de travail de votre equipe.
              </Typography>
              <Box className="auth-panel-features">
                {[
                  "Invitation securisee",
                  "Compte rattache a votre equipe",
                  "Verification email obligatoire",
                  "Acces CRM immediat apres validation",
                ].map((item) => (
                  <Box key={item}>{item}</Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box className="auth-form-area">
            <StyledCard className="auth-card invitation-card">
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
                    {step === 1 ? "Accepter l'invitation" : "Verifier votre email"}
                  </Typography>
                  <Typography className="auth-subtitle">
                    {step === 1
                      ? "Choisissez vos identifiants pour activer votre acces ViewiseCRM."
                      : "Entrez le code recu par email pour terminer l'activation."}
                  </Typography>
                </Box>

                {message.text && (
                  <Alert className="crm-alert" severity={message.type} sx={{ mb: 3 }}>
                    {message.text}
                  </Alert>
                )}

                {step === 1 && (
                  <form onSubmit={handleAccept}>
                    <Stack spacing={3}>
                      <StyledTextField
                        className="auth-input"
                        fullWidth
                        label="Nom d'utilisateur"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFocusedField("username")}
                        onBlur={() => setFocusedField(null)}
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person sx={{ color: inputIconColor("username"), fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        }}
                      />

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
                                <Lock sx={{ color: inputIconColor("password"), fontSize: 20 }} />
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

                        {password && (
                          <Box sx={{ mt: 1.2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                              <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                                Force du mot de passe
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: getPasswordStrengthColor(), fontWeight: 800 }}
                              >
                                {getPasswordStrengthText()}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(passwordStrength / 5) * 100}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: crmTheme.neutral[200],
                                "& .MuiLinearProgress-bar": {
                                  borderRadius: 3,
                                  backgroundColor: getPasswordStrengthColor(),
                                },
                              }}
                            />
                            <Box className="invite-password-rules">
                              {Object.entries(passwordValidations).map(([key, valid]) => (
                                <Box
                                  key={key}
                                  className={valid ? "invite-password-rule valid" : "invite-password-rule"}
                                >
                                  <CheckCircle fontSize="inherit" />
                                  {passwordValidationLabels[key]}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>

                      <StyledTextField
                        className="auth-input"
                        fullWidth
                        label="Confirmer le mot de passe"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField("confirmPassword")}
                        onBlur={() => setFocusedField(null)}
                        required
                        error={Boolean(confirmPassword && password !== confirmPassword)}
                        helperText={
                          confirmPassword && password !== confirmPassword
                            ? "Les mots de passe ne correspondent pas"
                            : ""
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock
                                sx={{ color: inputIconColor("confirmPassword"), fontSize: 20 }}
                              />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                                sx={{
                                  color: crmTheme.neutral[500],
                                  "&:hover": { color: crmTheme.primary.main },
                                }}
                              >
                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
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

                      <StyledButton
                        className="auth-button"
                        type="submit"
                        fullWidth
                        disabled={loading}
                        startIcon={<Send />}
                      >
                        {loading ? "Creation en cours..." : "Creer mon compte"}
                      </StyledButton>
                    </Stack>
                  </form>
                )}

                {step === 2 && (
                  <form onSubmit={handleVerify}>
                    <Stack spacing={3}>
                      <Box className="invite-email-summary">
                        <Box className="invite-email-icon">
                          <Email />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                            Code envoye a
                          </Typography>
                          <Typography sx={{ color: crmTheme.neutral[800], fontWeight: 900 }}>
                            {email || "Email non disponible"}
                          </Typography>
                        </Box>
                      </Box>

                      <StyledTextField
                        className="auth-input"
                        fullWidth
                        label="Code de verification"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onFocus={() => setFocusedField("code")}
                        onBlur={() => setFocusedField(null)}
                        required
                        helperText="Un code a 6 chiffres vous a ete envoye par email"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Shield sx={{ color: inputIconColor("code"), fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        }}
                      />

                      <Box className="invite-resend-row">
                        <Typography variant="caption" sx={{ color: crmTheme.neutral[500] }}>
                          Vous n&apos;avez pas recu le code ?
                        </Typography>
                        <Button
                          variant="text"
                          onClick={handleResendCode}
                          disabled={loading || !email}
                          sx={{
                            color: crmTheme.primary.main,
                            textTransform: "none",
                            fontWeight: 900,
                            p: 0,
                            minWidth: 0,
                          }}
                        >
                          Renvoyer
                        </Button>
                      </Box>

                      <StyledButton
                        className="auth-button"
                        type="submit"
                        fullWidth
                        disabled={loading || !email}
                        startIcon={<Verified />}
                      >
                        {loading ? "Verification..." : "Verifier mon email"}
                      </StyledButton>

                      <Button
                        variant="text"
                        onClick={() => {
                          setStep(1);
                          setMessage({ text: "", type: "success" });
                        }}
                        startIcon={<ArrowBack />}
                        sx={{
                          color: crmTheme.neutral[600],
                          textTransform: "none",
                          fontWeight: 800,
                        }}
                      >
                        Retour a la creation du compte
                      </Button>
                    </Stack>
                  </form>
                )}
              </Box>
            </StyledCard>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default AcceptInvite;
