import { _decorator, CCBoolean, CCString, Component, Sprite, Size } from 'cc';

const { ccclass } = _decorator;
import { SkinsManager } from './SkinsManager';
import { FitImage } from '../layout/FitImage';
import { FillImage } from '../layout/FillImage';
import { property } from '../playableCore/property';

@ccclass('SkinnedSprite')
export class SkinnedSprite extends Component {
    @property(CCBoolean)
    private _keyAsName: boolean = true;

    @property(CCString)
    private _key: string = "";

    private _subedSkin: boolean = false;


    protected override start(): void {
        if (SkinsManager.skinsAlreadyLoaded) {
            this.onSkinsLoaded();
        } else {
            SkinsManager.eventTarget.on(SkinsManager.skinsLoaded, this.onSkinsLoaded.bind(this), this);
            this._subedSkin = true;
        }

    }

    protected override onDestroy(): void {
        if (this._subedSkin) {
            SkinsManager.eventTarget.off(SkinsManager.skinsLoaded, this.onSkinsLoaded.bind(this), this);
            this._subedSkin = false;
        }

    }

    private onSkinsLoaded() {
        this.applySkin();
    }


    private applySkin() {
        const key = this._keyAsName ? this.node.name : this._key;
        const sprite = this.getComponent(Sprite);

        if (!sprite) {

            return;
        }

        const skinnedSpriteFrame = SkinsManager.getSkinnedSprite(key);

        if (skinnedSpriteFrame) {
            sprite.spriteFrame = skinnedSpriteFrame;

        } else {
            sprite.spriteFrame = null;



        }

        // Обновляем компоненты подгонки размера
        this.updateLayoutComponents();
    }

    private updateLayoutComponents() {
        const fitter = this.getComponent(FitImage);
        if (fitter) {
            fitter.onResize(new Size());
        }

        const filler = this.getComponent(FillImage);
        if (filler) {
            filler.onResize(new Size());
        }
    }

    /**
     * Принудительно применить скин
     */
    public forceApplySkin() {
        this.applySkin();
    }

    /**
     * Установить ключ скина
     */
    public setSkinKey(key: string) {
        this._key = key;
        this._keyAsName = false;
        this.applySkin();
    }

    /**
     * Использовать имя узла как ключ
     */
    public useNodeNameAsKey() {
        this._keyAsName = true;
        this.applySkin();
    }
}
