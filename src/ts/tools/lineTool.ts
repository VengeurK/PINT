import {Tool} from "./tool";
import {Vec2} from "../vec2";
import {InputType} from "../tool_settings/settingsRequester";
import {Project} from "../docState";

/**
 * Draw a shape tool.
 */
export class LineTool extends Tool {
    firstCorner: Vec2;
    lastCorner: Vec2;
    project: Project;

    constructor () {
        super("LineTool", "Line");
        this.addSetting({name: "strokeColor", descName: "Stroke color", inputType: InputType.Color, defaultValue: "#000000"});
        this.addSetting({
            name: "strokeAlpha",
            descName: "Stroke transparency",
            inputType: InputType.Range,
            defaultValue: 100,
            options: [
                {name:"maxValue", desc: "100"},
                {name:"minValue", desc: "0"}
            ]});
        this.addSetting({name: "lineWidth", descName: "Line width", inputType: InputType.Number, defaultValue: "5"});
    }

    reset () {
        this.firstCorner = null;
        this.lastCorner = null;
    }

    startUse (img, pos, project) {
        this.firstCorner = pos;
        this.lastCorner = pos;
        this.project = project;
    };

    continueUse (pos) {
        this.lastCorner = pos;
    };

    endUse (pos) {
        this.continueUse(pos);
        return this.defaultHistoryEntry(this.project);
    };

    drawPreview (ctx) {
        if (this.firstCorner == null || this.lastCorner == null) {
            return;
        }


        ctx.globalAlpha = this.getSetting("strokeAlpha") / 100;
        ctx.strokeStyle = this.getSetting('strokeColor');
        ctx.lineWidth = this.getSetting('lineWidth');
        ctx.beginPath();
        ctx.moveTo(this.firstCorner.x, this.firstCorner.y);
        ctx.lineTo(this.lastCorner.x, this.lastCorner.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
}
