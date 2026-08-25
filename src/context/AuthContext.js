import { createContext, useCallback, useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";

// Création du contexte
const AuthContext = createContext();

// Provider du contexte
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
  );
  const [loading, setLoading] = useState(true);

  // Charger l'utilisateur depuis le backend
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
  }, []);

  const loadUser = useCallback(
    async (accessToken) => {
      try {
        const res = await axios.get("/api/users/me/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      } catch (err) {
        console.error("loadUser error", err);
        logout();
      }
    },
    [logout]
  );

  // Vérification au montage
  useEffect(() => {
    const initialize = async () => {
      if (token && !user) {
        await loadUser(token);
      }
      setLoading(false);
    };
    initialize();
  }, [loadUser, token, user]);

  // Fonction login
  const login = async (email, password) => {
    try {
      const res = await axios.post("/api/users/login/", {
        email,
        password,
      });
      localStorage.setItem("token", res.data.access);
      setToken(res.data.access);
      await loadUser(res.data.access);
    } catch (err) {
      console.error("login error", err);
      throw err; // On peut gérer l'erreur dans le composant qui appelle login
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Validation des props
AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Hook personnalisé pour accéder au contexte
export const useAuth = () => useContext(AuthContext);
