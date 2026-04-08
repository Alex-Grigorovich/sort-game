import { _decorator, Canvas, Component, SpriteFrame } from 'cc';
import { property } from './property';
import LocalizationCore from '../localization/LocalizationCore';
import SkinsCore from '../skins/SkinsCore';
import { SkinsManager } from '../skins/SkinsManager';
import { Localizator } from '../localization/Localizator';
import { GameStateManager } from 'db://assets/scripts/GameStateManager';
const { ccclass, executionOrder, requireComponent, disallowMultiple } = _decorator;

@ccclass('Main')
@executionOrder(1)
@requireComponent(Canvas)
@disallowMultiple(true)
export class Main extends Component {
    public static instance: Main = null!;
    public localizedAssets: { [key: string]: SpriteFrame } = {};
    public skinnedAssets: { [key: string]: SpriteFrame } = {};
    public canvas: Canvas = null!;
    @property(Boolean)
    public useLocalization: boolean = false;

    @property(Boolean)
    public useSkins: boolean = false;

    @property({
        type: String,
        visible: function (this: Main) {
            return this.useSkins;
        }
    })
    public defaultSkin: string = 'default';

    public gameStateManager: GameStateManager = null!;



    @property({
        type: String,
        visible: function (this: Main) {
            return this.useLocalization;
        }
    })
    public defaultLanguage: string = 'en';

    protected override async onLoad(): Promise<void> {
        Main.instance = this;
        await this.initSystems();
        this.initGame();

    }

    private initGame() {
        this.canvas = this.node.getComponent(Canvas)!;
        this.gameStateManager = this.node.getComponentInChildren(GameStateManager)!;
        if (!this.gameStateManager) {
            console.error('GameStateManager not found');
            return;
        }
        this.gameStateManager.initGame();
    }

    private async initSystems() {
        if (this.useLocalization) {
            await this.initLocalization();
        }
        if (this.useSkins) {
            await this.initSkins();
        }
    }
    private async initLocalization() {
        await LocalizationCore.init();
        this.localizedAssets = LocalizationCore.assets;
        console.log("Localization core initialized");
        await new Promise(resolve => setTimeout(resolve, 100));
        Localizator.onLocalizationLoaded();
        console.log("Localized assets loaded:", this.localizedAssets);
    }

    private async initSkins() {
        await SkinsCore.init(this.defaultSkin);
        this.skinnedAssets = SkinsCore.assets;
        console.log("Skins core initialized");
        await new Promise(resolve => setTimeout(resolve, 100));
        SkinsManager.onSkinsLoaded();
        console.log("Skinned assets loaded:", this.skinnedAssets);
    }

}


