import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorDialog from "./common_components/ErrorDialog";

export default function AuthRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuth(); // requires AuthContext to expose setAuth
  const [error, setError] = useState("");
  const [openErrorDialog, setOpenErrorDialog] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    const projectID = searchParams.get("projectID");

    if (!token || !projectID) {
      setError("Missing token or projectID in the URL.");
      setOpenErrorDialog(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/token_login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          const msg = data && data.error ? data.error : "Authentication failed";
          setError(msg);
          setOpenErrorDialog(true);
          return;
        }

        if (!data || !data.user_id) {
          setError("Server did not return a user id.");
          setOpenErrorDialog(true);
          return;
        }

        // update auth state and persist userId
        setAuth(data.user_id);

        // navigate to requested project
        navigate(`/project/${projectID}`, { replace: true });
      } catch (err) {
        setError("Network error during authentication.");
        setOpenErrorDialog(true);
      }
    })();
  }, [searchParams, navigate, setAuth]);

  const handleClose = () => {
    setOpenErrorDialog(false);
    navigate("/", { replace: true });
  };

  return (
    <>
      <div>Authenticating...</div>
      <ErrorDialog
        openDialog={openErrorDialog}
        handleCloseDialog={handleClose}
        dialogTitle="Authentication Error"
        dialogContent={error}
      />
    </>
  );
}
