import React, { useState, useEffect } from "react";
import StartPage from "./components/start_components/StartPage";
import ProjectsPage from "./components/start_components/ProjectsPage";
import ContextPage from "./components/start_components/ContextPage";
import NoPage from "./components/NoPage";
import PlatformPage from "./components/workspace_components/PlatformPage";
import EventTracking from "./components/EventTracking";
import { useAuth } from "./context/AuthContext";
import AuthRedirect from "./components/AuthRedirect";

// routing
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

function App() {
  let navigate = useNavigate();
  const location = useLocation();

  const { userId, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect after auth check is done
    if (!isLoading && !isAuthenticated && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate]);

  return (
    <div>
      <Routes>
        <Route exact path="/" element={<StartPage userCode={userId} />} />
        <Route
          exact
          path="/projects"
          element={<ProjectsPage userCode={userId} />}
        />
        <Route
          exact
          path="/newProject/:projectID"
          element={<ContextPage userCode={userId} />}
        />
        <Route
          exact
          path="/project/:projectID"
          element={<PlatformPage userCode={userId} />}
        />
        <Route exact path="/auth-redirect" element={<AuthRedirect />} />
        <Route path="*" element={<NoPage />} />
      </Routes>
      <EventTracking userCode={userId} />
    </div>
  );
}

export default App;
