import { _decorator, Component, Node, Size, UITransform, Vec3, Widget, view } from 'cc';
import { property } from '../core/scripts/playableCore/property';

const { ccclass } = _decorator;

@ccclass('BackgroundCover')
export class BackgroundCover extends Component {
    @property({ type: Node, tooltip: 'Опционально: по какой ноде считать cover. Пусто = родитель, затем visible size.' })
    coverTarget: Node | null = null;

    @property({ tooltip: 'Применять cover при старте автоматически' })
    applyOnStart = true;

    private readonly _baseScale = new Vec3(1, 1, 1);
    private readonly _baseContentSize = new Size(100, 100);
    private _baseCaptured = false;

    protected override onLoad(): void {
        this.captureBaseIfNeeded();
    }

    protected override onEnable(): void {
        view.on('canvas-resize', this.onCanvasResize, this);
        if (this.applyOnStart) {
            this.scheduleOnce(() => this.applyCover(), 0);
        }
    }

    protected override onDisable(): void {
        view.off('canvas-resize', this.onCanvasResize, this);
    }

    private onCanvasResize(): void {
        this.scheduleOnce(() => this.applyCover(), 0);
    }

    public applyCover(): void {
        if (!this.node?.isValid) return;
        this.captureBaseIfNeeded();

        const selfTransform = this.node.getComponent(UITransform);
        if (!selfTransform) {
            console.warn('BackgroundCover: UITransform not found on node', this.node.name);
            return;
        }

        const targetSize = this.resolveTargetSize();
        if (!targetSize || targetSize.width <= 0 || targetSize.height <= 0) {
            return;
        }

        const parentWorldScale = this.node.parent?.worldScale ?? Vec3.ONE;
        const baseWorldWidth = Math.max(1e-4, this._baseContentSize.width * Math.abs(this._baseScale.x * parentWorldScale.x));
        const baseWorldHeight = Math.max(1e-4, this._baseContentSize.height * Math.abs(this._baseScale.y * parentWorldScale.y));
        const targetWorldWidth = Math.max(1e-4, targetSize.width);
        const targetWorldHeight = Math.max(1e-4, targetSize.height);

        const mul = Math.max(
            targetWorldWidth / baseWorldWidth,
            targetWorldHeight / baseWorldHeight,
        );

        this.node.setScale(
            this._baseScale.x * mul,
            this._baseScale.y * mul,
            this._baseScale.z,
        );
    }

    private captureBaseIfNeeded(): void {
        if (this._baseCaptured || !this.node?.isValid) {
            return;
        }
        const transform = this.node.getComponent(UITransform);
        if (!transform) {
            return;
        }
        this._baseScale.set(this.node.scale);
        this._baseContentSize.width = transform.contentSize.width;
        this._baseContentSize.height = transform.contentSize.height;
        this._baseCaptured = true;
    }

    private resolveTargetSize(): Size | null {
        const target = this.coverTarget?.isValid ? this.coverTarget : this.node.parent;
        const widget = target?.getComponent(Widget);
        widget?.updateAlignment();

        const targetTransform = target?.getComponent(UITransform);
        if (targetTransform) {
            return new Size(
                targetTransform.contentSize.width * Math.abs(target.worldScale.x),
                targetTransform.contentSize.height * Math.abs(target.worldScale.y),
            );
        }

        const visible = view.getVisibleSize();
        return new Size(visible.width, visible.height);
    }
}
