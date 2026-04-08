import { _decorator, Component, Size, Widget } from 'cc';
const { ccclass } = _decorator;

@ccclass('DynamicUI')
export abstract class DynamicUI extends Component {
    public onResize(newSize: Size = new Size()): void {
        const parentWidget = this.node.parent?.getComponent(Widget);
        if (parentWidget) {
            parentWidget.updateAlignment();
        }
    }
}


