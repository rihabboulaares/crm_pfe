// src/pages/ChangePassword.js
import { useState } from "react";
import axios from "axios";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Vous devez être connecté");
      navigate("/sign-in");
      return;
    }

    try {
      const res = await axios.put(
        "http://127.0.0.1:8000/api/users/change_password/", // ✅ URL correcte
        { old_password: oldPassword, new_password: newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`, // ✅ token envoyé correctement
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
    <MDBox width="400px" mx="auto" mt={5} display="flex" flexDirection="column" gap={2}>
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
      <MDButton onClick={handleSubmit} color="info">
        Changer le mot de passe
      </MDButton>
      {message && <p>{message}</p>}
    </MDBox>
  );
}
