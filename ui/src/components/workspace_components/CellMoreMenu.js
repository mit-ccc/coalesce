import React, { useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";

// helper components
import MoreMenu from "../common_components/MoreMenu";
import ConfirmationDialog from "../common_components/ConfirmationDialog";

// redux stuff
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { duplicateCell } from "../../store/projectDetailsSlice";
import { addEvent } from "../../store/userTrackingSlice";

import { v4 as uuidv4 } from "uuid";

function CellMoreMenu(props) {
    // props takes in cell_id and handleDeleteCell and setLoadingCell

    const dispatch = useDispatch();

    // get the cellInfo from redux store
    const cellInfo = useSelector(
      (state) => state.projectDetails.cells[props.cell_id]
    );

    // get the project_id from the store
    const project_id = useSelector((state) => state.projectDetails.project_id);

    
    // CODE FOR DELETE DIALOG
  
    // state variable for the dialog box
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  
    const handleOpenDeleteDialog = () => {
      setOpenDeleteDialog(true);
    };
  
    const handleCloseDeleteDialog = () => {
      setOpenDeleteDialog(false);
    };

  
  // CODE FOR DUPLICATE

  const handleDuplicate = () => {
    // console.log("Duplicate Cell");
    // get a new cell_id
    const newCellId = uuidv4();
    // duplicate the cell
    let newCell = {
      ...cellInfo,
    };
    // add event to user tracking
    dispatch(
      addEvent({
        projectId: project_id,
        eventType: "duplicateCell",
        eventDetail: {
          new_cell_id: newCellId,
          original_cell_id: props.cell_id,
          cell_details: cellInfo.cell_details,
        },
      })
    );
    // add the new cell to the store
    dispatch(
      duplicateCell({
        cell_id: newCellId,
        cell: newCell,
        original_cell_id: props.cell_id,
      })
    );
  };

  return (
    <ThemeProvider theme={theme}>
    <MoreMenu
            items={["Duplicate", "Delete"]}
            clickHandlers={[() => handleDuplicate(), handleOpenDeleteDialog]}
    />
    {/* Delete Dialog */}
    <ConfirmationDialog
        openDialog={openDeleteDialog}
        handleCloseDialog={handleCloseDeleteDialog}
        handleConfirm={() => {
        props.handleDeleteCell(props.cell_id);
        handleCloseDeleteDialog();
        }}
        dialogTitle="Confirm Cell Deletion"
        dialogContent={`The ${cellInfo.cell_details.cell_type} cell will be permanently deleted.`}
        confirmText="Delete Cell"
        cancelText="Cancel"
    />
    </ThemeProvider>
  );
}

export default CellMoreMenu;