import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setProjectDetails,
  resetCellHistory,
  resetClassificationList,
} from "../../store/projectDetailsSlice";
import { setProjectContext } from "../../store/projectContextSlice";
import { setTopics, resetTopicSlice } from "../../store/analyzeTopicsSlice";
import { resetGenerateOptions } from "../../store/generateOptionsSlice";
import { resetChecks } from "../../store/questionChecksSlice";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";
import ErrorDialog from "../common_components/ErrorDialog";
import SurveyBuilder from "./SurveyBuilder";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { Typography } from "@mui/material";
import { SUPPORT_EMAIL } from "../../config";

function PlatformPage(props) {
  // core page where users iterate on questions
  // props is userCode

  const { projectID } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const projectDetails = useSelector((state) => state.projectDetails);

  const [loading, setLoading] = useState(true);
  // state variable for error message
  const [serverErrorOpenProject, setServerErrorOpenProject] = useState(false);

  // function to close the server error dialog
  const handleCloseServerErrorOpenProject = () => {
    setServerErrorOpenProject(false);
  };

  useEffect(() => {
    if (!projectID) return;
    // If the project is already in Redux (same project_id), skip fetching.
    if (projectDetails && projectDetails.project_id === projectID) {
      console.log("Project already in Redux, skipping load");
      setLoading(false);
      return;
    }
    if (projectID) {
      fetch("/api/load_project", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project_id: projectID }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Project not found");
          return res.json();
        })
        .then((data) => {
          // Dispatch to Redux as in handleOpenProjectClick
          if (
            data.project.question_order &&
            data.project.question_order.length > 0
          ) {
            dispatch(
              setProjectContext({
                project_id: projectID,
                context: data.project.context_response,
                question_order: data.project.question_order,
              })
            );
          } else {
            dispatch(
              setProjectContext({
                project_id: projectID,
                context: data.project.context_response,
              })
            );
          }
          if (
            Object.keys(data.project.analyze_topics_info).length === 0 ||
            Object.keys(data.project.analyze_topics_info.topics).length === 0
          ) {
            dispatch(resetTopicSlice());
          } else {
            let sortedTopics = {};
            Object.keys(data.project.analyze_topics_info.topics)
              .sort((a, b) => {
                if (
                  data.project.analyze_topics_info.topics[a].cells.length === 0
                ) {
                  return 1;
                } else if (
                  data.project.analyze_topics_info.topics[b].cells.length === 0
                ) {
                  return -1;
                } else {
                  return 0;
                }
              })
              .forEach((key) => {
                sortedTopics[key] =
                  data.project.analyze_topics_info.topics[key];
              });
            dispatch(
              setTopics({
                topics: sortedTopics,
                human_topics: data.project.human_topics,
                summary: data.project.analyze_topics_info.summary,
                last_analyzed: data.project.analyze_topics_info.last_analyzed,
                suggestions: data.project.analyze_topics_info.suggestions,
              })
            );
          }
          dispatch(
            setProjectDetails({
              project_id: projectID,
              project_title: data.project.project_title,
              sections: data.project.sections,
              cells: data.cells,
            })
          );
          dispatch(resetCellHistory());
          dispatch(resetClassificationList());
          dispatch(resetGenerateOptions());
          dispatch(resetChecks());
          // If the project has no sections, navigate to the newProject page
          if (data.project.sections.length === 0) {
            console.log("No sections found, redirecting to newProject page");
            setLoading(false);
            navigate(`/newProject/${projectID}`);
          } else {
            setLoading(false);
          }
        })
        .catch((error) => {
          // Optionally handle error (show error dialog, etc.)
          console.error(error);
          setServerErrorOpenProject(true);
          setLoading(false);
        });
    }
  }, [projectID, dispatch, navigate, projectDetails]);

  return (
    <ThemeProvider theme={theme}>
      {loading ? (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100vh" }}
          spacing={3}
        >
          <Typography variant="h5">Loading project...</Typography>
          <CircularProgress size={60} />
        </Stack>
      ) : (
        <SurveyBuilder userCode={props.userCode} />
      )}
      {/* Server error dialog for load project */}
      <ErrorDialog
        key={"serverErrorOpenProject"}
        openDialog={serverErrorOpenProject}
        handleCloseDialog={handleCloseServerErrorOpenProject}
        dialogTitle={"Error when loading project"}
        dialogContent={
          `An error occurred when loading in an existing project. Please try again. If the problem persists, please contact support at ${SUPPORT_EMAIL}.`
        }
      />
    </ThemeProvider>
  );
}

export default PlatformPage;
