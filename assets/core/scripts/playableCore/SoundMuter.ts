import { _decorator, Button, CCBoolean, Component, Sprite, SpriteFrame } from 'cc';
import { AudioManager } from './AudioManager';
import { property } from './property';
const { ccclass } = _decorator;
@ccclass('SoundMuter')
export class SoundMuter extends Component {


    @property(CCBoolean)
    private _soundStatus: boolean = true;

    @property(SpriteFrame)
    private _enabledIcon: SpriteFrame = null;

    @property(SpriteFrame)
    private _disabledIcon: SpriteFrame = null;

    private _muteBtn: Button = null;

    protected override start(): void {
        if (window.super_html_channel == "ironsource") {
            console.log("Using native ironsource mute btn");
            this.node.active = false;
        } else {

            this._muteBtn = this.getComponent(Button);
            this._muteBtn.node.on('click', this.onButtonClick, this);
            this.updateStatus();
        }
    }
    private updateStatus() {
        var sprite: Sprite = this._muteBtn.getComponent(Sprite);
        sprite.spriteFrame = this._soundStatus ? this._enabledIcon : this._disabledIcon;
        AudioManager.instance.onSoundChange(this._soundStatus);
    }

    private onButtonClick() {
        this._soundStatus = !this._soundStatus;
        this.updateStatus();
    }

}


