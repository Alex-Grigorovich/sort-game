import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Legacy compatibility component for core/examples/test-scene.
 * Keeps old serialized scene references valid in build.
 */
@ccclass('TestSceneGameController')
export class TestSceneGameController extends Component {
    @property
    _showPackshot = true;

    @property
    _missClick = false;

    @property
    _useCustomSettings = false;

    @property
    _maxClicks = 2;

    @property
    _currentClicks = 0;

    @property
    _maxActions = 1;

    @property
    _currentActions = 0;

    @property([Node])
    _hideOnFinish: Node[] = [];

    @property
    _gameState = 0;

    @property(Node)
    _blackOverlay: Node | null = null;

    public onClick(): void {}
    public onAction(): void {}
    public finishGame(): void {}
}
