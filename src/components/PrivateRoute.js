import React from "react";
import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { getAuthToken } from "../services/axiosConfig";

const PrivateRoute = ({ children }) => {
  const token = getAuthToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PrivateRoute;
