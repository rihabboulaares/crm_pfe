/* eslint-disable prettier/prettier */
// src/pages/CompleteProfile.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Divider,
  Box,
  Avatar,
  Alert,
  AlertTitle,
  Typography,
  alpha,
  Paper,
  LinearProgress,
  Stack,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
} from "@mui/material";
import {
  Person as PersonIcon,
  Work as WorkIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon,
  PhotoCamera as PhotoCameraIcon,
  LinkedIn as LinkedInIcon,
  Phone as PhoneIcon,
  LocationCity as LocationCityIcon,
  CalendarToday as CalendarIcon,
  Group as GroupIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import { useMaterialUIController, setLayout } from "context";

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

const UploadArea = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  border: `2px dashed ${alpha(THEME.primary, 0.3)}`,
  borderRadius: 16,
  textAlign: "center",
  cursor: "pointer",
  transition: "all 0.2s",
  backgroundColor: alpha(THEME.primary, 0.02),
  "&:hover": {
    borderColor: THEME.primary,
    backgroundColor: alpha(THEME.primary, 0.04),
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

const SectionTitle = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(3),
  paddingBottom: theme.spacing(1),
  borderBottom: `2px solid ${alpha(THEME.primary, 0.1)}`,
  "& .MuiSvgIcon-root": {
    color: THEME.primary,
    fontSize: 28,
  },
  "& .MuiTypography-root": {
    color: THEME.neutral[800],
    fontWeight: 600,
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
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: completed ? THEME.success : active ? THEME.primary : alpha(THEME.primary, 0.1),
  color: completed || active ? "white" : THEME.primary,
  transition: "all 0.3s ease",
  fontSize: 20,
  fontWeight: 600,
  boxShadow: active ? `0 4px 12px ${alpha(THEME.primary, 0.3)}` : "none",
}));

// Sections du formulaire
const STEPS = [
  {
    label: "Informations personnelles & professionnelles",
    icon: <PersonIcon />,
    description: "Vos coordonnées, poste et réseau",
  },
  {
    label: "Informations société",
    icon: <BusinessIcon />,
    description: "Les détails de votre entreprise",
  },
];

function CompleteProfile() {
  const [, dispatch] = useMaterialUIController();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showTrialMessage, setShowTrialMessage] = useState(false);

  // State groupé par section
  const [formData, setFormData] = useState({
    // Personnel & Professionnel (fusionnés)
    phoneNumber: "",
    country: "",
    city: "",
    jobTitle: "",
    linkedinUrl: "",
    profilePicture: null,
    profilePreview: null,

    // Société
    companyName: "",
    industry: "",
    numberOfEmployees: "",
    companyLogo: null,
    logoPreview: null,
    companyCountry: "",
    companyCity: "",
    companyPhone: "",
    foundedYear: "",
  });

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  // Options pour les selects
  const options = {
    countries: ["Tunisie", "France", "USA", "Canada", "Belgique", "Maroc", "Algérie", "Suisse"],
    industries: [
      "Tech",
      "Finance",
      "Marketing",
      "Services",
      "Consulting",
      "E-commerce",
      "Industrie",
      "Santé",
      "Éducation",
      "Immobilier",
    ],
  };

  // Gestionnaires d'événements
  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleFileChange = (field, previewField) => (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        [field]: file,
        [previewField]: URL.createObjectURL(file),
      }));
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Validation par étape
  const validateStep = () => {
    switch (activeStep) {
      case 0:
        return formData.phoneNumber && formData.country && formData.city && formData.jobTitle;
      case 1:
        return formData.companyName && formData.industry;
      default:
        return true;
    }
  };

  // Calcul de la progression
  const getProgress = () => {
    let completed = 0;
    if (formData.phoneNumber && formData.country && formData.city && formData.jobTitle) completed++;
    if (formData.companyName && formData.industry) completed++;
    return (completed / 2) * 100;
  };

  // Calcul de la date de fin de période d'essai
  const getTrialEndDate = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 15);
    return endDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Session expirée");

      const submitData = new FormData();

      const fieldMappings = {
        phoneNumber: "phone_number",
        country: "country",
        city: "city",
        jobTitle: "job_title",
        linkedinUrl: "linkedin_url",
        companyName: "name",
        industry: "industry",
        numberOfEmployees: "number_of_employees",
        companyCountry: "country",
        companyCity: "city",
        companyPhone: "phone_number",
        foundedYear: "founded_year",
      };

      Object.entries(fieldMappings).forEach(([localField, apiField]) => {
        if (formData[localField]) {
          submitData.append(apiField, formData[localField]);
        }
      });

      if (formData.profilePicture) {
        submitData.append("profile_picture", formData.profilePicture);
      }
      if (formData.companyLogo) {
        submitData.append("logo", formData.companyLogo);
      }

      await axios.put("/api/users/complete-profile/", submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setShowTrialMessage(true);

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 5000);
    } catch (error) {
      console.error("Erreur:", error);
      setMessage(error.response?.data?.detail || "Une erreur est survenue lors de la sauvegarde");
      setShowTrialMessage(false);
    } finally {
      setLoading(false);
    }
  };

  // Rendu de la section fusionnée (personnel + professionnel)
  const renderPersonalProfessionalInfo = () => (
    <Grid container spacing={3}>
      {/* Photo de profil - Pleine largeur pour meilleure visibilité */}
      <Grid item xs={12}>
        <SectionTitle>
          <PhotoCameraIcon />
          <Typography variant="h6">Photo de profil</Typography>
        </SectionTitle>
        <UploadArea>
          <input
            accept="image/*"
            type="file"
            id="profile-upload"
            onChange={handleFileChange("profilePicture", "profilePreview")}
            style={{ display: "none" }}
          />
          <label htmlFor="profile-upload">
            <Box sx={{ cursor: "pointer" }}>
              {formData.profilePreview ? (
                <Avatar
                  src={formData.profilePreview}
                  sx={{
                    width: 120,
                    height: 120,
                    mx: "auto",
                    mb: 2,
                    border: `4px solid ${THEME.primary}`,
                  }}
                />
              ) : (
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    mx: "auto",
                    mb: 2,
                    bgcolor: alpha(THEME.primary, 0.1),
                    color: THEME.primary,
                  }}
                >
                  <PhotoCameraIcon sx={{ fontSize: 48 }} />
                </Avatar>
              )}
              <Typography variant="body2" color="textSecondary">
                {formData.profilePreview
                  ? "Cliquez pour changer la photo"
                  : "Cliquez pour ajouter une photo de profil"}
              </Typography>
            </Box>
          </label>
        </UploadArea>
      </Grid>

      {/* Informations de contact */}
      <Grid item xs={12}>
        <SectionTitle>
          <BadgeIcon />
          <Typography variant="h6">Informations de contact</Typography>
        </SectionTitle>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Téléphone"
          fullWidth
          value={formData.phoneNumber}
          onChange={handleChange("phoneNumber")}
          required
          InputProps={{
            startAdornment: <PhoneIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth required>
          <InputLabel>Pays</InputLabel>
          <Select
            value={formData.country}
            onChange={handleChange("country")}
            label="Pays"
            sx={{ borderRadius: 2 }}
          >
            {options.countries.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Ville"
          fullWidth
          value={formData.city}
          onChange={handleChange("city")}
          required
          InputProps={{
            startAdornment: <LocationCityIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      {/* Informations professionnelles */}
      <Grid item xs={12}>
        <SectionTitle sx={{ mt: 2 }}>
          <WorkIcon />
          <Typography variant="h6">Informations professionnelles</Typography>
        </SectionTitle>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Titre du poste"
          fullWidth
          value={formData.jobTitle}
          onChange={handleChange("jobTitle")}
          required
          InputProps={{
            startAdornment: <WorkIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="LinkedIn (optionnel)"
          fullWidth
          value={formData.linkedinUrl}
          onChange={handleChange("linkedinUrl")}
          placeholder="https://linkedin.com/in/..."
          InputProps={{
            startAdornment: <LinkedInIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>
    </Grid>
  );

  const renderCompanyInfo = () => (
    <Grid container spacing={3}>
      {/* Logo entreprise */}
      <Grid item xs={12}>
        <SectionTitle>
          <BusinessIcon />
          <Typography variant="h6">Logo de l&apos;entreprise</Typography>
        </SectionTitle>
        <UploadArea>
          <input
            accept="image/*"
            type="file"
            id="logo-upload"
            onChange={handleFileChange("companyLogo", "logoPreview")}
            style={{ display: "none" }}
          />
          <label htmlFor="logo-upload">
            <Box sx={{ cursor: "pointer" }}>
              {formData.logoPreview ? (
                <Avatar
                  src={formData.logoPreview}
                  variant="rounded"
                  sx={{
                    width: 120,
                    height: 120,
                    mx: "auto",
                    mb: 2,
                    border: `4px solid ${THEME.primary}`,
                    borderRadius: 2,
                  }}
                />
              ) : (
                <Avatar
                  variant="rounded"
                  sx={{
                    width: 120,
                    height: 120,
                    mx: "auto",
                    mb: 2,
                    bgcolor: alpha(THEME.primary, 0.1),
                    color: THEME.primary,
                    borderRadius: 2,
                  }}
                >
                  <BusinessIcon sx={{ fontSize: 48 }} />
                </Avatar>
              )}
              <Typography variant="body2" color="textSecondary">
                {formData.logoPreview
                  ? "Cliquez pour changer le logo"
                  : "Cliquez pour ajouter un logo"}
              </Typography>
            </Box>
          </label>
        </UploadArea>
      </Grid>

      {/* Informations principales */}
      <Grid item xs={12}>
        <SectionTitle>
          <BusinessIcon />
          <Typography variant="h6">Informations principales</Typography>
        </SectionTitle>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Nom de la société"
          fullWidth
          value={formData.companyName}
          onChange={handleChange("companyName")}
          required
          InputProps={{
            startAdornment: <BusinessIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth required>
          <InputLabel>Secteur d&apos;activité</InputLabel>
          <Select
            value={formData.industry}
            onChange={handleChange("industry")}
            label="Secteur d'activité"
            sx={{ borderRadius: 2 }}
          >
            {options.industries.map((i) => (
              <MenuItem key={i} value={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Nombre d'employés"
          type="number"
          fullWidth
          value={formData.numberOfEmployees}
          onChange={handleChange("numberOfEmployees")}
          InputProps={{
            startAdornment: <GroupIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Téléphone société"
          fullWidth
          value={formData.companyPhone}
          onChange={handleChange("companyPhone")}
          InputProps={{
            startAdornment: <PhoneIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Année de fondation"
          type="number"
          fullWidth
          value={formData.foundedYear}
          onChange={handleChange("foundedYear")}
          placeholder="2020"
          inputProps={{ min: 1800, max: new Date().getFullYear() }}
          InputProps={{
            startAdornment: <CalendarIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>

      {/* Adresse */}
      <Grid item xs={12}>
        <SectionTitle sx={{ mt: 2 }}>
          <LocationCityIcon />
          <Typography variant="h6">Adresse de la société</Typography>
        </SectionTitle>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Pays</InputLabel>
          <Select
            value={formData.companyCountry}
            onChange={handleChange("companyCountry")}
            label="Pays"
            sx={{ borderRadius: 2 }}
          >
            {options.countries.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <MDInput
          label="Ville"
          fullWidth
          value={formData.companyCity}
          onChange={handleChange("companyCity")}
          InputProps={{
            startAdornment: <LocationCityIcon sx={{ mr: 1, color: THEME.primary }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "&:hover fieldset": { borderColor: THEME.primaryLight },
              "&.Mui-focused fieldset": { borderColor: THEME.primary },
            },
          }}
        />
      </Grid>
    </Grid>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderPersonalProfessionalInfo();
      case 1:
        return renderCompanyInfo();
      default:
        return null;
    }
  };

  // Si le message de période d'essai est affiché
  if (showTrialMessage) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #fff7f7 0%, #f8fafc 55%, #ffffff 100%)",
          py: { xs: 3, md: 5 },
          px: { xs: 2, md: 4 },
        }}
      >
        <Box
          sx={{
            maxWidth: 1280,
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 4,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Box className="public-logo-mark">V</Box>
            <Typography className="public-logo-text">ViewiseCRM</Typography>
          </Stack>
        </Box>
        <MDBox py={3} px={3}>
          <StyledCard sx={{ maxWidth: 700, mx: "auto" }}>
            <CardContent sx={{ p: 4 }}>
              <Alert
                severity="success"
                sx={{
                  mb: 3,
                  borderRadius: 2,
                  border: `1px solid ${alpha(THEME.success, 0.3)}`,
                }}
              >
                <AlertTitle sx={{ fontWeight: 700 }}>
                  <CheckCircleIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                  Profil complété avec succès !
                </AlertTitle>
                Félicitations ! Votre profil a été créé avec succès.
              </Alert>

              <Paper
                sx={{
                  p: 3,
                  bgcolor: alpha(THEME.primary, 0.04),
                  borderRadius: 3,
                  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
                  mb: 3,
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ color: THEME.primary }}>
                  <BusinessIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                  Période d&apos;essai de 15 jours
                </Typography>
                <Typography variant="body1" paragraph>
                  Vous bénéficiez maintenant d&apos;une période d&apos;essai gratuite de 15 jours
                  pour découvrir toutes les fonctionnalités de notre plateforme.
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                  <Chip
                    icon={<CalendarIcon />}
                    label={`Date de fin : ${getTrialEndDate()}`}
                    sx={{
                      bgcolor: alpha(THEME.info, 0.1),
                      color: THEME.info,
                      fontWeight: 600,
                    }}
                  />
                </Stack>
              </Paper>

              <Typography variant="body2" color="textSecondary" paragraph>
                Profitez pleinement de cette période pour explorer toutes les fonctionnalités qui
                vous sont offertes. Vous serez redirigé vers votre tableau de bord dans quelques
                secondes...
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <GradientButton onClick={() => navigate("/dashboard", { replace: true })}>
                  Aller au tableau de bord maintenant
                </GradientButton>
              </Box>

              <LinearProgress
                sx={{
                  mt: 3,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: alpha(THEME.primary, 0.1),
                  "& .MuiLinearProgress-bar": {
                    background: THEME.gradient,
                  },
                }}
              />
            </CardContent>
          </StyledCard>
        </MDBox>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff7f7 0%, #f8fafc 55%, #ffffff 100%)",
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 4,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box className="public-logo-mark">V</Box>
          <Typography className="public-logo-text">ViewiseCRM</Typography>
        </Stack>
      </Box>
      <Grid container spacing={4} sx={{ maxWidth: 1280, mx: "auto" }}>
        <Grid item xs={12} lg={8}>
          <StyledCard className="complete-profile-card" sx={{ width: "100%" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h4"
                sx={{ color: THEME.primary, fontWeight: 700, mb: 1, textAlign: "center" }}
              >
                Compléter votre profil
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 4, textAlign: "center" }}>
                Ajoutez les dernières informations nécessaires pour personnaliser votre espace.
              </Typography>

              {/* Stepper personnalisé */}
              <Stepper
                activeStep={activeStep}
                connector={<ColorStepConnector />}
                alternativeLabel
                sx={{
                  mb: 4,
                  "& .MuiStepLabel-label": {
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                  },
                }}
              >
                {STEPS.map((step, index) => (
                  <Step key={index}>
                    <StepLabel
                      StepIconComponent={({ active, completed }) => (
                        <ColorStepIcon active={active} completed={completed}>
                          {completed ? <CheckCircleIcon /> : index + 1}
                        </ColorStepIcon>
                      )}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {step.label}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {step.description}
                      </Typography>
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>

              {/* Barre de progression */}
              <Box sx={{ mb: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" fontWeight={600}>
                    Progression
                  </Typography>
                  <Typography variant="body2" sx={{ color: THEME.primary }}>
                    {Math.round(getProgress())}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={getProgress()}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(THEME.primary, 0.1),
                    "& .MuiLinearProgress-bar": {
                      background: THEME.gradient,
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: alpha(THEME.primary, 0.02),
                  borderRadius: 3,
                  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
                }}
              >
                <form onSubmit={handleSubmit}>
                  {getStepContent(activeStep)}

                  {message && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                      {message}
                    </Alert>
                  )}

                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
                    <MDButton
                      variant="outlined"
                      onClick={handleBack}
                      disabled={activeStep === 0}
                      startIcon={<ArrowBackIcon />}
                      sx={{
                        borderColor: alpha(THEME.primary, 0.3),
                        color: THEME.primary,
                        borderRadius: 2,
                        "&:hover": {
                          borderColor: THEME.primary,
                          bgcolor: alpha(THEME.primary, 0.04),
                        },
                      }}
                    >
                      Retour
                    </MDButton>

                    {activeStep === STEPS.length - 1 ? (
                      <GradientButton
                        type="submit"
                        disabled={loading || !validateStep()}
                        startIcon={<SaveIcon />}
                      >
                        {loading ? "Enregistrement..." : "Terminer"}
                      </GradientButton>
                    ) : (
                      <GradientButton
                        onClick={handleNext}
                        disabled={!validateStep()}
                        endIcon={<ArrowForwardIcon />}
                      >
                        Suivant
                      </GradientButton>
                    )}
                  </Box>
                </form>
              </Paper>

              {/* Résumé des informations */}
              {getProgress() > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }}>
                    <InfoChip label="Résumé des informations saisies" color="primary" />
                  </Divider>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {formData.phoneNumber && (
                      <InfoChip icon={<PhoneIcon />} label={formData.phoneNumber} />
                    )}
                    {formData.country && formData.city && (
                      <InfoChip
                        icon={<LocationCityIcon />}
                        label={`${formData.city}, ${formData.country}`}
                      />
                    )}
                    {formData.jobTitle && (
                      <InfoChip icon={<WorkIcon />} label={formData.jobTitle} />
                    )}
                    {formData.companyName && (
                      <InfoChip icon={<BusinessIcon />} label={formData.companyName} />
                    )}
                    {formData.industry && (
                      <InfoChip icon={<BusinessIcon />} label={formData.industry} />
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Box
            sx={{
              minHeight: { xs: 260, lg: "100%" },
              borderRadius: 4,
              p: 4,
              color: "white",
              background: THEME.gradient,
              position: "relative",
              overflow: "hidden",
              boxShadow: `0 20px 50px ${alpha(THEME.primary, 0.25)}`,
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 220,
                height: 220,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.12)",
                top: -60,
                right: -60,
              }}
            />
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.2}
              sx={{ mb: 8, position: "relative" }}
            >
              <Box className="public-logo-mark light">V</Box>
              <Typography fontWeight={700}>ViewiseCRM</Typography>
            </Stack>
            <Box sx={{ position: "relative" }}>
              <Typography variant="h3" fontWeight={800} sx={{ mb: 2, color: "white" }}>
                Votre espace est presque prêt.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.85)", mb: 4 }}>
                Ces informations permettent de mieux organiser votre espace commercial.
              </Typography>
              <Stack spacing={2}>
                {["Compte créé", "Profil complété", "Espace prêt"].map((label, index) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor:
                        index <= activeStep ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "white",
                        color: THEME.primary,
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography fontWeight={600}>{label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CompleteProfile;
