import {PixelSelectionHandler} from "../selection/selection";
import {UIController} from "../ui/ui";

export interface Option {
    /**
     * Internal name.
     * */
    name: string;
    /**
     * Display name.
     * */
    desc: string;
}

/**
 * Describes a parameter type.
 */
export enum InputType {
    /**
     * A hidden variable that can be modified only by tools.
     */
    Hidden,
    /**
     * A sequence of characters
     */
    String,
    /**
     *
     */
    Special,
    /**
     * A hexademical string describing a color.
     */
    Color,
    /**
     * A positive integer.
     */
    Number,
    /**
     * An integer in a specified range.
     */
    Range,
    /**
     * A string in a list of strings.
     */
    Select,
}

/**
 * Tool parameter description.
 */
export interface SettingRequest {
    /**
     * Internal name of parameter.
     */
    name: string;
    /**
     * Displayed name of parameter.
     */
    descName: string;
    /**
     * Parameter type
     */
    inputType: InputType;
    /**
     * Default value of parameter.
     */
    defaultValue: any;
    /**
     * For Select type, describe every option.
     */
    options?: Array<Option>;
}

/**
 * A tool can request a set of parameters using this object.
 * When the tool is instantiated, the project can build up the UI elements
 * corresponding to the requested parameters.
 */
export class SettingsRequester {
    private requests: Array<SettingRequest> = [];
    private data: { [name: string]: (update: any) => any } = {};
    private cbson: boolean = true;

    /**
     * Does nothing as the requested parameters will be populated later on.
     */
    constructor() {
    }

    /**
     * Add a new parameter to the request set.
     *
     * @param {SettingRequest} req Object representing a tool parameter.
     */
    add(req: SettingRequest) {
        if (req.inputType == InputType.Special) {
            // Settings can be sent over network if it does not request user_interface.
            if (req.name === "user_interface") {
                this.cbson = false;
            }
        } else {
            this.setGetter(req.name, () => req.defaultValue);
        }

        this.requests.push(req);
    }

    /**
     * Updates a parameter to a getter that will give its value when ```get``` is called.
     * Can also specify a setter that can be used when ```set``` is called.
     * @param {string} name Parameter name.
     * @param {() => any} handle Getter, called on ```get```. Can have a parameter that is the value to set.
     */
    setGetter(name: string, handle: (update: any) => any) {
        this.data[name] = handle;
    }

    /***
     * A tool can call this function to get the current value of a parameter.
     * @param {string} name Parameter name.
     * @returns {any}
     */
    get(name: string) {
        if (this.data[name] === undefined) {
            console.log("Parameter '" + name + "' has not been requested.");
        } else {
            return this.data[name](null);
        }
    }

    /**
     * A tool can call this function to set the parameter to a new value.
     * @param {string} name Parameter to update.
     * @param value New value.
     */
    set(name: string, value: any) {
        if (this.data[name] === undefined) {
            console.log("Parameter '" + name + "' has not been requested.");
        } else {
            this.data[name](value);
        }
    }

    /**
     * Request list instance getter
     * @returns {Array<SettingRequest>}
     */
    getRequests() {
        return this.requests;
    }

    /**
     * Tell if the settings can be sent over network.
     * @returns {boolean}
     */
    canBeSentOverNetwork() {
        return this.cbson;
    }

    /**
     * Export parameters in a dictionary that can be sent over network.
     * @returns {{[p: string]: any}}
     */
    exportParameters(): { [name: string]: any } {
        let data = {};
        for (let req of this.requests) {
            if (req.inputType !== InputType.Special) {
                data[req.name] = this.data[req.name](null);
            }
        }

        return data;
    }

    /**
     * Import parameters from a dictionary that has been previously exported.
     * @param {{[p: string]: any}} settings Dictionary input
     * @param {PixelSelectionHandler} selectionHandler Selection to bind on request
     * @param {UIController} ui User interface to bind on request
     */
    importParameters(settings: { [p: string]: any }, selectionHandler: PixelSelectionHandler, ui: UIController) {
        for (let req of this.requests) {
            if (req.inputType !== InputType.Special) {
                this.data[req.name] = (function () {
                    return this
                }).bind(settings[req.name]);
            } else if (req.name == "project_selection") {
                this.data[req.name] = (function () {
                    return this
                }).bind(selectionHandler);
            } else if (req.name === "user_interface") {
                if (ui == null) {
                    console.warn("Requested UI on server side.");
                    return;
                }
                this.data[req.name] = (function () {
                    return this
                }).bind(ui);
            }
        }
    }
}
