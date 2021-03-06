import * as $ from "jquery";
import {Vec2} from "../vec2";
import {PixelSelectionHandler} from "../selection/selection";


/**
 * Interface for a virtual HTML Canvas element.
 */
export class Layer {
    canvasElement: JQuery<HTMLCanvasElement>;
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
    layerInfo: LayerInfo;
    editMenuOpened: boolean;

    constructor(dimensions: Vec2) {
        this.canvasElement = $("<canvas></canvas>") as JQuery<HTMLCanvasElement>;
        this.context = this.canvasElement[0].getContext('2d');

        this.canvasElement[0].width = dimensions.x;
        this.canvasElement[0].height = dimensions.y;
        this.width = dimensions.x;
        this.height = dimensions.y;

        this.layerInfo = new LayerInfo();
        this.editMenuOpened = false;
    }

    /**
     * Get HTML canvas element.
     * @returns {HTMLCanvasElement}
     */
    getHTMLElement(): HTMLCanvasElement {
        return this.canvasElement[0];
    };

    /**
     * Get canvas context.
     * @returns {CanvasRenderingContext2D}
     */
    getContext(): CanvasRenderingContext2D {
        return this.context;
    };

    /**
     * Reset layer to full transparency.
     */
    reset() {
        this.context.clearRect(0, 0, this.width, this.height);
    };

    /**
     * Fill layer to a white background.
     */
    fill() {
        this.context.fillStyle = "#ffffff";
        this.context.strokeStyle = "#ffffff";
        this.context.fillRect(0, 0, this.width, this.height);
    };

    /**
     * Get layer width.
     * @returns {number}
     */
    getWidth(): number {
        return this.width;
    }

    /**
     * Get layer height.
     * @returns {number}
     */
    getHeight(): number {
        return this.height;
    }

    /**
     * Create a new layer having the same content as this.
     * @returns {Layer}
     */
    clone(): Layer {
        let layer = new Layer(new Vec2(this.width, this.height));
        layer.getContext().drawImage(this.getHTMLElement(), 0, 0);
        return layer;
    }

    /**
     * Draw image from a Base64 encoded input into the layer.
     * @param {string} data Base64 encoded data.
     * @param {number} x First coordinate of destination.
     * @param {number} y Second coordinate of destination.
     * @returns {Promise<any>}
     */
    drawDataUrl(data: string, x: number, y: number): Promise<any> {
        return new Promise(resolve => {
            if (typeof process === 'object' && process + '' === '[object process]') {
                // is node
                const {Image} = require('canvas');

                let img = new Image();
                img.src = data;

                this.getContext().drawImage(img, x, y);
                resolve();
            }
            else {
                // not node
                let imgtag = document.createElement("img");
                console.log("load");

                imgtag.addEventListener("load", function () {
                    this.getContext().drawImage(imgtag, x, y);
                    console.log("loaded");
                    resolve();
                }.bind(this));
                imgtag.src = data;
            }
        });
    }

    /***
     * Apply selection mask to the layer, keeping what is selected.
     * @param {PixelSelectionHandler} selection
     */
    applyMask(selection: PixelSelectionHandler) {
        this.context.globalCompositeOperation = 'destination-in';
        this.context.drawImage(selection.getMask().getHTMLElement(), 0, 0);
        this.context.globalCompositeOperation = 'source-over';
    }

    /***
     * Apply inverse selection mask to the layer, removing what is selected.
     * @param {PixelSelectionHandler} selection
     */
    applyInvMask(selection: PixelSelectionHandler) {
        this.context.globalCompositeOperation = 'destination-out';
        this.context.drawImage(selection.getMask().getHTMLElement(), 0, 0);
        this.context.globalCompositeOperation = 'source-over';
    }

    mask(layer: Layer) {
        this.context.globalCompositeOperation = 'destination-in';
        this.context.drawImage(layer.getHTMLElement(), 0, 0);
        this.context.globalCompositeOperation = 'source-over';
    }

    drawSourceIn(layer: Layer) {
        this.context.globalCompositeOperation = 'source-in';
        this.context.drawImage(layer.getHTMLElement(), 0, 0);
        this.context.globalCompositeOperation = 'source-over';
    }

    isBlank() {
        let blank = ($("<canvas></canvas>") as JQuery<HTMLCanvasElement>)[0];
        blank.width = this.width;
        blank.height = this.height;
        return this.getHTMLElement().toDataURL() === blank.toDataURL();
    }
}

/**
 * A LayerInfo object sums-up the alterable properties of a Layer
 */
export class LayerInfo {
    public name: string;
    public blur: boolean;
    public shadow: boolean;
    public show: boolean;

    constructor() {
        this.name = "Layer";
        this.blur = false;
        this.shadow = false;
        this.show = true;
    }

    getFilter(): string {
        if (this.blur || this.shadow || !this.show) {
            let s = "";
            if (this.blur) {
                s += "blur(5px) ";
            }

            if (this.shadow) {
                s += "drop-shadow(5px 5px 5px #000000) ";
            }

            if (!this.show) {
                s += "opacity(0) ";
            }
            return s;
        } else {
            return "none";
        }
    }

    clone(): LayerInfo {
        let layerInfo = new LayerInfo();
        layerInfo.copyFrom(this);
        return layerInfo;
    }

    copyFrom(layerInfo: LayerInfo) {
        this.name = layerInfo.name;
        this.blur = layerInfo.blur;
        this.shadow = layerInfo.shadow;
        this.show = layerInfo.show;
    }

    data(): Object {
        return {
            name: this.name,
            blur: this.blur,
            shadow: this.shadow,
            show: this.show,
        };
    }
}
