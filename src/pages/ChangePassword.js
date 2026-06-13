/* eslint-disable prettier/prettier */
// src/pages/ChangePassword.js
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, Stack, Typography } from "@mui/material";

import MDInput from "components/MDInput";
import { useMaterialUIController, setLayout } from "context";

export default function ChangePassword() {
  const [, dispatch] = useMaterialUIController();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  const handleSubmit = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Vous devez être connecté");
      navigate("/sign-in");
      return;
    }

    try {
      const res = await axios.put(
        "/api/users/change_password/",
        { old_password: oldPassword, new_password: newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage(res.data.status || "Mot de passe mis à jour avec succès");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      console.error(err.response?.data || err);
      setMessage(err.response?.data?.old_password || err.response?.data?.detail || "Erreur");
    }
  };

  return (
    <Box className="auth-shell password-page">
      <Box className="auth-header">
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box className="public-logo-mark">V</Box>
          <Typography className="public-logo-text">ViewiseCRM</Typography>
        </Stack>
      </Box>

      <Box className="password-card-wrap">
        <Card className="password-card">
          <Typography className="auth-title">Modifier le mot de passe</Typography>
          <Typography className="auth-subtitle">
            Choisissez un mot de passe sécurisé pour protéger votre compte.
          </Typography>
          <Stack spacing={2.4} sx={{ mt: 3 }}>
            <MDInput
              type="password"
              label="Ancien mot de passe"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              fullWidth
            />
            <MDInput
              type="password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
            />
            <Button className="auth-button" onClick={handleSubmit}>
              Mettre à jour le mot de passe
            </Button>
            {message && (
              <Alert
                className="crm-alert"
                severity={message.toLowerCase().includes("erreur") ? "error" : "success"}
              >
                {message}
              </Alert>
            )}
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}
