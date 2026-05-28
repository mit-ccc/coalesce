import React, { useState, useEffect, useRef } from "react";

import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import UpdateIcon from "@mui/icons-material/Update";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";

import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";

// redux stuff
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { editCell } from "../../store/projectDetailsSlice";
import { updateChecksForCell, dismissCheck } from "../../store/questionChecksSlice";
import { addEvent } from "../../store/userTrackingSlice";

// helper components
import SuggestionList from "../common_components/SuggestionList";
import { check_types_to_name } from "../../utils";
import { timeoutPromise } from "../../utils";
import { SUPPORT_EMAIL } from "../../config";

function CheckQuestionSection(props) {
  // content for check question feature
  // props includes the cell_id, open and handleClose

  const dispatch = useDispatch();

  // get the checks from the store
  const checks = useSelector((state) => state.questionChecks.checks);

  // NOTE: this gives an error
  // const localCellChecks = useSelector((state) =>
  //   props.cell_id in state.questionChecks.checks
  //     ? state.questionChecks.checks[props.cell_id]
  //     : {
  //         last_checked: "",
  //         cell_checks: [],
  //         check_suggestions: [],
  //       }
  // );

  // state variable for the checks for the cell
  const [localCellChecks, setLocalCellChecks] = useState({
    last_checked: "",
    cell_checks: [],
    check_suggestions: [],
  });

  // useEffect to update localCellChecks when checks changes
  useEffect(() => {
    if (props.cell_id in checks) {
      setLocalCellChecks(checks[props.cell_id]);
    } else {
      setLocalCellChecks({
        last_checked: "",
        cell_checks: [],
        check_suggestions: [],
      });
    }
  }, [checks]);

  // // for testing only, print localCellChecks
  // useEffect(() => {
  //   console.log(localCellChecks);
  // }, [localCellChecks]);

  // get the cell details from the store using the cell_id
  const cellInfo = useSelector(
    (state) => state.projectDetails.cells[props.cell_id]
  );

  // get the project_id from the store
  const project_id = useSelector((state) => state.projectDetails.project_id);

  // CODE FOR ERROR DIALOG

  // state variable to determine if there is an error
  const [serverError, setServerError] = useState(false);

  // CODE FOR GETTING CHECKS

  const [loadingChecks, setLoadingChecks] = useState(false);

  // state variable for seconds passed while loading
  const [secondsPassed, setSecondsPassed] = useState(0);

  const timerInterval = useRef();

  // // for testing only, print secondsPassed
  // useEffect(() => {
  //   console.log("Seconds passed: ", secondsPassed);
  // }, [secondsPassed]);

  // function to start or stop timer based on loadingChecks
  useEffect(() => {
    if (loadingChecks) {
      // console.log("Start check question timer");
      timerInterval.current = setInterval(() => {
        setSecondsPassed((prevSeconds) => prevSeconds + 1);
      }, 1000);
    } else {
      // console.log("Stop check question timer");
      clearInterval(timerInterval.current);
      timerInterval.current = null;
      setSecondsPassed(0);
    }
    return () => clearInterval(timerInterval.current);
  }, [loadingChecks]);

  // function that gets the checks from the back-end
  const getChecks = () => {
    console.log("Get checks from back-end");
    let data = {
      project_id: project_id,
      cell_id: props.cell_id,
      cell_details: cellInfo.cell_details,
      checks_to_ignore:
        "checks_to_ignore" in cellInfo ? cellInfo.checks_to_ignore : [],
    };
    timeoutPromise(
      58000,
      fetch("/api/check_question", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
        // update the general_options in the Redux store
        const timestamp = new Date().toISOString();
        dispatch(
          updateChecksForCell({
            cell_id: props.cell_id,
            last_checked: timestamp,
            cell_checks: data["cell_checks"],
            check_suggestions: data["check_suggestions"],
          })
        );
        // set loadingChecks to false
        setLoadingChecks(false);
      })
      .catch((_error) => {
        console.error("Error getting checks");
        setLoadingChecks(false);
        setServerError(true);
      });
  };

  // useEffect that calls getChecks when the section is open and when the cell_id changes
  useEffect(() => {
    if (props.open) {
      if (props.cell_id in checks) {
        // check if last_checked is before the last_updated field in cellInfo
        if (checks[props.cell_id]["last_checked"] < cellInfo["last_updated"]) {
          // set loadingChecks to true
          setLoadingChecks(true);
          // get checks from the back-end
          getChecks();
        }
      } else {
        // set loadingChecks to true
        setLoadingChecks(true);
        // get checks from the back-end
        getChecks();
      }
    }
    return () => {
      // console.log("Cleanup CheckQuestionSection");
    };
  }, [props.open]);

  // function to re-run check question
  const runCheckQuestion = () => {
    console.log("Re-run check question");
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: project_id,
        eventType: "reRunCheckQuestion",
        eventDetail: {
          cell_id: props.cell_id,
          cell: cellInfo,
        },
      })
    );
    // set loadingChecks to true
    setLoadingChecks(true);
    // set error to false
    setServerError(false);
    // get checks from the back-end
    getChecks();
  };

  // CODE FOR DISMISSING ISSUES
  const handleDismissIssue = (checkType) => {
    console.log("Dismiss check:", checkType);
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: project_id,
        eventType: "dismissCheck",
        eventDetail: {
          cell_id: props.cell_id,
          check_type: checkType,
        },
      })
    );
    // dispatch to questionChecksSlice
    dispatch(
      dismissCheck({
        cell_id: props.cell_id,
        check_type: checkType,
      })
    );
  };

  // CODE FOR UPDATE BUTTON

  // state variable to determine whether the update button should appear
  const [showUpdateButton, setShowUpdateButton] = useState(false);

  // useEffect to determine whether the update button should appear
  // if checks[props.cell_id]["last_checked"] < cellInfo["last_updated"]
  useEffect(() => {
    if (localCellChecks["last_checked"] !== "") {
      if (localCellChecks["last_checked"] < cellInfo["last_updated"]) {
        setShowUpdateButton(true);
      } else {
        setShowUpdateButton(false);
      }
    }
  }, [cellInfo["last_updated"], localCellChecks["last_checked"]]);

  // CODE FOR CHOOSING A TENTATIVE CELL

  const handleChooseCell = (newCellInfo, suggestion_index) => {
    console.log("Choose Cell");
    // find the new human_ai_status
    let newHumanAiStatus = "ai";
    if (
      cellInfo.human_ai_status === "human" ||
      cellInfo.human_ai_status === "human_ai"
    ) {
      newHumanAiStatus = "human_ai";
    }
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: project_id,
        eventType: "chooseRewordingFromCheckQuestion",
        eventDetail: {
          cell_id: props.cell_id,
          previous_cell: cellInfo,
          new_cell: newCellInfo,
        },
      })
    );
    // update the cell_details in the Redux store
    dispatch(
      editCell({
        cell_id: props.cell_id,
        edit_main_text: true,
        cellInfo: {
          ...cellInfo,
          cell_details: newCellInfo.cell_details,
          human_ai_status: newHumanAiStatus,
          time_estimate: newCellInfo.time_estimate,
          checks_to_ignore:
            localCellChecks["check_suggestions"][Number(suggestion_index)][
              "fixed_checks"
            ],
        },
      })
    );
    props.handleClose();
  };

  return (
    <ThemeProvider theme={theme}>
      {loadingChecks === true && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          key={`loading_checks_${props.cell_id}`}
          spacing={2}
          sx={{
            mt: 1,
          }}
        >
          <CircularProgress />
          {secondsPassed <= 15 && (
            <Typography variant="body1">
              Estimated time remaining: {15 - secondsPassed} seconds
            </Typography>
          )}
          {secondsPassed > 15 && (
            <>
              <Typography variant="body1" align="center">
                Total time elapsed: {secondsPassed} seconds
              </Typography>
              <Typography
                variant="body1"
                color="error"
                align="center"
                sx={{ width: "60%" }}
              >
                Checking the question is taking longer than expected. Waiting
                for at most 60 seconds.
              </Typography>
            </>
          )}
        </Stack>
      )}
      {loadingChecks === false && serverError === true && (
        <Stack
          direction="column"
          alignItems="flex-start"
          justifyContent="center"
          key={`error_loading_checks_${props.cell_id}`}
          spacing={2}
          sx={{
            mt: 1,
          }}
        >
          <Typography variant="body1" color="error">
            An error occurred while checking the question for issues in
            readability, bias, and specificity. Please try again. If the problem
            persists, please contact support at ${SUPPORT_EMAIL}.
          </Typography>
          <Button
            variant="contained"
            onClick={runCheckQuestion}
            size="small"
            startIcon={<UpdateIcon />}
          >
            Re-run check for issues
          </Button>
        </Stack>
      )}
      {localCellChecks["last_checked"] !== "" &&
      loadingChecks === false &&
      serverError === false ? (
        <Stack
          direction="column"
          spacing={0}
          key={`show_checks_${props.cell_id}`}
          sx={{
            mt: 1,
          }}
        >
          <Stack
            direction="row"
            alignItems={"center"}
            justifyContent={"center"}
            key={`check_question_buttons_${props.cell_id}`}
          >
            {showUpdateButton && (
              <Button
                variant="contained"
                onClick={runCheckQuestion}
                size="small"
                startIcon={<UpdateIcon />}
              >
                Re-run check for issues
              </Button>
            )}
          </Stack>
          {/* Display all check types as a list */}
          <Box sx={{ width: "100%" }} key={`multiple_checks_${props.cell_id}`}>
            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
            {Object.keys(check_types_to_name).map((check_type, index) => {
              // Check if this check type is dismissed
              const dismissedChecks = localCellChecks["dismissed_checks"] || [];
              const isDismissed = dismissedChecks.includes(check_type);
            
              const hasIssues =
                localCellChecks["cell_checks"].filter(
                  (check) => check["check_type"] === check_type
                ).length > 0;
              const rationale = hasIssues
                ? localCellChecks["cell_checks"].filter(
                    (check) => check["check_type"] === check_type
                  )[0]["rationale"]
                : `No ${check_types_to_name[
                    check_type
                  ].toLowerCase()} issues were detected.`;

              return (
                <Stack
                  key={`check_item_${props.cell_id}_${index}`}
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Badge
                      variant="dot"
                      color="warning"
                      invisible={!hasIssues || isDismissed}
                      sx={{
                        "& .MuiBadge-badge": {
                          top: 8,
                          right: -4,
                        },
                      }}
                    >
                    </Badge>
                    <Typography variant="body" color={isDismissed ? "rgb(153, 153, 153)" : "text.primary"} paddingLeft={1}>{rationale}</Typography>
                  </Stack>
                  {hasIssues && !isDismissed && (
                    <Tooltip title="Dismiss this issue">
                      <IconButton
                        size="small"
                        onClick={() => handleDismissIssue(check_type)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              );
            })}
            </Stack>
          </Box>
          {localCellChecks["check_suggestions"].length > 0 && (
            <SuggestionList
              suggestions={localCellChecks["check_suggestions"]}
              suggestion_type={"check_question"}
              accordian_id={props.cell_id}
              handleChooseCell={handleChooseCell}
            />
          )}
        </Stack>
      ) : undefined}
    </ThemeProvider>
  );
}

export default CheckQuestionSection;
