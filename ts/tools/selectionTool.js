var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define(["require", "exports", "./tool", "../vec2", "../tool_settings/settingsRequester", "./actionInterface"], function (require, exports, tool_1, vec2_1, settingsRequester_1, actionInterface_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SelectionTool extends tool_1.Tool {
        constructor() {
            super("SelectionTool", "Selection", "s");
            this.overrideSelectionMask = true;
            this.addSetting({
                name: "shape", descName: "Shape", inputType: settingsRequester_1.InputType.Select, defaultValue: "square",
                options: [{ name: "square", desc: "Square" },
                    { name: "circle", desc: "Circle" }]
            });
            this.addSetting({ name: "project_selection", descName: "", inputType: settingsRequester_1.InputType.Special, defaultValue: 0 });
        }
        reset() {
        }
        startUse(img, pos) {
            this.data = {
                firstCorner: pos,
                lastCorner: pos,
                width: img.width,
                height: img.height,
            };
        }
        continueUse(pos) {
            this.data.lastCorner = pos;
        }
        endUse(pos) {
            this.continueUse(pos);
        }
        drawPreview(layer) {
            let context = layer.getContext();
            context.strokeStyle = '#000';
            context.lineWidth = 1;
            let firstCorner = new vec2_1.Vec2(this.data.firstCorner.x, this.data.firstCorner.y);
            let lastCorner = new vec2_1.Vec2(this.data.lastCorner.x, this.data.lastCorner.y);
            switch (this.getSetting("shape")) {
                case "square":
                    context.beginPath();
                    let x = Math.min(firstCorner.x, lastCorner.x), y = Math.min(firstCorner.y, lastCorner.y), w = Math.abs(firstCorner.x - lastCorner.x), h = Math.abs(firstCorner.y - lastCorner.y);
                    context.rect(x + 0.5, y + 0.5, w, h);
                    context.stroke();
                    break;
                case "circle":
                    context.beginPath();
                    let center = firstCorner;
                    let radius = center.distance(lastCorner);
                    context.arc(center.x, center.y, radius, 0, 2 * Math.PI, false);
                    context.stroke();
                    break;
                case "ellipse":
                    let xdep = lastCorner.x / 2 + firstCorner.x / 2, ydep = lastCorner.y / 2 + firstCorner.y / 2, xlen = Math.abs(lastCorner.x / 2 - firstCorner.x / 2), ylen = Math.abs(lastCorner.y / 2 - firstCorner.y / 2);
                    context.beginPath();
                    context.ellipse(xdep, ydep, xlen, ylen, 0, 0, 2 * Math.PI);
                    context.stroke();
                    break;
                default:
                    console.error("No shape selected.");
                    break;
            }
        }
        applyTool(layer, generate_undo) {
            return __awaiter(this, void 0, void 0, function* () {
                let width = this.data.width;
                let height = this.data.height;
                let firstCorner = new vec2_1.Vec2(this.data.firstCorner.x, this.data.firstCorner.y);
                let lastCorner = new vec2_1.Vec2(this.data.lastCorner.x, this.data.lastCorner.y);
                let selection = new Uint8ClampedArray(width * height);
                switch (this.getSetting("shape")) {
                    case "square":
                        for (let y = Math.min(firstCorner.y, lastCorner.y); y <= Math.max(firstCorner.y, lastCorner.y); y++) {
                            for (let x = Math.min(firstCorner.x, lastCorner.x); x <= Math.max(firstCorner.x, lastCorner.x); x++) {
                                if (x >= 0 && y >= 0 && x < width && y < height) {
                                    selection[x + y * width] = 0xFF;
                                }
                            }
                        }
                        break;
                    case "circle":
                        let radius = Math.ceil(firstCorner.distance(lastCorner));
                        for (let y = Math.floor(firstCorner.y - radius) - 2; y <= firstCorner.y + radius + 2; y++) {
                            for (let x = Math.floor(firstCorner.x - radius) - 2; x <= firstCorner.x + radius + 2; x++) {
                                if (x >= 0 && x < width && y >= 0 && y < height) {
                                    let d = Math.pow((x - firstCorner.x - .5), 2) + Math.pow((y - firstCorner.y - .5), 2);
                                    if (d <= Math.pow(radius, 2)) {
                                        selection[x + y * width] = 0xFF;
                                    }
                                    else if (d <= Math.pow((radius + 1), 2)) {
                                        selection[x + y * width] = Math.floor(0x100 * (radius + 1 - Math.sqrt(d)));
                                    }
                                }
                            }
                        }
                        break;
                    case "ellipse":
                        break;
                    case "arbitrary":
                        break;
                    default:
                        console.error("No shape selected.");
                        break;
                }
                let selection_buffer = null;
                if (generate_undo) {
                    selection_buffer = this.getSetting("project_selection").getValues().buffer.slice(0);
                }
                this.getSetting('project_selection').reset();
                this.getSetting('project_selection').addRegion(selection);
                this.getSetting('project_selection').updateBorder();
                if (generate_undo) {
                    return {
                        type: actionInterface_1.ActionType.ToolApply,
                        toolName: "AutoSelectTool",
                        actionData: selection_buffer,
                        toolSettings: {},
                    };
                }
                else {
                    return null;
                }
            });
        }
    }
    exports.SelectionTool = SelectionTool;
});
//# sourceMappingURL=selectionTool.js.map