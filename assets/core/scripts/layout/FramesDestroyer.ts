import { _decorator, Component, Node } from 'cc';
import playableCore from '../playableCore/playableCore';
const { ccclass } = _decorator;

@ccclass('FramesDestroyer')
export class FramesDestroyer extends Component {
    protected override start(): void {
        var prod = playableCore.getParam("prod");
        if (prod) this.node.destroy();
    }
}


