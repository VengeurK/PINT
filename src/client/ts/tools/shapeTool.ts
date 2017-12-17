import {Tool} from "./tool";
import {Vec2} from "../vec2";
import {InputType} from "../tool_settings/settingsRequester";
import {Project} from "../docState";
import {HistoryEntry} from "../history/historyEntry";
import {ActionInterface} from "./actionInterface";


function drawEllipse(ctx, x, y, w, h) {
    var kappa = .5522848,
        ox = (w / 2) * kappa, // control point offset horizontal
        oy = (h / 2) * kappa, // control point offset vertical
        xe = x + w,           // x-end
        ye = y + h,           // y-end
        xm = x + w / 2,       // x-middle
        ym = y + h / 2;       // y-middle

    ctx.beginPath();
    ctx.moveTo(x, ym);
    ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
    ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
    ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
    ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
    //ctx.closePath(); // not used correctly, see comments (use to close off open path)
    ctx.stroke();
}


/**
 * Draw a shape tool.
 */
export class ShapeTool extends Tool {
    constructor () {
        super("ShapeTool", "Shape");
        this.addSetting({name: "strokeColor", descName: "Stroke color", inputType: InputType.Color, defaultValue: "#ffffff"});
        this.addSetting({
            name: "strokeAlpha",
            descName: "Stroke transparency",
            inputType: InputType.Range,
            defaultValue: 100,
            options: [
                {name:"maxValue", desc: "100"},
                {name:"minValue", desc: "0"}
            ]});

        this.addSetting({name: "fillColor", descName: "Fill color", inputType: InputType.Color, defaultValue: "#000000"});
        this.addSetting({
            name: "fillAlpha",
            descName: "Fill transparency",
            inputType: InputType.Range,
            defaultValue: 100,
            options: [
                {name:"maxValue", desc: "100"},
                {name:"minValue", desc: "0"}
            ]});

        this.addSetting({name: "lineWidth", descName: "Line width", inputType: InputType.Number, defaultValue: "5"});
        this.addSetting({name: "shape", descName: "Shape", inputType: InputType.Select, defaultValue: "square",
                                options: [{name: "square", desc: "Square"},
                                        {name: "circle", desc: "Circle"},
                                        {name: "ellipse", desc: "Ellipse"}]});
    }

    startUse (img, pos) {
        this.data = {
            firstCorner: pos,
            lastCorner: pos,
        };
    };

    continueUse (pos) {
        this.data.lastCorner = pos;
    };

    reset () {}

    endUse (pos) {
        this.continueUse(pos);
    };

    drawPreview (ctx) {
        ctx.fillStyle = this.getSetting('fillColor');
        ctx.strokeStyle = this.getSetting('strokeColor');
        ctx.lineWidth = this.getSetting('lineWidth');

        let firstCorner = new Vec2(this.data.firstCorner.x, this.data.firstCorner.y);
        let lastCorner = new Vec2(this.data.lastCorner.x, this.data.lastCorner.y);

        switch (this.getSetting('shape')) {
            case "square":
                ctx.beginPath();
                const x = Math.min(firstCorner.x, lastCorner.x) + .5,
                    y = Math.min(firstCorner.y, lastCorner.y) + .5,
                    w = Math.abs(firstCorner.x - lastCorner.x),
                    h = Math.abs(firstCorner.y - lastCorner.y);
                ctx.rect(x,y,w,h);
                break;
            case "circle":
                ctx.beginPath();
                ctx.arc(firstCorner.x, firstCorner.y, firstCorner.distance(lastCorner), 0, 2 * Math.PI, false);
                break;
            case "ellipse":
                const xdep = firstCorner.x,
                    ydep = firstCorner.y,
                    xlen = lastCorner.x - firstCorner.x,
                    ylen = lastCorner.y - firstCorner.y;
                //ctx.beginPath();
                drawEllipse(ctx, xdep, ydep, xlen, ylen);
                break;
            default:
                console.error("No shape selected.");
                break;
        }
        ctx.globalAlpha = this.getSetting("fillAlpha")/100;
        ctx.fill();
        ctx.globalAlpha = this.getSetting("strokeAlpha")/100;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    applyTool (context: CanvasRenderingContext2D): HistoryEntry {
        this.drawPreview(context);
        return new HistoryEntry(()=>{},()=>{}, []);
    }
}
