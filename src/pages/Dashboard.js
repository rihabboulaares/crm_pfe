import React from "react";
import MDButton from "components/MDButton";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Bienvenue dans le Dashboard CRM</h1>
      <MDButton variant="gradient" color="error" onClick={logout}>
        Déconnexion
      </MDButton>
    </div>
  );
};

export default Dashboard;
