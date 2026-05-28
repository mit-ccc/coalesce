import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      const storedUserId = localStorage.getItem("userId");
      if (storedUserId) {
        try {
          const response = await fetch("/api/protected", {
            credentials: "include",
          });
          if (response.ok) {
            setIsAuthenticated(true);
            setUserId(storedUserId);
          } else {
            localStorage.removeItem("userId");
          }
        } catch (error) {
          localStorage.removeItem("userId");
          console.error("Auth check failed:", error);
        }
      }
      setIsLoading(false);
    };
    checkAuthentication();
  }, []);

  // login now does the fetch and returns the projects data
  const login = async (userIdInput) => {
    setIsLoading(true);
    try {
      const res = await fetch(
        "/api/log_in",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ user_code: userIdInput }),
        }
      );
      if (!res.ok) throw new Error("Invalid user code");
      const result = await res.json();
      setIsAuthenticated(true);
      setUserId(userIdInput);
      localStorage.setItem("userId", userIdInput);
      return result;
    } catch (error) {
      setIsAuthenticated(false);
      setUserId(null);
      localStorage.removeItem("userId");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserId(null);
    localStorage.removeItem("userId");
  };

  // new helper to set auth state when token login is used
  const setAuth = (newUserId) => {
    if (newUserId) {
      setIsAuthenticated(true);
      setUserId(newUserId);
      localStorage.setItem("userId", newUserId);
    } else {
      setIsAuthenticated(false);
      setUserId(null);
      localStorage.removeItem("userId");
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userId, login, logout, isLoading, setAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
