import { _decorator, Component, easing, Enum, instantiate, Prefab, tween, Node, UIOpacity, Widget, view } from 'cc';
import { property } from '../core/scripts/playableCore/property';
import super_html_playable from '../core/scripts/playableCore/super_html_playable';
import { AudioManager } from '../core/scripts/playableCore/AudioManager';
import playableCore from '../core/scripts/playableCore/playableCore';
import { Main } from '../core/scripts/playableCore/Main';
import { VersionsLoader } from '../core/scripts/playableCore/VersionsLoader';
import { AdaptiveLayout } from './../core/scripts/layout/AdaptiveLayout';
import { Missclicker } from '../core/scripts/playableCore/Missclicker';

const { ccclass } = _decorator;

export enum GameState {
    LoadingResouces,
    Initialization,
    Game,
    GameEnd
}

@ccclass('GameStateManager')
export class GameStateManager extends Component {
    public static Instance: GameStateManager = null!;

    @property({ type: Boolean, group: "Game end params" })
    private _showPackshot: boolean = true;

    @property({ type: Boolean, group: "Game end params" })
    private _missClick: boolean = true;

    @property({ type: Boolean, group: "Game end params", tooltip: 'Использовать кастомные настройки из проперти вместо версии' })
    private _useCustomSettings: boolean = false;

    @property({ type: Number, group: "Game end params" })
    private _maxClicks: number = 0;

    @property({ type: Number, group: "Game end params" })
    private _currentClicks: number = 0;

    @property({ type: Number, group: "Game end params" })
    private _maxActions: number = 0;

    @property({ type: Number, group: "Game end params" })
    private _currentActions: number = 0;

    @property({ type: Node, group: "HideOnFinish" })
    private _hideOnFinish: Node[] = [];

    @property({ type: Enum(GameState), group: "Game state" })
    private _gameState: GameState = GameState.LoadingResouces;

    @property({ type: UIOpacity, group: "Assets" })
    private _blackOverlay: UIOpacity = null!;

    @property({ type: Prefab, group: "Assets" })
    private _packshot: Prefab = null!;

    @property({ type: Prefab, group: "Assets" })
    private _missClicker: Prefab = null!;

    private _spawnedMissClicker: Node = null!;

    public getGameState(): GameState {
        return this._gameState;
    }

    public finishGame() {
        if (this._gameState != GameState.Game) {
            return;
        }
        this._gameState = GameState.GameEnd;
        super_html_playable.game_end();
        if (this._showPackshot) {
            this.showPackshot();
            return;
        } else if (!this._spawnedMissClicker) {
            this.spawnMissClicker();
        }
    }

    public initGame() {
        if (this._gameState != GameState.LoadingResouces) {
            return;
        }
        GameStateManager.Instance = this;
        this._gameState = GameState.Initialization;
        console.log('Intialize game');
        this._blackOverlay.node.active = true;
        this._blackOverlay.opacity = 255;
        this.initParams();

        //here is the game initialization

        this.startGame();
        console.log("prod", playableCore.getParam('prod'));
    }

    public onClick() {
        AudioManager.instance.tryStartGameplayMusic();
        if (this._gameState != GameState.Game) {
            return;
        }
        this._currentClicks++;
        if (this._currentClicks >= this._maxClicks && this._maxClicks > 0) {
            if (this._missClick) {
                this.spawnMissClicker();
            } else {
                this.finishGame();
            }
            AudioManager.instance.node.setSiblingIndex(1000);
        }
    }

    public onAction() {
        AudioManager.instance.tryStartGameplayMusic();
        if (this._gameState != GameState.Game) {
            return;
        }
        this._currentActions++;
        if (this._currentActions >= this._maxActions && this._maxActions > 0) {
            if (this._missClick) {
                this.spawnMissClicker();
            } else {
                this.finishGame();
            }
            AudioManager.instance.node.setSiblingIndex(1000);
        }
    }

    private initParams() {
        var prod = playableCore.getParam('prod');
        if (prod === true) {
            this._useCustomSettings = false;
        }
        const isNotProd = prod === false || prod === null || !prod;

        if (isNotProd && !this._useCustomSettings) {
            VersionsLoader.loadSelectedVersion();
        }

        if (this._useCustomSettings) {
            return;
        }

        var maxClicks = playableCore.getParam('clicks');
        var maxActions = playableCore.getParam('actions');
        var showPackshot = playableCore.getParam('showPackshot');
        var missClick = playableCore.getParam('missClick');

        if (maxClicks != null) {
            this._maxClicks = maxClicks;
        }

        if (maxActions != null) {
            this._maxActions = maxActions;
        }

        if (showPackshot != null) {
            this._showPackshot = showPackshot;
        }

        if (missClick != null) {
            this._missClick = missClick;
        }
    }

    private startGame() {
        this._gameState = GameState.Game;
        console.log('Start game');
        tween(this._blackOverlay)
            .to(0.5, { opacity: 0 }, { easing: easing.sineInOut })
            .call(() => {
                this._blackOverlay.node.destroy();
                if (!super_html_playable.getMuteOnStart()) {
                    AudioManager.instance.tryStartGameplayMusic();
                }
            })
            .start();


    }

    private showPackshot() {
        AudioManager.instance.smoothStopMusic();
        AudioManager.instance.playSound(AudioManager.instance.gameEndSound);
        var packshot = instantiate(this._packshot);
        Main.instance.canvas.node.addChild(packshot);

        const rootWidget = packshot.getComponent(Widget);
        if (rootWidget) {
            rootWidget.updateAlignment();
        }

        const adaptiveLayouts = packshot.getComponentsInChildren(AdaptiveLayout);
        const visibleSize = view.getVisibleSize();

        adaptiveLayouts.forEach(layout => {
            layout.onResize(visibleSize);
        });

        this._hideOnFinish.forEach(node => {
            node.active = false;
        });
    }

    private spawnMissClicker() {
        this._spawnedMissClicker = instantiate(this._missClicker);
        Main.instance.canvas.node.addChild(this._spawnedMissClicker);
        this._spawnedMissClicker.getComponent(Missclicker).onClick();
    }
}
