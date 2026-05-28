import React, { useState } from "react";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { Typography } from "@mui/material";
import TextField from "@mui/material/TextField";

import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";
import background from "../../images/welcome_page_background.svg";

// routing
import { useNavigate } from "react-router-dom";

// redux stuff
import { useDispatch } from "react-redux";
import { addProject } from "../../store/userProjectsSlice";
import { initProjectContext } from "../../store/projectContextSlice";
import { setProjectDetails } from "../../store/projectDetailsSlice";
import { addEvent } from "../../store/userTrackingSlice";

import CustomAppBar from "../common_components/CustomAppBar";
import { timeoutPromise } from "../../utils";
import ErrorDialog from "../common_components/ErrorDialog";

import { useAuth } from "../../context/AuthContext";
import { SUPPORT_EMAIL } from "../../config";

function StartPage(props) {
  // welcome and log-in page

  const navigate = useNavigate();

  const dispatch = useDispatch();

  // ...existing code...
  const { isAuthenticated, userId, login, isLoading } = useAuth();

  // Replace userCode state with local input state
  const [userCodeInput, setUserCodeInput] = useState("");
  // state variable to keep track of whether there is an error with the user code input
  const [userCodeError, setUserCodeError] = React.useState(false);

  // function to remove leading and trailing whitespace from user code input
  const trimUserCode = (userCode) => {
    return userCode.trim();
  };

  const handleLogIn = async (userCodeInput) => {
    const trimmedUserCode = trimUserCode(userCodeInput);
    try {
      await login(trimmedUserCode);
      setUserCodeError(false);
    } catch (error) {
      setUserCodeError(true);
    }
  };

  const handleViewProjectsClick = () => {
    // console.log("View projects button clicked");
    // add event to userTrackingSlice
    dispatch(
      addEvent({
        projectId: "user_level",
        eventType: "viewProjectsFromStartPage",
        eventDetail: {},
      })
    );
    navigate(`/projects`);
  };

  // state variable for error message
  const [serverError, setServerError] = useState(false);

  // function to close the server error dialog
  const handleCloseServerError = () => {
    setServerError(false);
  };

  const handleCreateProjectClick = () => {
    // console.log("Create project button clicked");
    // call the create_project API
    timeoutPromise(
      5000,
      fetch("/api/create_project", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_code: props.userCode }),
      })
    )
      // check for any raised exceptions
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error();
        }
      })
      .then((data) => {
        // console.log(data);
        // add event to userTrackingSlice
        dispatch(
          addEvent({
            projectId: "user_level",
            eventType: "createProjectFromStartPage",
            eventDetail: {
              project_id: data.project_id,
            },
          })
        );
        // update the projects field in userProjectsSlice
        dispatch(
          addProject({
            project_id: data.project_id,
            project_title: data.project_title,
          })
        );
        // update the project_id field in projectContextSlice
        dispatch(
          initProjectContext({
            project_id: data.project_id,
            context_questions: data.questions,
            question_order: data.question_order,
          })
        );
        // update projectDetailsSlice
        dispatch(
          setProjectDetails({
            project_id: data.project_id,
            project_title: data.project_title,
            sections: [],
            cells: {},
          })
        );
        navigate(`/newProject/${data.project_id}`);
      })
      .catch((_error) => {
        console.error("Error creating project");
        setServerError(true);
      });
  };

  return (
    <ThemeProvider theme={theme}>
      <CustomAppBar
        appBarType={"home"}
        userCode={props.userCode}
        helpGuideTab={"welcome"}
      />
      <Stack
        direction="column"
        justifyContent="center"
        alignItems="center"
        spacing={5}
        sx={{ height: "100vh", width: "100vw" }}
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
        }}
      >
        <Typography variant="h2">Welcome</Typography>
        {isAuthenticated ? (
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={2}
          >
            <Button
              onClick={handleViewProjectsClick}
              variant="contained"
              size="large"
            >
              View Projects
            </Button>
            <Button
              onClick={handleCreateProjectClick}
              variant="contained"
              size="large"
            >
              Create Project
            </Button>
          </Stack>
        ) : (
          <>
            <Typography variant="h5">
              Please input your user code to get started
            </Typography>
            {/* Input text field */}
            <TextField
              error={userCodeError}
              value={userCodeInput}
              helperText={userCodeError ? "Invalid user code" : ""}
              variant="outlined"
              type="password"
              sx={{ width: "50vw" }}
              onChange={(event) => setUserCodeInput(event.target.value)}
            />
            {/* Submit button */}
            <Button
              onClick={() => handleLogIn(userCodeInput)}
              variant="bigButtons"
              size="large"
              disabled={isLoading}
            >
              Submit
            </Button>
          </>
        )}
      </Stack>
      {/* Server error dialog */}
      <ErrorDialog
        key={"serverError"}
        openDialog={serverError}
        handleCloseDialog={handleCloseServerError}
        dialogTitle={"Error when creating new project"}
        dialogContent={
          `An error occurred when creating a new project. Please try again. If the problem persists, please contact support at ${SUPPORT_EMAIL}.`
        }
      />
    </ThemeProvider>
  );
}

export default StartPage;
