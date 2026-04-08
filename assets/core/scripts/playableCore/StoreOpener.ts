import { _decorator, Component } from 'cc';
import super_html_playable from './super_html_playable';
const { ccclass } = _decorator;

@ccclass('StoreOpener')
export class StoreOpener extends Component {
    public openStore(): void {
        super_html_playable.download();
    }
}


