import React, { useState, useEffect } from "react";
import { Stack } from "@mui/system";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import Input from "@mui/material/Input";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FaceRetouchingNaturalIcon from "@mui/icons-material/FaceRetouchingNatural";
import FaceIcon from "@mui/icons-material/Face";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";

import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";

// help components
import ResponseCategories from "../common_components/ResponseCategories";
import TopicCellToolBar from "./TopicCellToolBar";

// redux stuff
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import {
  editCell,
  deleteCell,
  editTimeEstimate,
} from "../../store/projectDetailsSlice";
import { deleteCellFromTopic } from "../../store/analyzeTopicsSlice";
import { addEvent } from "../../store/userTrackingSlice";

function TopicCell(props) {
  // question cells for analyze topics feature

  // props include the cell_id and handleDeleteCell

  const dispatch = useDispatch();

  // get the cell details from the store using the cell_id
  const cellInfo = useSelector(
    (state) => state.projectDetails.cells[props.cell_id]
  );

  // get the project id from the store
  const project_id = useSelector((state) => state.projectDetails.project_id);

  // // for testing only, print the cell_id
  // useEffect(() => {
  //   console.log("Cell ID", props.cell_id);
  // }, [props.cell_id]);

  // // for testing only, print the cell details when redux store changes
  // useEffect(() => {
  //   console.log(cellInfo);
  // }, [cellInfo]);

  // get the sections from the store
  const sections = useSelector((state) => state.projectDetails.sections);

  // state variable for section_index
  const [sectionIndex, setSectionIndex] = useState(0);

  useEffect(() => {
    if (cellInfo === undefined) {
      return;
    }
    setSectionIndex(cellInfo.section_index);
  }, [cellInfo]);

  // CODE FOR DELETION

  // function to delete a cell
  const handleDeleteCell = (cell_id) => {
    // console.log("Delete Cell", cell_id);
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: project_id,
        eventType: "deleteCellFromAnalyzeTopics",
        eventDetail: {
          deleted_cell_id: cell_id,
          deleted_cell: cellInfo,
        },
      })
    );
    // remove the cell from the topic
    dispatch(deleteCellFromTopic({ cell_id: cell_id }));
    // remove the cell from the store
    dispatch(deleteCell({ cell_id: cell_id, section_index: sectionIndex }));
  };

  // CODE FOR INPUT COMPONENTS

  // local state variable to determine if the cell is in edit mode
  const [editMode, setEditMode] = useState(false);

  // function to toggle edit mode
  const toggleEditMode = () => {
    // add event to user tracking
    if (!editMode) {
      dispatch(
        addEvent({
          projectId: project_id,
          eventType: "clickEditCellFromAnalyzeTopics",
          eventDetail: {
            edited_cell_id: props.cell_id,
            edited_cell: cellInfo,
          },
        })
      );
    } else {
      // check if the cell details have changed
      const is_changed =
        mainText !== cellInfo.cell_details.main_text ||
        description !== cellInfo.cell_details.description ||
        responseCategories !== cellInfo.cell_details.response_categories ||
        timeEstimate !== cellInfo.time_estimate;
      dispatch(
        addEvent({
          projectId: project_id,
          eventType: "saveEditedCellFromAnalyzeTopics",
          eventDetail: {
            cell_id: props.cell_id,
            previous_cell: cellInfo,
            new_cell: {
              ...cellInfo,
              cell_details: {
                ...cellInfo.cell_details,
                main_text: mainText,
                description: description,
                response_categories: responseCategories,
              },
              time_estimate: parseFloat(timeEstimate),
            },
            is_changed: is_changed,
          },
        })
      );
      if (is_changed) {
        handleEditGlobalCellInfo();
      }
    }
    // if in edit mode, save the changes
    setEditMode(!editMode);
  };

  // local state variable for the main text
  const [mainText, setMainText] = useState("");

  // function to update the main text (using local state)
  const handleEditLocalMainText = (e) => {
    setMainText(e.target.value);
  };

  // local state variable for time estimate
  const [timeEstimate, setTimeEstimate] = useState(0);

  // function to update the time estimate locally
  const handleEditLocalTimeEstimate = (e) => {
    setTimeEstimate(e.target.value);
  };

  // local state variable for the description text
  const [description, setDescription] = useState("");

  // function to update the description text (using local state)
  const handleEditLocalDescriptionText = (e) => {
    setDescription(e.target.value);
  };

  // local variable for the response categories
  const [responseCategories, setResponseCategories] = useState([]);

  const updateLocalResponseCategories = (newCategories) => {
    setResponseCategories(newCategories);
  };

  // useEffect to update local state variables when cellInfo changes
  useEffect(() => {
    if (cellInfo === undefined) {
      return;
    }
    setMainText(cellInfo.cell_details.main_text);
    setDescription(cellInfo.cell_details.description);
    setResponseCategories(cellInfo.cell_details.response_categories);
    setTimeEstimate(cellInfo.time_estimate);
  }, [cellInfo]);

  // function to update cellInfo in Redux store
  const handleEditGlobalCellInfo = () => {
    // console.log("Main Text", mainText);
    // console.log("Description", description);
    // console.log("Response Categories", responseCategories);
    // determine whether the main text changed
    let edit_main_text = false;
    if (mainText !== cellInfo.cell_details.main_text) {
      edit_main_text = true;
    }
    // find the new human_ai_status
    let newHumanAiStatus = "human";
    if (
      mainText !== cellInfo.cell_details.main_text ||
      description !== cellInfo.cell_details.description ||
      responseCategories !== cellInfo.cell_details.response_categories
    ) {
      if (
        cellInfo.human_ai_status === "ai" ||
        cellInfo.human_ai_status === "human_ai"
      ) {
        newHumanAiStatus = "human_ai";
      }
    } else {
      newHumanAiStatus = cellInfo.human_ai_status;
    }

    // update the cell in Redux
    dispatch(
      editCell({
        cell_id: props.cell_id,
        edit_main_text: edit_main_text,
        cellInfo: {
          ...cellInfo,
          cell_details: {
            ...cellInfo.cell_details,
            main_text: mainText,
            description: description,
            response_categories: responseCategories,
          },
          human_ai_status: newHumanAiStatus,
          checks_to_ignore: [],
        },
      })
    );
    // if the time estimate has changed, update the time estimate in Redux
    if (timeEstimate !== cellInfo.time_estimate) {
      dispatch(
        editTimeEstimate({
          cell_id: props.cell_id,
          time_estimate: parseFloat(timeEstimate),
        })
      );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          mt: 1,
          mb: 1.5,
          ml: 0.5,
        }}
      >
        <Stack
          direction="column"
          spacing={0}
          tabIndex={0}
          sx={{
            padding: 3,
            borderRadius: 3,
            transition: 'all 0.3s ease',
            border: '1px dashed #e0e0e0',
            '&:hover': { boxShadow: '4px 4px 10px rgba(0, 0, 0, 0.17)' },
            '&:focus': { boxShadow: '4px 4px 10px rgba(0, 0, 0, 0.17)' },
            '&:focus-within': { boxShadow: '4px 4px 10px rgba(0, 0, 0, 0.17)' },
            width: { xs: "95%", sm: "80%" },
          }}
        >
          {/* Create the header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ marginBottom: 3 }}
          >
            <Typography variant="h6">
              Section {sectionIndex + 1}: {sections[sectionIndex].title}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => {
                toggleEditMode();
              }}
            >
              {editMode ? "Save" : "Edit"}
            </Button>
          </Stack>
          {/* AI status and time estimate row */}
          {cellInfo !== undefined && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ marginBottom: 3 }}
            >
              <Tooltip
                title={
                  {
                    ai: "AI Generated",
                    human: "Human Created",
                    human_ai: "Human and AI",
                  }[cellInfo.human_ai_status]
                }
                placement="top"
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: cellInfo.human_ai_status === "ai" ? "transparent" : "primary.main",
                    border: cellInfo.human_ai_status === "ai" ? "1px dashed" : "none",
                    borderColor: "primary.main",
                    "& .MuiSvgIcon-root": {
                      fontSize: 18,
                      color: cellInfo.human_ai_status === "ai" ? "primary.main" : "white",
                    }
                  }}
                >
                  {
                    {
                      ai: <AutoAwesomeIcon/>,
                      human: <FaceIcon/>,
                      human_ai: <FaceRetouchingNaturalIcon/>,
                    }[cellInfo.human_ai_status]
                  }
                </Avatar>
              </Tooltip>
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <AccessTimeFilledIcon />
                </Avatar>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {editMode ? (
                    <Input
                      id={"cell-time-estimate-" + props.cell_id}
                      value={timeEstimate}
                      multiline={false}
                      type="number"
                      margin="dense"
                      sx={{
                        typography: "body1",
                        // have the width be as long as the number of digits in the time estimate
                        width: `${timeEstimate.toString().length + 3}ch`,
                      }}
                      onChange={handleEditLocalTimeEstimate}
                    />
                  ) : (
                    <Typography variant="body1" component="div">
                      {timeEstimate}
                    </Typography>
                  )}
                  <Typography variant="body">
                    {timeEstimate === 1 ? "min" : "mins"}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          )}
          {/* Add the question details */}
          <Stack direction="column" spacing={0}>
            {!editMode && cellInfo !== undefined && (
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
              >
                {cellInfo.cell_details.cell_type === "question" && (
                  <QuestionAnswerOutlinedIcon/>
                )}
                <Typography key="0" variant="body1" component="div">
                  {cellInfo.cell_details.main_text}
                </Typography>
              </Stack>
            )}
            {/* BUG = The input doesn't become the full width unless I have a Typography component
               before it that covers the full width.
               SOLUTION = I added a hidden Typography component to cover the full width */}
            {editMode && cellInfo !== undefined && (
              <>
                <Typography
                  variant="body1"
                  component="div"
                  sx={{
                    width: "100%",
                    visibility: "hidden",
                    height: 0,
                    overflow: "hidden",
                  }}
                >
                  This is some hidden text to address the width issue. This
                  feels really hacky, but it works, so I will do it. QED. This
                  is some hidden text to address the width issue. This feels
                  really hacky, but it works, so I will do it. QED. This is some
                  hidden text to address the width issue. This feels really
                  hacky, but it works, so I will do it. QED.
                </Typography>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                >
                  {cellInfo.cell_details.cell_type === "question" && (
                    <QuestionAnswerOutlinedIcon/>
                  )}
                  <Input
                    id={"cell-main-text-" + props.cell_id}
                    // defaultValue={cellInfo.cell_details.main_text}
                    value={mainText}
                    placeholder={
                      cellInfo.cell_details.cell_type === "question"
                        ? "Enter question here"
                        : "Enter text here"
                    }
                    fullWidth
                    multiline={true}
                    margin="dense"
                    sx={{ typography: "body1", fontSize: "16px" }}
                    onChange={handleEditLocalMainText}
                  />
                </Stack>
              </>
            )}
            {!editMode &&
              cellInfo !== undefined &&
              cellInfo.cell_details.cell_type === "question" &&
              cellInfo.cell_details.description !== "" && (
                <Typography
                  key="1"
                  variant="body2"
                  component="div"
                  sx={{ paddingTop: 3, marginLeft: 5 }}
                >
                  {cellInfo.cell_details.description}
                </Typography>
              )}
            {editMode && cellInfo !== undefined && cellInfo.cell_details.cell_type === "question" && (
              <Stack
                direction="column"
                spacing={0}
                sx={{paddingTop: 3, marginLeft: 5}}
              >
                <Typography variant="body2" fontWeight="bold">Facilitator Notes</Typography>
                <Input
                  id={"cell-description-" + props.cell_id}
                  // defaultValue={cellInfo.cell_details.description}
                  value={description}
                  placeholder="Input optional description here"
                  //fullWidth
                  multiline={true}
                  margin="dense"
                  sx={{ typography: "body2"}}
                  onChange={handleEditLocalDescriptionText}
                />
              </Stack>
            )}
            {cellInfo !== undefined &&
              cellInfo.cell_details.cell_type === "question" &&
              cellInfo.cell_details.response_format === "closed" && (
                <ResponseCategories
                  key="0"
                  editable={editMode}
                  responseCategories={responseCategories}
                  updateResponseCategories={updateLocalResponseCategories}
                />
              )}
          </Stack>
          {cellInfo !== undefined && (
            <>
              <Divider
                sx={{
                  marginTop: 4,
                  marginBottom:
                    cellInfo.cell_details.cell_type === "question" ? 3 : 1,
                  borderBottomWidth: "2px",
                }}
              />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="flex-end"
                spacing={2}
              >
                <TopicCellToolBar
                  cell_id={props.cell_id}
                  handleDeleteCell={handleDeleteCell}
                />
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}

export default TopicCell;
