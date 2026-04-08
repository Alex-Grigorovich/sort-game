import { _decorator, Component, Node } from 'cc';
import { GameStateManager } from '../../../scripts/GameStateManager';
import super_html_playable from './super_html_playable';
const { ccclass, property } = _decorator;

@ccclass('Missclicker')
export class Missclicker extends Component {
    public onClick() {
        GameStateManager.Instance.finishGame();
        super_html_playable.download();
    }
}


