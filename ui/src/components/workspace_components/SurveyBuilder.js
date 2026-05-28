import React, { useState, useEffect, useRef } from "react";

import CustomAppBar from "../common_components/CustomAppBar";
import SectionList from "./SectionList";
import QuestionList from "./QuestionList";

import IconButton from "@mui/material/IconButton";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";

import { ThemeProvider } from "@mui/material/styles";
import theme from "../common_components/theme";
import { useMediaQuery } from "@mui/material";

// redux stuff
import { useSelector, useDispatch } from "react-redux";
import { addEvent } from "../../store/userTrackingSlice";

const drawerWidth = 300;

// Set style for Main component
const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(
  ({ theme, open, topheight }) => ({
    flexGrow: 1,
    padding: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginTop: `${topheight}px`,
    marginLeft: `-${drawerWidth}px`,
    marginRight: 0,

    [theme.breakpoints.up('sm')]: {
      marginLeft: open ? 0 : `-${drawerWidth * 0.8}px`,
      marginRight: `${drawerWidth * 0.2}px`,
      ...(open && {
        transition: theme.transitions.create("margin", {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }),
    },

    [theme.breakpoints.up('lg')]: {
      marginLeft: open ? 0 : `-${drawerWidth * 0.5}px`,
      marginRight: `${drawerWidth * 0.5}px`,
      ...(open && {
        transition: theme.transitions.create("margin", {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }),
    },
  })
);

//   Set style for DrawerHeader component
const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));

function SurveyBuilder(props) {
  // contains the survey builder
  // contains the persistant drawer code. Reference: https://github.com/mit-ccc/facilimate/blob/main/facilitation-scaffolding-app/src/features/sections/PersistentDrawerLeft.js

  const dispatch = useDispatch();

  // get screen size (to close drawer for small screens)
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("lg"));
  
  // whether the drawer is open or not
  const [open, setOpen] = useState(true);

  // get the project_id from the store
  const project_id = useSelector((state) => state.projectDetails.project_id);

  const handleToggleDrawer = () => {
    // add event to userTrackingSlice
    if (open) {
      dispatch(
        addEvent({
          projectId: project_id,
          eventType: "collapseSectionDrawer",
          eventDetail: {},
        })
      );
    } else {
      dispatch(
        addEvent({
          projectId: project_id,
          eventType: "expandSectionDrawer",
          eventDetail: {},
        })
      );
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (isSmallScreen) {
      setOpen(false);
    }
  }, [isSmallScreen]);

  // get the sections from the store
  const sections = useSelector((state) => state.projectDetails.sections);

  // create the refs for the section navigation (table of contents)
  let sectionRefs = useRef([]);
  sectionRefs.current = sections
    .slice()
    .concat([0])
    .map((ref, index) => (sectionRefs.current[index] = React.createRef()));

  //   useEffect(() => {
  //     console.log(sectionRefs.current);
  // }, [sectionRefs.current]);

  // get the project title from the store
  const projectTitle = useSelector(
    (state) => state.projectDetails.project_title
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex", backgroundColor: theme.palette.background.secondary }}>
        <CssBaseline />
        <CustomAppBar
          appBarType={"surveyBuilder"}
          userCode={props.userCode}
          open={open}
          appBarRef={sectionRefs.current[sectionRefs.current.length - 1]}
          title={projectTitle}
          helpGuideTab={"project_ai"}
        />
        <SectionList open={open} sectionRefs={sectionRefs} />
        <IconButton
          onClick={handleToggleDrawer}
          sx={{
            position: "fixed",
            top: "5rem",
            left: ".7rem",
            zIndex: theme.zIndex.drawer + 2,
            backgroundColor: theme.palette.background.default,
            boxShadow: 1,
            transition: theme.transitions.create("left", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            "&:hover": {
              backgroundColor: theme.palette.grey[100],
            },
          }}
        >
          {open ? <ArrowBackIcon /> : <FormatListBulletedIcon />}
        </IconButton>
        <Main open={open} topheight={0}>
          <DrawerHeader />
          <QuestionList sectionRefs={sectionRefs} />
        </Main>
      </Box>
    </ThemeProvider>
  );
}

export default SurveyBuilder;
