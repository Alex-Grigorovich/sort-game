import { _decorator, CCBoolean, CCString, Component, Sprite, Size } from 'cc';
const { ccclass } = _decorator;
import { Localizator } from './Localizator';
import { FitImage } from '../layout/FitImage';
import { FillImage } from '../layout/FillImage';
import { property } from '../playableCore/property';
@ccclass('LocalizedSprite')
export class LocalizedSprite extends Component {
    @property(CCBoolean)
    private _keyAsName: boolean = true;

    @property(CCString)
    private _key: string = "";

    private _subed: boolean = false;

    protected override start(): void {
        if (Localizator.localizationAlreadyLoaded) {
            this.onLocalizationLoaded();
        } else {
            Localizator.eventTarget.on(Localizator.localizationLoaded, this.onLocalizationLoaded.bind(this), this);
            this._subed = true;
        }
    }
    protected override onDestroy(): void {
        if (this._subed) {
            Localizator.eventTarget.off(Localizator.localizationLoaded, this.onLocalizationLoaded.bind(this), this);
            this._subed = false;
        }
    }

    private onLocalizationLoaded() {
        var key = this._keyAsName ? this.node.name : this._key;
        var sprite = this.getComponent(Sprite);
        var spriteFrame = Localizator.getLocalizeSprite(key)
        if (spriteFrame == null) {
            console.log("cant find localize sprite with key ", key);
        }
        sprite.spriteFrame = spriteFrame;
        var fitter = this.getComponent(FitImage);
        if (fitter) {
            fitter.onResize(new Size());
        }
        var filler = this.getComponent(FillImage)
        if (filler) {
            filler.onResize(new Size());
        }

    }
}


