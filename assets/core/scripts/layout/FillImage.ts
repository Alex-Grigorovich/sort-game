import { _decorator, CCBoolean, Size, UITransform } from 'cc';
import { DynamicUI } from './DynamicUI';
const { ccclass } = _decorator;
import { property } from '../playableCore/property';
@ccclass('FillImage')
export class FillImage extends DynamicUI {

    @property(CCBoolean)
    private _scale: boolean = false;

    start() {
        this.onResize();
    }



    public override onResize(s: Size = new Size()) {
        super.onResize(s);
        if (this.node.scale.x === 0 || this.node.scale.y === 0) return;
        const transform = this.node.getComponent(UITransform);
        const parentTransform = this.node.parent?.getComponent(UITransform);
        let newSize = parentTransform.contentSize;
        const scale = Math.max(
            newSize.width / transform.width,
            newSize.height / transform.height
        );
        let newWidth = transform.width * scale;
        let newHeight = transform.height * scale;
        if (this._scale) {
            this.node.setScale(scale, scale);
        } else {
            transform.setContentSize(newWidth, newHeight);
        }

    }
}

