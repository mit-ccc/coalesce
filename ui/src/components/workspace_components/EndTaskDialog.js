import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import Stack from "@mui/material/Stack";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Slide from "@mui/material/Slide";
import LoadingButton from "@mui/lab/LoadingButton";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import HelpIcon from "@mui/icons-material/Help";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";

// routing
import { useNavigate } from "react-router-dom";

// redux stuff
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { resetCellHistory } from "../../store/projectDetailsSlice";
import { resetNeedToSave } from "../../store/analyzeTopicsSlice";
import { resetEdited } from "../../store/projectContextSlice";
import { setLastSaved } from "../../store/userProjectsSlice";
import { addEvent } from "../../store/userTrackingSlice";

import HelpGuideDialog from "../common_components/HelpGuideDialog";
import TentativeCell from "../common_components/TentativeCell";
import {
  saveProjectDetails,
  saveProjectContext,
  saveAnalyzeTopics,
  timeoutPromise,
} from "../../utils";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function EndTaskDialog(props) {
  // props include open and handleClose

  const dispatch = useDispatch();

  const navigate = useNavigate();

  // get the projectDetails from the redux store
  const projectDetails = useSelector((state) => state.projectDetails);
  const projectContext = useSelector((state) => state.projectContext);
  const analyzeTopics = useSelector((state) => state.analyzeTopics);

  // code for the save button
  const [saving, setSaving] = useState(false);

  const lastSaved = useSelector((state) => state.userProjects.lastSaved);

  // state variable for minutes since last save
  const [secondsSinceLastSave, setSecondsSinceLastSave] = useState(null);

  // function to calculate the minutes since last save
  const findSecondsSinceLastSave = (lastSaved) => {
    if (lastSaved !== "") {
      const lastSavedTime = new Date(lastSaved);
      const currentTime = new Date();
      const diff = currentTime - lastSavedTime;
      // const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor(diff / 1000);
      setSecondsSinceLastSave(seconds);
    }
  };

  const handleSave = async () => {
    // console.log("Manually save data through end task dialog");
    setSaving(true);

    const timeStamp = new Date().toISOString();
    let projectDetailsStatus = "nan";
    let projectContextStatus = "nan";
    let analyzeTopicsStatus = "nan";

    // await on all the save functions
    await Promise.all([
      saveProjectDetails(projectDetails),
      saveProjectContext(projectContext),
      saveAnalyzeTopics(analyzeTopics, projectDetails.project_id),
    ]).then((results) => {
      projectDetailsStatus = results[0];
      projectContextStatus = results[1];
      analyzeTopicsStatus = results[2];
    });

    if (projectDetailsStatus === "success") {
      // reset cell history
      dispatch(resetCellHistory());
    }

    if (projectContextStatus === "success") {
      // reset edited to false
      dispatch(resetEdited());
    }

    if (analyzeTopicsStatus === "success") {
      // reset need_to_save
      dispatch(resetNeedToSave());
    }

    // set the last saved time
    if (
      projectDetailsStatus !== "error" &&
      projectContextStatus !== "error" &&
      analyzeTopicsStatus !== "error"
    ) {
      dispatch(setLastSaved(timeStamp));
    }
    setSaving(false);
  };

  // function called when back button clicked
  const handleBack = () => {
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: projectDetails.project_id,
        eventType: "closeEndTaskPage",
        eventDetail: {},
      })
    );
    props.handleClose();
  };

  // function called when save and exit button clicked
  const handleSaveAndExit = async () => {
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: projectDetails.project_id,
        eventType: "exitProject",
        eventDetail: {},
      })
    );
    await handleSave();
    props.handleClose();
    navigate(`/projects`);
  };

  // function to calculate the time estimate for a section
  const calculateSectionTimeEstimate = (sectionIndex) => {
    let timeEstimate = 0;
    Object.values(projectDetails.cells).forEach((cell) => {
      if (cell.section_index === sectionIndex) {
        timeEstimate += cell.time_estimate;
      }
    });
    // round to 1 decimal place
    timeEstimate = Math.round(timeEstimate * 10) / 10;
    return timeEstimate;
  };

  // CODE FOR COPY TO CLIPBOARD BUTTON
  const [copying, setCopying] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleCopyToClipboard = async () => {
    setCopying(true);

    // Build the formatted text
    let formattedText = `${projectDetails.project_title}\n\n`;

    projectDetails.sections.forEach((section, sectionIndex) => {
      const timeEstimate = calculateSectionTimeEstimate(section.id);
      const timeLabel = timeEstimate === 1 ? "minute" : "minutes";
      formattedText += `Section ${sectionIndex + 1}: ${section.title} (~${timeEstimate} ${timeLabel})\n\n`;

      section.cells.forEach((cellId, cellIndex) => {
        const cell = projectDetails.cells[cellId];
        const letter = String.fromCharCode(97 + cellIndex);
        formattedText += `  ${letter}. ${cell.cell_details.main_text}\n\n`;
        // Add Answer Options if question is close-ended and has response categories
        if (
          cell.cell_details.cell_type === "question" &&
          cell.cell_details.response_format === "closed" &&
          cell.cell_details.response_categories &&
          Array.isArray(cell.cell_details.response_categories) &&
          cell.cell_details.response_categories.length > 0
        ) {
          formattedText += `    Answer Options:\n`;
          cell.cell_details.response_categories.forEach((option) => {
            // Handle both {id, text} and {value, label} formats
            const optionText = option.text || option.label || "";
            if (optionText) {
              formattedText += `      - ${optionText}\n\n`;
            }
          });
        }
      });

      formattedText += "\n";
    });

    try {
      await navigator.clipboard.writeText(formattedText.trim());
      setSnackbarOpen(true);

      // Add event to user tracking
      dispatch(
        addEvent({
          projectId: projectDetails.project_id,
          eventType: "copyToClipboard",
          eventDetail: {},
        })
      );
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    } finally {
      setCopying(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // CODE FOR DOWNLOAD BUTTON
  const [downloading, setDownloading] = useState(false);

  // function to handle project download
  const handleDownload = async () => {
    setDownloading(true);

    // add event to user tracking
    dispatch(
      addEvent({
        projectId: projectDetails.project_id,
        eventType: "downloadProject",
        eventDetail: {},
      })
    );

    // Trigger download
    try {
      // Use fetch to call the API with timeout like other endpoints
      const response = await timeoutPromise(
        10000,
        fetch(`/api/export_project/${projectDetails.project_id}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get the filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${projectDetails.project_title.replace(
        /\s+/g,
        "_"
      )}_export.json`;

      if (contentDisposition && contentDisposition.includes("filename=")) {
        const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/["']/g, "");
        }
      }

      // Convert response to blob
      const blob = await response.blob();

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      console.log("Project downloaded successfully");
    } catch (error) {
      console.error("Error downloading project:", error);
    } finally {
      // Reset downloading state
      setDownloading(false);
    }
  };

  // CODE FOR HELP GUIDE DIALOG
  // state variable for help guide dialog
  const [openHelpGuide, setOpenHelpGuide] = useState(false);

  const handleOpenHelpGuide = () => {
    // add event to userTrackingSlice
    dispatch(
      addEvent({
        projectId: "user_level",
        eventType: "openHelpGuide",
        eventDetail: {
          app_bar_type: "endTask",
        },
      })
    );
    setOpenHelpGuide(true);
  };

  const handleCloseHelpGuide = () => {
    // add event to userTrackingSlice
    dispatch(
      addEvent({
        projectId: "user_level",
        eventType: "closeHelpGuide",
        eventDetail: {
          app_bar_type: "endTask",
        },
      })
    );
    setOpenHelpGuide(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        fullScreen
        open={props.open}
        onClose={handleBack}
        TransitionComponent={Transition}
      >
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <IconButton
              edge="start"
              onClick={handleBack}
              aria-label="close"
              variant="appBar"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              Back to Edit
            </Typography>
            {/* Add copy to clipboard button here */}
            <Tooltip title="Copy to Clipboard" placement="bottom">
              <span>
                <LoadingButton
                  onClick={handleCopyToClipboard}
                  loading={copying}
                  loadingPosition="start"
                  startIcon={<ContentCopyIcon />}
                  variant="appBarButton"
                  sx={{
                    mr: 1,
                    ":disabled": {
                      backgroundColor: "transparent",
                      color: "white",
                    },
                  }}
                >
                  <span>Copy</span>
                </LoadingButton>
              </span>
            </Tooltip>
            {/* Add download button here */}
            <Tooltip title="Download Project" placement="bottom">
              <span>
                <LoadingButton
                  onClick={handleDownload}
                  loading={downloading}
                  loadingPosition="start"
                  startIcon={<DownloadIcon />}
                  variant="appBarButton"
                  sx={{
                    mr: 1,
                    ":disabled": {
                      backgroundColor: "transparent",
                      color: "white",
                    },
                  }}
                >
                  <span>Download</span>
                </LoadingButton>
              </span>
            </Tooltip>
            {/* Add save button here */}
            <Tooltip
              title={
                secondsSinceLastSave !== null
                  ? `Last saved ${secondsSinceLastSave} seconds ago`
                  : "Data not saved yet"
              }
              placement="bottom"
            >
              <span>
                <LoadingButton
                  onClick={handleSaveAndExit}
                  loading={saving}
                  loadingPosition="start"
                  startIcon={<SaveIcon />}
                  variant="appBarButton"
                  // override the background color of the button when disabled
                  sx={{
                    ":disabled": {
                      backgroundColor: "transparent",
                      color: "white",
                    },
                  }}
                  onPointerEnter={() => findSecondsSinceLastSave(lastSaved)}
                >
                  <span>Save and Exit</span>
                </LoadingButton>
              </span>
            </Tooltip>
            <Tooltip title="Help Guide">
              <IconButton variant="appBar" onClick={handleOpenHelpGuide}>
                <HelpIcon fontSize="large" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Stack
          direction="column"
          justifyContent="flex-start"
          alignItems="center"
          spacing={5}
          style={{
            padding: 50,
          }}
        >
          <Typography variant="h4">{projectDetails.project_title}</Typography>
          {/* Iterate through each section and display the non editable section headers */}
          {projectDetails.sections.map((section, index) => {
            return (
              <Stack
                key={`section-${index}`}
                direction="column"
                spacing={3}
                alignItems={"center"}
                justifyContent={"flex-start"}
                sx={{ 
                  width: "80%", 
                }}
              >
                {/* Display section header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent={"flex-start"}
                  spacing={1}
                  sx={{ width: "100%" }}
                >
                  <Typography variant="h6" component="div" sx={{ m: 0 }}>
                    Section {index + 1}: {section.title} ( ~{" "}
                    {calculateSectionTimeEstimate(section.id)}{" "}
                    {calculateSectionTimeEstimate(section.id) === 1
                      ? "minute"
                      : "minutes"}
                    )
                  </Typography>
                </Stack>
                {/* Display the cells */}
                {section.cells.map((cell, index) => {
                  return (
                    <Stack
                      key={`cell-${cell}`}
                      direction="column"
                      sx={{ width: "100%" }}
                      justifyContent={"center"}
                      alignItems={"flex-start"}
                    >
                      <TentativeCell
                        type={"plain"}
                        cellInfo={projectDetails.cells[cell]}
                        letter={String.fromCharCode(97 + index)}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            );
          })}
        </Stack>
        <HelpGuideDialog
          open={openHelpGuide}
          handleClose={handleCloseHelpGuide}
          tab={"project_general"}
        />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={handleSnackbarClose}
          message="Copied to clipboard"
        />
      </Dialog>
    </ThemeProvider>
  );
}

export default EndTaskDialog;
