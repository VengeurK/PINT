import * as $ from "jquery";

import {Project} from "../docState";
import {SettingsInterface} from "../tool_settings/settingsInterface";
import {Viewport} from "./viewport";
import {ToolRegistry} from "../tools/toolregistry";
import {Vec2} from "../vec2";
import {MenuController, MenuState, setup_menu} from "./menu";
import {highlight_layer, LayerMenuController, setup_layer_menu} from "./layermenu"
import {KeyboardManager} from "./keyboardManager";
import {Tool} from "../tools/tool";
import {ActionType} from "../tools/actionInterface";
import {Layer, LayerInfo} from "./layer";

import * as io from 'socket.io-client';
import {unwatchFile} from "fs";

/**
 * @file User interface handler
 * @description Catches HTML browser events (essentially mouse input) and acts as an intermediary
 * between the project manager and the on-canvas renderer.
 */

/**
 * @classdesc This class consists essentially in handling HTML events for the project manager and link
 * it with the on-canvas renderer.
 * @class UIController
 * @description Creates a new Project, a new Viewport and link both components for rendering.
 */
export class UIController {
    mouseMoving: boolean = false;
    lastPosition: Vec2 = null;
    project: Project = null;
    viewport: Viewport;
    settingsUI: SettingsInterface;
    layer_menu_controller: LayerMenuController;
    toolRegistry: ToolRegistry;
    menu_controller: MenuController;
    keyboard_manager: KeyboardManager;
    redraw: boolean;

    project_name: string;
    socket: SocketIOClient.Socket;

    private is_online: boolean;

    /**
     * Build the user interface and bind events.
     */
    constructor() {
        /*
         * VIEWPORT
         */
        let fallbackImage = document.createElement("img");
        this.viewport = new Viewport(<JQuery<HTMLCanvasElement>> $("#viewport"), fallbackImage);
        fallbackImage.addEventListener("load", function () {
            this.viewport.viewportDimensionsChanged();
        }.bind(this));
        fallbackImage.src = "assets/" + (1 + Math.floor(Math.random() * 10)) + ".png";

        /*
         * TOOLS AND SETTINGS
         */
        this.settingsUI = new SettingsInterface(<JQuery<HTMLElement>> $("#toolsettings_container"));
        this.toolRegistry = new ToolRegistry();

        /*
         * MENU
         */
        this.menu_controller = setup_menu(this, document.getElementById("top-nav"));

        this.project_name = "Untitled";
        this.redraw = true;
        this.is_online = false;


        /*
         * NETWORK INDICATOR
         */
        let indicator = $(".indicator");
        let on_failed = function () {
            console.log("Socket disconnected");
            this.is_online = false;
            if (this.menu_controller.displayedCategory !== MenuState.Working) {
                this.menu_controller.updateStatus(this.hasProjectOpen(), this.isOnline());
            }
            indicator.removeClass("green");
            indicator.removeClass("orange");
            indicator.addClass("red");
        }.bind(this);


        let on_connection_pending = function () {
            console.log("Socket connection pending");
            this.is_online = false;
            if (this.menu_controller.displayedCategory !== MenuState.Working) {
                this.menu_controller.updateStatus(this.hasProjectOpen(), this.isOnline());
            }
            indicator.removeClass("green");
            indicator.addClass("orange");
            indicator.removeClass("red");
        }.bind(this);

        let on_connected = function () {
            console.log("Socket connected with id " + this.socket.id);
            this.is_online = true;
            if (this.menu_controller.displayedCategory !== MenuState.Working) {
                this.menu_controller.updateStatus(this.hasProjectOpen(), this.isOnline());
            }

            indicator.addClass("green");
            indicator.removeClass("orange");
            indicator.removeClass("red");
        }.bind(this);

        /*
         * NETWORK EVENTS
         */
        if (io != undefined) {
            // On connect, allow load from server.
            this.socket = io.connect('//');
            this.socket.on("connect", on_connected);
            this.socket.on("reconnect", on_connected);
            this.socket.on("reconnecting", on_connection_pending);
            this.socket.on("reconnect_error", on_failed);
            this.socket.on("reconnect_failed", on_failed);
            this.socket.on("disconnect", on_failed);
            this.socket.on("connect_error", on_failed);
            this.socket.on("connect_timeout", on_failed);
            this.socket.on("error", on_failed);

            this.socket.on("joined", this.loadServerHostedCallback.bind(this));
        }

        /*
         * KEYBOARD SHORTCUTS
         */
        this.keyboard_manager = new KeyboardManager(this);
        this.keyboard_manager.registerBinding("Ctrl-a", function () {
            if (this.project != null) {
                this.project.applyAction({
                    type: ActionType.ToolApply,
                    toolName: "SelectionTool",
                    actionData: {
                        firstCorner: {x: 0, y: 0},
                        lastCorner: this.project.dimensions,
                        width: this.project.dimensions.x,
                        height: this.project.dimensions.y
                    },
                    toolSettings: {shape: "square"}
                }, this.project.currentSelection);
            }
        }.bind(this));

        /*
         * AUTOLOAD FROM URL
         */
        let url = new URL(window.location.href);
        let online = url.searchParams.get("online");
        let project_name = url.searchParams.get("project");

        if (online != null && project_name != null) {
            if (online == "true") {
                this.socket.emit('join', {"name": project_name, "dimensions": new Vec2(800, 600), "image_data": ""});
            } else {
                //TODO: Load from local storage.
            }
        }

        window.requestAnimationFrame(this.onStep.bind(this));
    }

    /**
     * Update project name according to input.
     * @param {string} new_title
     */
    filenameUpdate(new_title: string) {
        if (this.project != null) {
            this.project.name = new_title;
        }
        this.project_name = new_title;
    }

    /**
     * Request to join/create an online project.
     * @param {string} name Workspace name
     * @param {Vec2} dimensions Drawing dimension if the workspace doesn't exist.
     * @param {string} image_data Image to load.
     */
    loadServerHosted(name: string, dimensions: Vec2, image_data: string) {
        this.socket.emit('join', {"name": name, "dimensions": dimensions, "image_data": image_data});
    }

    /**
     * Setup local version of the project according to server data.
     * @param data
     */
    loadServerHostedCallback(data: { dimensions: Vec2, data: Array<string>, infos: Array<Object>, name: string, color: string }) {
        console.log("My name is "+data.name);
        this.newProject(data.dimensions);
        this.project.enableNetwork(this.socket);
        for (let i = 0; i < data.data.length; i++) {
            if (i != 0) {
                this.project.layerList.push(new Layer(data.dimensions));
            }
            this.project.layerList[i].layerInfo.copyFrom(<LayerInfo> data.infos[i]);
            let img = new Image;
            img.onload = function () {
                this.project.layerList[i].getContext().globalCompositeOperation = "copy";
                this.project.layerList[i].getContext().drawImage(img, 0, 0);
                this.project.layerList[i].getContext().globalCompositeOperation = "source-over";
                this.project.redraw = true;
            }.bind(this);
            img.src = data.data[i];
        }

        this.layer_menu_controller = setup_layer_menu(this, document.getElementById("layerManager_container"));
    }

    /**
     * Create a project by importing a picture file.
     * @returns {boolean}
     */
    newProjectFromFile() {
        let input = document.createElement("input");
        input.type = "file";
        input.accept = ".jpg, .jpeg, .png";
        input.setAttribute("style", "display:none");
        let self = this;

        input.addEventListener("change", function (event: any) {
            let selectedFile: File = event.target.files[0];
            let reader = new FileReader();
            let imgtag = document.createElement("img");
            reader.onload = function (event) {
                imgtag.src = reader.result;
                imgtag.addEventListener("load", function () {
                    if ($("#share_online_checkbox").is(":checked")) {
                        self.menu_controller.switchCategory(MenuState.Working);
                        self.redraw = true;

                        self.loadServerHosted(self.project_name, new Vec2(imgtag.width, imgtag.height), reader.result);
                    } else {
                        self.newProject(new Vec2(imgtag.width, imgtag.height));
                        self.project.currentLayer.getContext().drawImage(imgtag, 0, 0);
                    }
                });
            };
            reader.readAsDataURL(selectedFile);
        });

        document.body.appendChild(input);
        input.click();
        return false;
    }

    /**
     * Create a new project.
     * @param {Vec2} dimensions Project dimensions.
     */
    newProject(dimensions: Vec2) {
        this.menu_controller.switchCategory(MenuState.Working);
        this.redraw = true;

        this.project = new Project(this, this.project_name, dimensions);
        $("#toolbox-container").children().removeClass("hovered"); // Unselect tools.

        // display the layer menu:
        this.layer_menu_controller = setup_layer_menu(this, document.getElementById("layerManager_container"));
    }

    /**
     * Checks if there is an active project.
     * @returns {boolean}
     */
    hasProjectOpen(): boolean {
        return this.project !== null;
    }

    /**
     * Checks if there is a socket link between page and server.
     * @returns {boolean}
     */
    isOnline(): boolean {
        return this.is_online;
    }

    /**
     * Add a layer to the project at the end.
     */
    addLayer() {
        // add a layer to the current project:
        if (this.project != null) {
            this.project.addLayer();
        }
    }

    /**
     * Select a layer to the project (in ending position).
     * @param {number} i Index of the selected layer.
     */
    selectLayer(i: number) {
        // select layer i in current project:
        this.project.selectLayer(i);

        // update of layer menu display:
        highlight_layer(this, i);
    }

    /**
     * Delete layer of index i
     * @param {number} i Index of the layer to delete
     */
    deleteLayer(i: number) {
        // delete layer i of current project
        if (this.project != null) {
            this.project.deleteLayer(i);
        }
    }

    /**
     * Update project's tool if a project is open.
     * @param {Tool} tool
     */
    setTool(tool: Tool) {
        if (this.project != null) {
            this.project.changeTool(tool);
            this.settingsUI.setupToolSettings(tool, this.project);

            $("#toolbox-container").children().removeClass("hovered");
            let toolbox: Element = document.getElementById("toolbox-container");
            for (let i = 0; i < toolbox.children.length; i++) {
                let child = toolbox.children[i];
                if (child.getAttribute("data-tool") == tool.getName()) {
                    child.className += " hovered";
                }
            }

            UIController.displayName(tool.getDesc());
        }
    }

    /**
     * Event handler triggered when one of the toolbox buttons is clicked.
     * @param {Event} event Event object (see JQuery documentation).
     * @this UIController
     * @memberOf UIController
     */
    onToolboxClicked(event: Event) {

        let toolname = (<Element> event.target).getAttribute("data-tool");
        if (toolname !== null) {
            let tool = this.toolRegistry.getToolByName(toolname);
            if (tool !== null) {
                tool.icon = <HTMLElement> event.target;
                this.setTool(tool);
                (<Element> event.target).className += " hovered";
            } else {
                console.warn("No such tool " + toolname);
            }
        } else {
            let func = (<Element> event.target).getAttribute("data-function");
            if (func !== null) {
                let elem = event.target;
                eval(func);
            } else {
                console.warn("Unimplemented tool.");
            }
        }

        eval("$(\".button-collapse-left\").sideNav('hide');");

    };

    /**
     * Update what is displayed in the name container.
     * @param {string} name
     */
    static displayName(name: string) {
        $("#name_container").html(name);
    }

    /**
     * Triggered when one of the toolbox element is hovered.
     * @param {Event} event
     */
    onToolboxHovered(event: Event) {
        let toolname = (<Element> event.target).getAttribute("data-tool");
        if (toolname !== null) {
            let tool = this.toolRegistry.getToolByName(toolname);
            UIController.displayName(tool.getDesc());
        } else {
            let desc = (<Element> event.target).getAttribute("data-desc");
            UIController.displayName(desc);
        }
    }

    /**
     * Triggered when one of the toolbox element is not hovered annymore.
     * @param {Event} event
     */
    onToolboxHoverLeft(event: Event) {
        if (this.project == null) {
            UIController.displayName("");
            return;
        }

        let tool = this.project.getCurrentTool();
        if (tool != null) {
            UIController.displayName(tool.getDesc());
        } else {
            UIController.displayName("");
        }
    }

    /**
     * @function onMouseDown
     * @description Event handler triggered on mouse down.
     * @param event Event object (see JQuery documentation).
     * @this UIController
     * @memberOf UIController
     */
    onMouseDown(event: MouseEvent) {
        this.lastPosition = this.viewport.globalToLocalPosition(new Vec2(event.offsetX, event.offsetY));
        this.mouseMoving = true;

        if (this.project != null) {
            this.project.mouseClick(this.lastPosition.floor());
        }
    };

    /**
     * @function onMouseUp
     * @description Event handler triggered on mouse up.
     * @param event Event object (see JQuery documentation).
     * @this UIController
     */
    onMouseUp(event: MouseEvent) {
        this.lastPosition = this.viewport.globalToLocalPosition(new Vec2(event.offsetX, event.offsetY));
        this.mouseMoving = false;
        if (this.project != null) {
            this.project.mouseRelease(this.lastPosition.floor());
        }
    };

    /**
     * @function onMouseMove
     * @description Event handler triggered on mouse move.
     * @param event Event object (see JQuery documentation).
     * @memberOf UIController
     * @this UIController
     */
    onMouseMove(event: MouseEvent) {
        this.lastPosition = this.viewport.globalToLocalPosition(new Vec2(event.offsetX, event.offsetY));
        if (this.mouseMoving && this.project != null) {
            this.project.mouseMove(this.lastPosition.floor());
        }
        this.redraw = true;
    };

    /**
     * Event handler triggered on mouse scroll.
     * @param {WheelEvent} event
     */
    onMouseWheel(event: WheelEvent) {
        // offset from the center.
        let ofsX = this.viewport.viewportDimensions.x / 2 - event.offsetX;
        let ofsY = this.viewport.viewportDimensions.y / 2 - event.offsetY;

        let zoom_scale = 1;
        if (event.deltaMode == 1) {
            zoom_scale *= 17;
        }

        let oldScale = this.viewport.getScale();
        this.zoom(event.deltaY * zoom_scale);
        let newScale = this.viewport.getScale();

        let deltaX = -ofsX * (oldScale - newScale) / oldScale;
        let deltaY = -ofsY * (oldScale - newScale) / oldScale;
        this.translate(new Vec2(deltaX, deltaY));
    };

    /**
     * Multiply the scale by 1.001^value.
     * @param {number} value
     */
    zoom(value: number) {
        this.viewport.setScale(this.viewport.getScale() * Math.pow(1.001, value));
        this.redraw = true;
    }

    /**
     * Translate picture by the given translation.
     * @param {Vec2} translation Translation in layer scale.
     */
    translate(translation: Vec2) {
        let realTranslation = this.viewport.getTranslation().add(translation.divide(this.viewport.getScale(), true), true);
        this.viewport.setTranslation(realTranslation);
        this.redraw = true;
    }

    /**
     * @function onStep
     * @description Handles a paint step by transmitting the position of the mouse to the project handler, and then rendering the document.
     * @param timestamp Time when the event was triggered.
     * @this UIController
     * @memberOf UIController
     */
    onStep(timestamp: number) {
        if (this.project != null) { // if there is an open project
            if (this.project.renderSelection()) { // if something is selected (can be drawn)
                this.redraw = true;
            }

            if (this.project.redraw) {
                this.redraw = true;
            }
        }

        if (this.redraw) {
            if (this.project != null) {
                this.viewport.renderLayers(this.project.layerList, this.project.previewLayers.values(), this.project.layerList.indexOf(this.project.currentLayer), this.project.replaceLayer,[this.project.currentSelection]);
            } else {
                this.viewport.renderLayers([], null, 0, false,[]);
            }

        }
        this.redraw = false;
        window.requestAnimationFrame(this.onStep.bind(this));
    };

    /**
     * @function onWindowResize
     * @description Catches the resize event and transmits it to the on-canvas renderer.
     * @param newSize Vec2 containing the new size of the window.
     * @this UIController
     * @memberOf UIController
     */
    onWindowResize(newSize: Vec2) {
        let offset = $("#viewport").offset();
        $("#viewport").height(newSize.y - offset.top);
        this.viewport.viewportDimensionsChanged();
    };

    /**
     * Given the UI DOM elements as an input, bind events to the controller.
     * @TODO : add layer_container argument wherever bindEvents is called
     */
    bindEvents(/*layer_container, */toolbox_container, viewport, newproject_button, newproject_width, newproject_height) {
        toolbox_container.children().click(this.onToolboxClicked.bind(this));
        toolbox_container.children().hover(this.onToolboxHovered.bind(this),
            this.onToolboxHoverLeft.bind(this));
        viewport.mousedown(this.onMouseDown.bind(this));//this.onMouseDown.bind(this));
        viewport.mouseup(this.onMouseUp.bind(this));
        viewport.mousemove(this.onMouseMove.bind(this));
        viewport.mouseleave(this.onMouseUp.bind(this));
        document.getElementById("viewport").addEventListener('wheel', this.onMouseWheel.bind(this));

        document.getElementById("viewport").addEventListener('touchstart', onTouch);
        document.getElementById("viewport").addEventListener('touchmove', onTouch);
        document.getElementById("viewport").addEventListener('touchend', onTouch);
        document.getElementById("viewport").addEventListener('touchcancel', onTouch);
        document.getElementById("viewport").addEventListener('touchleave', onTouch);
        newproject_button.click(function () {
            this.newProject(new Vec2(<number> newproject_width.val(), <number> newproject_height.val()));
        }.bind(this));

        $(window).on('resize', (function (e) {
            this.onWindowResize(new Vec2($(window).width(), $(window).height()));
        }).bind(this));

        this.onWindowResize(new Vec2($(window).width(), $(window).height()));
        document.body.addEventListener('touchmove', function (event) {
            event.preventDefault();
        }, false);

        document.addEventListener("keyup", this.keyboard_manager.handleEvent.bind(this.keyboard_manager));
    }

}

/**
 * Touch event handler that converts it in a mouse event.
 * @param {TouchEvent} evt
 */
function onTouch(evt: TouchEvent) {
    evt.preventDefault();
    if (evt.touches.length > 1 || (evt.type == "touchend" && evt.touches.length > 0))
        return;

    let newEvt = document.createEvent("MouseEvents");
    let type = null;
    let touch = null;
    switch (evt.type) {
        case "touchstart":
            type = "mousedown";
            touch = evt.changedTouches[0];
            break;
        case "touchmove":
            type = "mousemove";
            touch = evt.changedTouches[0];
            break;
        case "touchend":
            type = "mouseup";
            touch = evt.changedTouches[0];
            break;
    }

    newEvt.initMouseEvent(type, true, true, document.defaultView, 0,
        touch.screenX, touch.screenY, touch.clientX, touch.clientY,
        evt.ctrlKey, evt.altKey, evt.shiftKey, evt.metaKey, 0, null);
    evt.target.dispatchEvent(newEvt);
}


