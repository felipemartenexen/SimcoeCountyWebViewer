// REACT
import React, { Component } from "react";
import ReactDOM from "react-dom";
import ReactTooltip from "react-tooltip";
import Select from "react-select";
import "rc-slider/assets/index.css";
import Switch from "react-switch";
import { isMobile } from "react-device-detect";

// CUSTOM
import "./TOC.css";
import * as helpers from "../../../helpers/helpers";
import * as TOCHelpers from "../common/TOCHelpers.jsx";
import TOCConfig from "../common/TOCConfig.json";
import Layers from "./Layers.jsx";
import FloatingMenu, { FloatingMenuItem } from "../../../helpers/FloatingMenu.jsx";
import { Item as MenuItem } from "rc-menu";
import Portal from "../../../helpers/Portal.jsx";

class TOC extends Component {
  constructor(props) {
    super(props);
    this.storageMapDefaultsKey = "Map Defaults";
    this.state = {
      layerGroups: [],
      selectedGroup: {},
      isLoading: false,
      searchText: "",
      sortAlpha: this.getInitialSort(),
      defaultGroup: undefined,
      layerCount: 0,
    };

    // LISTEN FOR MAP TO MOUNT
    window.emitter.addListener("mapLoaded", () => this.onMapLoad());

    // LISTEN FOR MAP LEGEND
    window.emitter.addListener("openLegend", () => this.openLegend());

    // LISTEN FOR LAYERS TO LOAD
    window.emitter.addListener("layersLoaded", (numLayers) => this.onLayersLoad(numLayers));

    // LISTEN FOR SEARCH RESULT
    window.emitter.addListener("activeTocLayerGroup", (groupName, callback) => this.onActivateLayer(groupName, callback));
  }

  onMapLoad = () => {
    this.refreshTOC(false);
  };
  onActivateLayer = (groupName, callback) => {
    //const remove_underscore = name => {return helpers.replaceAllInString(name, "_", " ");}
    window.emitter.emit("setSidebarVisiblity", "OPEN");
    window.emitter.emit("activateTab", "layers");

    this.state.layerGroups.forEach((layerGroup) => {
      if (layerGroup.value === groupName) {
        this.setState({ selectedGroup: layerGroup }, () => callback());
        return;
      }
    });
  };

  onLayersLoad = (numLayers) => {
    if (this.state.layerCount !== numLayers) this.setState({ layerCount: numLayers });
  };

  getInitialSort = () => {
    if (isMobile) return true;
    else return false;
  };

  refreshTOC = (isReset, callback) => {
    sessionStorage.removeItem(this.storageMapDefaultsKey);
    let geoserverUrl = helpers.getURLParameter("GEO_URL");
    let geoserverUrlType = helpers.getURLParameter("GEO_TYPE");
    if (geoserverUrl === null) {
      geoserverUrl = TOCConfig.geoserverLayerGroupsUrl;
    } else {
      geoserverUrl = geoserverUrl + "/ows?service=wms&version=1.3.0&request=GetCapabilities";
    }
    if (geoserverUrlType === null) geoserverUrlType = TOCConfig.geoserverLayerGroupsUrlType;
    if (geoserverUrl !== undefined && geoserverUrl !== null) {
      TOCHelpers.getGroupsGC(geoserverUrl, geoserverUrlType, isReset, (result) => {
        const groupInfo = result;
        this.setState(
          {
            layerGroups: groupInfo[0],
            selectedGroup: groupInfo[1],
            defaultGroup: groupInfo[1],
          },
          () => {
            window.emitter.emit("tocLoaded");  
            if (callback !== undefined) callback();
          }
        );
      });
    } else {
      const groupInfo = TOCHelpers.getGroups();
      this.setState(
        {
          layerGroups: groupInfo[0],
          selectedGroup: groupInfo[1],
          defaultGroup: groupInfo[1],
        },
        () => {
          window.emitter.emit("tocLoaded");  
          if (callback !== undefined) callback();
        }
      );
    }
  };

  onGroupDropDownChange = (selectedGroup) => {
    this.setState({ selectedGroup: selectedGroup }, () => {
      const iFrame = document.getElementById("sc-url-window-iframe");
      const urlWindow = document.getElementById("sc-url-window-container");
      if (iFrame !== null && urlWindow !== null) {
        const classes = urlWindow.className;
        if (classes.indexOf("sc-hidden") === -1) {
          const legend = document.getElementById("sc-url-window-iframe").contentWindow.document.getElementById("sc-legend-app-main-container");
          if (legend !== null) this.openLegend();
        }
      }
    });
    helpers.addAppStat("TOC Group", selectedGroup.label);
  };

  onSearchLayersChange = (evt) => {
    const searchText = evt.target.value;
    this.setState({ searchText: searchText });
  };

  onSortSwitchChange = (sortAlpha) => {
    this.setState({ sortAlpha: sortAlpha });

    if (sortAlpha) {
      helpers.showMessage("Sorting", "Layer re-ordering disabled.", helpers.messageColors.yellow);
    }

    helpers.addAppStat("TOC Sort", "click");
  };

  reset = () => {
    const defaultGroup = this.state.defaultGroup;
    this.setState({ sortAlpha: false, selectedGroup: defaultGroup, searchText: "" }, () => {
      this.refreshTOC(true, () => {
        setTimeout(() => {
          this.layerRef.resetLayers();
        }, 100);
      });
    });

    helpers.addAppStat("TOC Reset", "Button");
  };

  onToolsClick = (evt) => {
    var evtClone = Object.assign({}, evt);
    const menu = (
      <Portal>
        <FloatingMenu key={helpers.getUID()} buttonEvent={evtClone} item={this.props.info} onMenuItemClick={(action) => this.onMenuItemClick(action)} styleMode="right" yOffset={90}>
          <MenuItem className="sc-floating-menu-toolbox-menu-item" key="sc-floating-menu-expand">
            <FloatingMenuItem imageName={"plus16.png"} label="Expand Layers" />
          </MenuItem>
          <MenuItem className="sc-floating-menu-toolbox-menu-item" key="sc-floating-menu-collapse">
            <FloatingMenuItem imageName={"minus16.png"} label="Collapse Layers" />
          </MenuItem>
          <MenuItem className="sc-floating-menu-toolbox-menu-item" key="sc-floating-menu-visility">
            <FloatingMenuItem imageName={"layers-off.png"} label="Turn off Layers" />
          </MenuItem>
          <MenuItem className="sc-floating-menu-toolbox-menu-item" key="sc-floating-menu-legend">
            <FloatingMenuItem imageName={"legend16.png"} label="Show Legend" />
          </MenuItem>
        </FloatingMenu>
      </Portal>
    );

    ReactDOM.render(menu, document.getElementById("portal-root"));
  };

  onMenuItemClick = (action) => {
    switch (action){
      case "sc-floating-menu-expand":
        this.layerRef.toggleAllLegends("OPEN");
        break;
      case "sc-floating-menu-collapse":
        this.layerRef.toggleAllLegends("CLOSE");
        break;
      case "sc-floating-menu-legend":
        this.openLegend();
        break;
      case "sc-floating-menu-visility":
        this.layerRef.turnOffLayers();
        break;
      default:
        break;
    }
    

    helpers.addAppStat("TOC Tools", action);
  };

  openLegend = () => {
    console.log(this.state.layerGroups);
    let params = "";
    this.state.layerGroups.forEach((group) => {
      let name = "";
      if (group.value.indexOf(":") !== -1) {
        name = group.value.split(":")[1];
      } else name = group.value;

      if (params === "") {
        if (this.state.selectedGroup.value === group.value) params += "?" + name + "=1";
        else params += "?" + name + "=0";
      } else {
        if (this.state.selectedGroup.value === group.value) params += "&" + name + "=1";
        else params += "&" + name + "=0";
      }
    });

    helpers.showURLWindow("https://opengis.simcoe.ca/legend/" + params, false, "normal", true, true);
  };

  onSaveClick = () => {
    this.layerRef.saveLayerOptions();
    helpers.addAppStat("TOC Save", "Click");
  };

  render() {
    const groupsDropDownStyles = {
      control: (provided) => ({
        ...provided,
        minHeight: "30px",
      }),
      indicatorsContainer: (provided) => ({
        ...provided,
        height: "30px",
      }),
      clearIndicator: (provided) => ({
        ...provided,
        padding: "5px",
      }),
      dropdownIndicator: (provided) => ({
        ...provided,
        padding: "5px",
      }),
    };

    return (
      <div>
        <div className={this.state.isLoading ? "sc-toc-main-container-loading" : "sc-toc-main-container-loading sc-hidden"}>
          <img className="sc-toc-loading" src={images["loading.gif"]} alt="loading" />
        </div>
        <div className={this.state.isLoading ? "sc-toc-main-container sc-hidden" : "sc-toc-main-container"}>
          <div className="sc-toc-search-container">
            <input
              id="sc-toc-search-textbox"
              className="sc-toc-search-textbox"
              placeholder={"Filter (" + this.state.layerCount + " layers)..."}
              onChange={this.onSearchLayersChange}
              value={this.state.searchText}
              onFocus={evt => {helpers.disableKeyboardEvents(true);}}
              onBlur={evt => {helpers.disableKeyboardEvents(false);}}
            />
            <div data-tip="Save Layer Visibility" data-for="sc-toc-save-tooltip" className="sc-toc-search-save-image" onClick={this.onSaveClick}>
              <ReactTooltip id="sc-toc-save-tooltip" className="sc-toc-save-tooltip" multiline={false} place="right" type="dark" effect="solid" />
            </div>
          </div>
          <div className="sc-toc-groups-container">
            <div id="sc-toc-groups-dropdown" title="Click here for more layers">
              <Select
                styles={groupsDropDownStyles}
                isSearchable={false}
                onChange={this.onGroupDropDownChange}
                options={this.state.layerGroups}
                value={this.state.selectedGroup}
                placeholder="Click Here for more Layers..."
              />
            </div>
          </div>
          <div>
            <Layers
              ref={(ref) => {
                this.layerRef = ref;
              }}
              group={this.state.selectedGroup}
              searchText={this.state.searchText}
              sortAlpha={this.state.sortAlpha}
              allGroups={this.state.layerGroups}
            />
          </div>

          <div className="sc-toc-footer-container">
            <label className={this.state.sortAlpha ? "sc-toc-sort-switch-label on" : "sc-toc-sort-switch-label"}>
              Sort A-Z
              <Switch className="sc-toc-sort-switch" onChange={this.onSortSwitchChange} checked={this.state.sortAlpha} height={20} width={48} />
            </label>
            &nbsp;
            <button className="sc-button sc-toc-footer-button" onClick={this.reset}>
              Reset
            </button>
            &nbsp;
            <button className="sc-button sc-toc-footer-button tools" onClick={this.onToolsClick}>
              Additional Tools
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default TOC;

// IMPORT ALL IMAGES
const images = importAllImages(require.context("./images", false, /\.(png|jpe?g|svg|gif)$/));
function importAllImages(r) {
  let images = {};
  r.keys().map((item, index) => (images[item.replace("./", "")] = r(item)));
  return images;
}
