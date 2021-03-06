import {ShapeTool} from "./shapeTool";
import {AutoSelectTool} from "./autoselectTool";
import {FillTool} from "./fillTool";
import {FreehandTool} from "./freehandTool";
import {Tool} from "./tool";
import {SelectionTool} from "./selectionTool";
import {HandTool} from "./handTool";
import {LineTool} from "./lineTool";
import {GradientTool} from "./gradientTool";
import {CopyTool} from "./copyTool";
import {PasteTool} from "./pasteTool";
import {EyedropperTool} from "./eyedropperTool";
import {EraserTool} from "./eraserTool";

/**
 * Basically a hashmap interface.
 */
export class ToolRegistry {
    registry: { [name: string]: Tool } = {};

    constructor() {
        this.registerTool(new ShapeTool());
        this.registerTool(new AutoSelectTool());
        this.registerTool(new FillTool());
        this.registerTool(new FreehandTool());
        this.registerTool(new SelectionTool());
        this.registerTool(new HandTool());
        this.registerTool(new LineTool());
        this.registerTool(new GradientTool());
        this.registerTool(new CopyTool());
        this.registerTool(new PasteTool());
        this.registerTool(new EyedropperTool());
        this.registerTool(new EraserTool());
    }

    /**
     * Register a tool into the tool registry
     * @param{Tool} tool the tool to register
     */
    registerTool(tool: Tool) {
        this.registry[tool.getName()] = tool;
    }

    /**
     * Retrieve a tool in the registry
     * @throws{'No such tool'} if there is no such tool
     * @param{string} name the name of the tool
     * @return the found tool
     */
    getToolByName(name: string): Tool {
        if (this.registry[name] === undefined)
            throw "No such tool " + name;
        return this.registry[name];
    }

    /**
     * @returns {Array<Tool>} An array containing all tools
     */
    getTools(): Array<Tool> {
        let tools = [];
        for (let name in this.registry) {
            tools.push(this.registry[name]);
        }
        return tools;
    }
}
