// src/components/SuperAdminRoute.js
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";

function SuperAdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token) {
    return <Navigate to="/authentication/sign-in" replace />;
  }

  if (user.role !== "SUPERADMIN" && !user.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

SuperAdminRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SuperAdminRoute;
