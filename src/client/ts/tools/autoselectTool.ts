import {Tool} from "./tool";
import {Vec2} from "../vec2";
import {colorSelect} from "../image_utils/connexComponent";
import {InputType} from "../tool_settings/settingsRequester";
import {ActionInterface, ActionType} from "./actionInterface";
import {Layer} from "../ui/layer";

/**
 * 'Magic wand' automatic selection tool, selects the connex component of the picture containing the clicked position.
 */
export class AutoSelectTool extends Tool {
    readonly overrideSelectionMask: boolean = true;

    /**
     * Instantiates the Tool with AutoSelectTool name.
     */
    constructor() {
        super("AutoSelectTool", "Magic wand", "w");
        this.addSetting({name: "wand_threshold", descName: "Threshold", inputType: InputType.Number, defaultValue: 50});
        this.addSetting({name: "project_selection", descName: "", inputType: InputType.Special, defaultValue: 0});
    }

    reset() {
    }

    /**
     * On click, computes the connex component and update selection.
     * @param {ImageData} img Content of the drawing canvas.
     * @param {Vec2} pos Click position
     */
    startUse(img: ImageData, pos: Vec2) {
        this.data = colorSelect(img, new Vec2(Math.floor(pos.x), Math.floor(pos.y)), this.getSetting("wand_threshold")).buffer;
    }

    endUse(pos: Vec2) {
    };

    continueUse(pos: Vec2) {
    };

    drawPreview(layer: Layer) {
        let selection = this.getSetting("project_selection");
        selection.reset();
        selection.addRegion(new Uint8ClampedArray(this.data, 0));
        selection.updateBorder();
    }

    async applyTool(layer: Layer, generate_undo: boolean): Promise<ActionInterface> {
        // Save old selection.
        if (generate_undo) {
            let selection_buffer = this.getSetting("project_selection").getValues().buffer.slice(0);
            this.drawPreview(layer);
            return {
                type: ActionType.ToolApply,
                toolName: "AutoSelectTool",
                actionData: selection_buffer,
                toolSettings: {},
            };
        } else {
            this.drawPreview(layer);
            return null;
        }
    }
}
