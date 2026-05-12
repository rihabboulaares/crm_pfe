import React from "react";
import { useNavigate } from "react-router-dom";
import MDButton from "components/MDButton";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Bienvenue dans votre CRM</h1>
      <MDButton
        onClick={() => navigate("/authentication/sign-up")}
        variant="gradient"
        color="info"
        style={{ margin: "10px" }}
      >
        Démarrer une CRM
      </MDButton>
      <MDButton
        onClick={() => navigate("/authentication/sign-in")}
        variant="gradient"
        color="info"
        style={{ margin: "10px" }}
      >
        Se connecter
      </MDButton>
    </div>
  );
};

export default LandingPage;
