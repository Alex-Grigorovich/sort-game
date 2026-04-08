import { _decorator, Component, Node, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('testsprites')
export class testsprites extends Component {
    @property([SpriteFrame])
    private sprites: SpriteFrame[] = [];
}


