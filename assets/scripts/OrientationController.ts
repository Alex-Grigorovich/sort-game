import { _decorator, Camera, Component, Node, ResolutionPolicy, UITransform, Vec3, view, game, sys } from 'cc';
const { ccclass, property } = _decorator;

/** Соответствует project.json designResolution. */
const DESIGN_RES_WIDTH = 640;
const DESIGN_RES_HEIGHT = 640;

/** Пресеты под типовые размеры playable (ширина×высота кадра в px, landscape: длинная сторона первая). */
const GAME_FIELD_FRAME_PRESETS: ReadonlyArray<{
    frameLong: number;
    frameShort: number;
    scale: number;
    offsetY: number;
}> = [
    { frameLong: 640, frameShort: 640, scale: 1, offsetY: 0 },
    { frameLong: 427, frameShort: 320, scale: 0.93, offsetY: 8 },
    { frameLong: 480, frameShort: 320, scale: 0.95, offsetY: 6 },
    { frameLong: 512, frameShort: 320, scale: 0.96, offsetY: 5 },
    { frameLong: 533, frameShort: 320, scale: 0.97, offsetY: 4 },
    { frameLong: 569, frameShort: 320, scale: 0.98, offsetY: 3 },
    { frameLong: 750, frameShort: 375, scale: 0.91, offsetY: 12 },
    { frameLong: 813, frameShort: 375, scale: 0.88, offsetY: 14 },
];

@ccclass('OrientationSwitcher')
export class OrientationSwitcher extends Component {
    static instance: OrientationSwitcher;

    @property(Node)
    portraitCanvas: Node | null = null;
    
    @property(Node)
    landscapeCanvas: Node | null = null;

    @property(Camera)
    camera: Camera = null!;

    @property(Node)
    canvas: Node | null = null;
    @property(Node)
    playButton: Node | null = null;
    @property(Node)
    gameField: Node | null = null;
    /**
     * Родитель фонов под Canvas (узел Bg рядом с GameField). Поворот здесь — вокруг (0,0) канваса,
     * вместе с bgNew со смещением; иначе крутить только bgNew почти не даёт эффекта.
     */
    @property(Node)
    bgRotateRoot: Node | null = null;
    /** Запасной вариант, если bgRotateRoot не задан */
    @property(Node)
    bgNew: Node | null = null;
    @property(Node)
    tutor: Node | null = null;
    /** ����� �������� ������, ���� ����� ����� �� ����� */
    @property(Node)
    startScreen: Node | null = null;
    @property(Node)
    endScreen: Node | null = null;
    @property(Node)
    hint: Node | null = null;

    @property({ tooltip: 'orthoHeight ��� ���������� ����������' })
    portraitHeight: number = 1000;

    @property({ tooltip: 'orthoHeight ��� ��������� ����������' })
    landscapeHeight: number = 800;

    @property({
        tooltip: 'Подгонять scale и смещение Y у GameField под таблицу разрешений playable',
    })
    gameFieldAutoLayout = true;

    @property({ tooltip: 'Дополнительный множитель scale к выбранному пресету' })
    gameFieldScaleMultiplier = 1;

    @property({
        tooltip:
            'В ландшафте (кроме кадра ~640×640): повернуть GameField на gameFieldLandscapeEulerZ, чтобы вертикальная сцена влезала в широкий низкий кадр',
    })
    gameFieldRotateInLandscape = false;

    @property({
        tooltip: 'Дополнитель к базовому euler Z GameField в ландшафте (обычно −90 или 90; подберите по превью)',
    })
    gameFieldLandscapeEulerZ = -90;

    @property({
        tooltip:
            'NO_BORDER для всего кадра: без белых/чёрных полос при fullscreen, 640×640 и rotate (427×320 …); края сцены обрезаются по центру',
    })
    fillNarrowWidthViewportNoBorder = true;

    @property({
        tooltip:
            'После rotate (ландшафт): сдвинуть камеру, чтобы был виден frying container / лоток внизу; Y ограничивается AABB GameField',
    })
    adjustCameraForLandscapeFrying = true;

    @property({
        tooltip:
            'Локальный Y камеры в ландшафте относительно исходного; отрицательное — вниз. На низких кадрах (320, до ~400 px по короткой стороне) сдвиг автоматически смягчается, чтобы не резать верх поля. Итог ограничивается AABB GameField',
    })
    landscapeCameraLocalOffsetY = -140;

    lastIsPortrait: boolean = false;
    private _hasInitialized: boolean = false;

    private readonly _gameFieldBasePos = new Vec3();
    private readonly _gameFieldBaseScale = new Vec3(1, 1, 1);
    private readonly _gameFieldBaseEuler = new Vec3();
    private _gameFieldBaseCaptured = false;

    private readonly _backgroundRotateBaseEuler = new Vec3();
    private _backgroundRotateBaseCaptured = false;

    private _cameraRestLocalY = 0;
    private _cameraRestLocalCaptured = false;

    private readonly _tmpCamClampWorld = new Vec3();
    private readonly _tmpCamClampLocal = new Vec3();

    private readonly _onCanvasResizeGameField = () => {
        this.applyViewportPolicyForNarrowWidths();
        this.applyGameFieldLayout();
        this.applyCameraForOrientation(this.isPortrait());
    };

    is169: boolean;
    is169_2: boolean;
    is43: boolean;
    isIpad: boolean;
    is1610: boolean;
    is2: boolean;
    is3: boolean;
    is4: boolean;
    is15: boolean;
    isIphone14Pro: boolean;
    is1: boolean;
    isZFold: boolean;

    protected onLoad(): void {
        this.applyViewportPolicyForNarrowWidths();
        view.on('canvas-resize', this._onCanvasResizeGameField, this);
        this.applyCameraForOrientation(this.isPortrait());
    }

    protected onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResizeGameField, this);
    }

    start() {
        OrientationSwitcher.instance = this;
        this.scheduleOnce(() => {
            this.applyViewportPolicyForNarrowWidths();
            this.lastIsPortrait = this.isPortrait();
            this.applyOrientation(this.lastIsPortrait);
            this.applyGameFieldLayout();
            this._hasInitialized = true;
        }, 0.1); // ���������� ������������� �� 100��
    }

    update() {
        if (!this._hasInitialized) return;

        const currentIsPortrait = this.isPortrait();
        if (currentIsPortrait !== this.lastIsPortrait) {
            this.applyOrientation(currentIsPortrait);
            this.applyGameFieldLayout();
            this.lastIsPortrait = currentIsPortrait;
        }
        //this.camera.orthoHeight = currentIsPortrait ? this.portraitHeight : this.landscapeHeight;
    }

    isPortrait(): boolean {
        // ���-��������� � ���� �������� DOM canvas
        if (sys.isBrowser) {
            const canvas = game.canvas as HTMLCanvasElement;
            const width = canvas?.clientWidth ?? 0;
            const height = canvas?.clientHeight ?? 0;

            // fallback, ���� canvas �� ������� ��� ������� �������
            if (width === 0 || height === 0) {
                const visibleSize = view.getVisibleSize();
                return visibleSize.height >= visibleSize.width;
            }

            if (height < width) {
                this.is1 = width / height <= 1.3;
                this.is43 = (width / height > 1.3) && (width / height <= 1.4);
                this.isIpad = (width / height > 1.4) && (width / height <= 1.47);
                this.is15 = (width / height > 1.47) && (width / height <= 1.53);
                this.is1610 = (width / height > 1.53) && (width / height <= 1.65);
                this.is3 = (width / height > 1.65) && (width / height <= 1.74);
                this.is169 = (width / height > 1.74) && (width / height <= 1.78);
                this.is169_2 = (width / height > 1.78) && (width / height <= 1.85);
                this.is4 = (width / height > 1.85) && (width / height <= 1.95);
                this.is2 = (width / height > 1.95) && (width / height <= 2.10);
                this.isIphone14Pro = (width / height > 2.16) && (width / height <= 2.17);
                this.isZFold = (width / height > 2.4);
            }
            else {
                this.is1 = height / width <= 1.3;
                this.is43 = (height / width > 1.3) && (height / width <= 1.4);
                this.isIpad = (height / width > 1.4) && (height / width <= 1.47);
                this.is15 = (height / width > 1.47) && (height / width <= 1.53);
                this.is1610 = (height / width > 1.53) && (height / width <= 1.65);
                this.is3 = (height / width > 1.65) && (height / width <= 1.74);
                this.is169 = (height / width > 1.74) && (height / width <= 1.78);
                this.is169_2 = (height / width > 1.78) && (height / width <= 1.85);
                this.is4 = (height / width > 1.85) && (height / width <= 1.95);
                this.is2 = (height / width > 1.95) && (height / width <= 2.10);
                this.isIphone14Pro = (height / width > 2.16) && (height / width <= 2.17);
                this.isZFold = (height / width > 2.4);
            }
            return height >= width;
        }


        // ����� ��� ���������
        const visibleSize = view.getVisibleSize();

        if (visibleSize.height < visibleSize.width) {
            this.is1 = visibleSize.width / visibleSize.height <= 1.4;
            this.is43 = (visibleSize.width / visibleSize.height > 1.3) && (visibleSize.width / visibleSize.height <= 1.4);
            this.isIpad = (visibleSize.width / visibleSize.height > 1.4) && (visibleSize.width / visibleSize.height <= 1.47);
            this.is15 = (visibleSize.width / visibleSize.height > 1.47) && (visibleSize.width / visibleSize.height <= 1.53);
            this.is1610 = (visibleSize.width / visibleSize.height > 1.53) && (visibleSize.width / visibleSize.height <= 1.65);
            this.is3 = (visibleSize.width / visibleSize.height > 1.65) && (visibleSize.width / visibleSize.height <= 1.74);
            this.is169 = (visibleSize.width / visibleSize.height > 1.74) && (visibleSize.width / visibleSize.height <= 1.78);
            this.is169_2 = (visibleSize.width / visibleSize.height > 1.78) && (visibleSize.width / visibleSize.height <= 1.85);
            this.is4 = (visibleSize.width / visibleSize.height > 1.85) && (visibleSize.width / visibleSize.height <= 1.95);
            this.is2 = (visibleSize.width / visibleSize.height > 1.95) && (visibleSize.width / visibleSize.height <= 2.10);
            this.isIphone14Pro = (visibleSize.width / visibleSize.height > 2.16) && (visibleSize.width / visibleSize.height <= 2.17);
            this.isZFold = (visibleSize.width / visibleSize.height > 2.4);
        }
        else {
            this.is1 = visibleSize.height / visibleSize.width <= 1.3;
            this.is43 = (visibleSize.height / visibleSize.width > 1.3) && (visibleSize.height / visibleSize.width <= 1.4);
            this.isIpad = (visibleSize.height / visibleSize.width > 1.4) && (visibleSize.height / visibleSize.width <= 1.47);
            this.is15 = (visibleSize.height / visibleSize.width > 1.47) && (visibleSize.height / visibleSize.width <= 1.53);
            this.is1610 = (visibleSize.height / visibleSize.width > 1.53) && (visibleSize.height / visibleSize.width <= 1.65);
            this.is3 = (visibleSize.height / visibleSize.width > 1.65) && (visibleSize.height / visibleSize.width <= 1.74);
            this.is169 = (visibleSize.height / visibleSize.width > 1.74) && (visibleSize.height / visibleSize.width <= 1.78);
            this.is169_2 = (visibleSize.height / visibleSize.width > 1.78) && (visibleSize.height / visibleSize.width <= 1.85);
            this.is4 = (visibleSize.height / visibleSize.width > 1.85) && (visibleSize.height / visibleSize.width <= 1.95);
            this.is2 = (visibleSize.height / visibleSize.width > 1.95) && (visibleSize.height / visibleSize.width <= 2.10);
            this.isIphone14Pro = (visibleSize.height / visibleSize.width > 2.16) && (visibleSize.height / visibleSize.width <= 2.17);
            this.isZFold = (visibleSize.height / visibleSize.width > 2.4);
        }

        return visibleSize.height >= visibleSize.width;
    }

    private applyOrientation(isPortrait: boolean): void {
        this.applyViewportPolicyForNarrowWidths();
        if (!this.camera) {
            console.error("Camera is not assigned!");
            return;
        }
        if (isPortrait) {
            this.canvas?.setScale(1, 1, 1);
            this.playButton?.setPosition(0, -885, 0);
            this.hint?.setPosition(223.463, -712.012, 0);
            if (this.is169 || this.is169_2) {
                this.startScreen?.setScale(1.3, 1.3);
                this.endScreen?.setScale(1.3, 1.3);
            } else {
                this.startScreen?.setScale(1.1, 1.1);
                this.endScreen?.setScale(1.1, 1.1);
            }
        } else {
            this.startScreen?.setScale(1.5, 1.5);
            this.endScreen?.setScale(1.4, 1.4);
            // Без доп. масштаба канваса: иначе GameField/bg2 выглядят «зумом» в широком превью.
            this.canvas?.setScale(1, 1, 1);
            this.playButton?.setPosition(1100, 0, 0);
            this.hint?.setPosition(1272.786, 202.272, 0);
        }
        this.applyGameFieldLayout();
        this.applyCameraForOrientation(isPortrait);
    }

    /**
     * В ландшафте после rotate видимая область часто «обрезает» низ; сдвигаем камеру по Y.
     * Исходный Y запоминается при первом вызове (как в сцене для портрета).
     */
    private applyCameraForOrientation(isPortrait: boolean): void {
        if (!this.adjustCameraForLandscapeFrying || !this.camera?.node?.isValid) {
            return;
        }
        const camNode = this.camera.node;
        if (!this._cameraRestLocalCaptured) {
            this._cameraRestLocalY = camNode.position.y;
            this._cameraRestLocalCaptured = true;
        }
        const { long, short } = this.getFramePixelSize();
        if (this.isApproxSquare640Frame(long, short)) {
            const p = camNode.position;
            camNode.setPosition(p.x, this._cameraRestLocalY, p.z);
            return;
        }
        const off = isPortrait ? 0 : this.getEffectiveLandscapeCameraOffsetY();
        let y = isPortrait ? this._cameraRestLocalY : this._cameraRestLocalY + off;
        if (!isPortrait) {
            y = this.clampCameraLocalYToGameFieldBounds(y);
        }
        const p = camNode.position;
        camNode.setPosition(p.x, y, p.z);
    }

    /**
     * Баннеры ~320 и широкий rotate: сильный отрицательный сдвиг обрезает верх игрового поля и оставляет пустую полосу снизу.
     * Ограничиваем величину опускания в зависимости от короткой стороны кадра (px).
     */
    private getEffectiveLandscapeCameraOffsetY(): number {
        const base = Number(this.landscapeCameraLocalOffsetY) || 0;
        const { long, short } = this.getFramePixelSize();
        const ratio = long / Math.max(1, short);
        if (short <= 340) {
            return Math.max(base, 0);
        }
        if (short <= 400) {
            return Math.max(base, -50);
        }
        // Широкий кадр (полосы по бокам при квадратном дизайне): сильный -140 снова режет верх поля
        if (short <= 720 && ratio >= 1.5) {
            return Math.max(base, -42);
        }
        return base;
    }

    /**
     * Вертикальный центр ortho-вида остаётся так, чтобы верх/низ кадра не уходили за AABB GameField
     * (не показывать пустоту за пределами поля).
     */
    private clampCameraLocalYToGameFieldBounds(localY: number): number {
        const cam = this.camera!;
        const camNode = cam.node;
        const parent = camNode.parent;
        const gfTf = this.gameField?.getComponent(UITransform);
        const parentUt = parent?.getComponent(UITransform);
        if (!gfTf?.isValid || !parentUt?.isValid) {
            return localY;
        }

        const halfH = Math.max(1e-4, cam.orthoHeight) * 0.5;
        const rect = gfTf.getBoundingBoxToWorld();
        const bottom = rect.y;
        const top = rect.y + rect.height;
        const minWorldY = bottom + halfH;
        const maxWorldY = top - halfH;

        const px = camNode.position.x;
        const pz = camNode.position.z;
        camNode.setPosition(px, localY, pz);
        camNode.updateWorldTransform();
        const wy = camNode.worldPosition.y;
        let clampedWy = wy;
        if (minWorldY <= maxWorldY) {
            clampedWy = Math.min(Math.max(wy, minWorldY), maxWorldY);
        } else {
            clampedWy = (bottom + top) * 0.5;
        }
        this._tmpCamClampWorld.set(camNode.worldPosition.x, clampedWy, camNode.worldPosition.z);
        parentUt.convertToNodeSpaceAR(this._tmpCamClampWorld, this._tmpCamClampLocal);
        return this._tmpCamClampLocal.y;
    }

    private getRawCanvasClientSize(): { w: number; h: number } {
        if (sys.isBrowser && game.canvas) {
            const el = game.canvas as HTMLCanvasElement;
            const w = el.clientWidth | 0;
            const h = el.clientHeight | 0;
            if (w > 0 && h > 0) {
                return { w, h };
            }
        }
        const fs = view.getFrameSize();
        return { w: Math.max(1, fs.width), h: Math.max(1, fs.height) };
    }

    /**
     * NO_BORDER — весь viewport заполнен масштабом без полос (в т.ч. 640×640 и баннеры 320 по короткой стороне).
     * Выкл. — FIXED_HEIGHT как в project.json.
     */
    applyViewportPolicyForNarrowWidths(): void {
        if (!this.fillNarrowWidthViewportNoBorder) {
            view.setDesignResolutionSize(DESIGN_RES_WIDTH, DESIGN_RES_HEIGHT, ResolutionPolicy.FIXED_HEIGHT);
            return;
        }
        view.setDesignResolutionSize(DESIGN_RES_WIDTH, DESIGN_RES_HEIGHT, ResolutionPolicy.NO_BORDER);
    }

    /** Размер окна кадра: DOM canvas или visible size (для нативного превью). */
    private getFramePixelSize(): { long: number; short: number } {
        if (sys.isBrowser && game.canvas) {
            const el = game.canvas as HTMLCanvasElement;
            const w = el.clientWidth | 0;
            const h = el.clientHeight | 0;
            if (w > 0 && h > 0) {
                return w >= h ? { long: w, short: h } : { long: h, short: w };
            }
        }
        const vs = view.getVisibleSize();
        const w = Math.max(1, Math.round(vs.width));
        const h = Math.max(1, Math.round(vs.height));
        return w >= h ? { long: w, short: h } : { long: h, short: w };
    }

    private pickGameFieldPreset(long: number, short: number): (typeof GAME_FIELD_FRAME_PRESETS)[number] {
        let best = GAME_FIELD_FRAME_PRESETS[0]!;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const p of GAME_FIELD_FRAME_PRESETS) {
            const dl = (long - p.frameLong) / Math.max(p.frameLong, 1);
            const ds = (short - p.frameShort) / Math.max(p.frameShort, 1);
            const score = dl * dl + ds * ds;
            if (score < bestScore) {
                bestScore = score;
                best = p;
            }
        }
        return best;
    }

    private getBackgroundRotateTarget(): Node | null {
        const n = this.bgRotateRoot ?? this.bgNew;
        return n?.isValid ? n : null;
    }

    private captureBackgroundRotateBaseIfNeeded(): void {
        const t = this.getBackgroundRotateTarget();
        if (!t || this._backgroundRotateBaseCaptured) {
            return;
        }
        this._backgroundRotateBaseEuler.set(t.eulerAngles);
        this._backgroundRotateBaseCaptured = true;
    }

    /** Тот же режим поворота, что у GameField (ландшафт / квадрат 640). */
    private syncBackgroundRotationWithGameField(square640: boolean, portrait: boolean): void {
        const t = this.getBackgroundRotateTarget();
        if (!t || !this._backgroundRotateBaseCaptured) {
            return;
        }
        if (square640) {
            t.setRotationFromEuler(
                this._backgroundRotateBaseEuler.x,
                this._backgroundRotateBaseEuler.y,
                this._backgroundRotateBaseEuler.z,
            );
            return;
        }
        const rotate =
            this.gameFieldRotateInLandscape &&
            !portrait &&
            Math.abs(Number(this.gameFieldLandscapeEulerZ) || 0) > 1e-3;
        if (rotate) {
            const dz = Number(this.gameFieldLandscapeEulerZ) || 0;
            t.setRotationFromEuler(
                this._backgroundRotateBaseEuler.x,
                this._backgroundRotateBaseEuler.y,
                this._backgroundRotateBaseEuler.z + dz,
            );
        } else {
            t.setRotationFromEuler(
                this._backgroundRotateBaseEuler.x,
                this._backgroundRotateBaseEuler.y,
                this._backgroundRotateBaseEuler.z,
            );
        }
    }

    /**
     * Кадр ~640×640 (чуть неточные CSS-размеры не должны уводить в ландшафт с −90°).
     * Широкий ландшафт (long ≫ short) сюда не попадает из‑за maxSideDiff.
     */
    private isApproxSquare640Frame(long: number, short: number): boolean {
        const tol = 100;
        const maxSideDiff = 100;
        if (Math.abs(long - short) > maxSideDiff) {
            return false;
        }
        return (
            Math.abs(long - DESIGN_RES_WIDTH) <= tol &&
            Math.abs(short - DESIGN_RES_HEIGHT) <= tol
        );
    }

    /** Подгонка GameField под ближайшее из заданных разрешений. */
    applyGameFieldLayout(): void {
        if (!this.gameFieldAutoLayout || !this.gameField?.isValid) return;

        if (!this._gameFieldBaseCaptured) {
            this._gameFieldBasePos.set(this.gameField.position);
            this._gameFieldBaseScale.set(this.gameField.scale);
            this._gameFieldBaseEuler.set(this.gameField.eulerAngles);
            this._gameFieldBaseCaptured = true;
        }
        this.captureBackgroundRotateBaseIfNeeded();

        const { long, short } = this.getFramePixelSize();
        const mul = Math.max(0.05, Number(this.gameFieldScaleMultiplier) || 1);
        const portrait = this.isPortrait();
        const square640 = this.isApproxSquare640Frame(long, short);

        if (square640) {
            const s = GAME_FIELD_FRAME_PRESETS[0]!.scale * mul;
            this.gameField.setRotationFromEuler(
                this._gameFieldBaseEuler.x,
                this._gameFieldBaseEuler.y,
                this._gameFieldBaseEuler.z,
            );
            this.gameField.setScale(
                this._gameFieldBaseScale.x * s,
                this._gameFieldBaseScale.y * s,
                this._gameFieldBaseScale.z,
            );
            this.gameField.setPosition(
                this._gameFieldBasePos.x,
                this._gameFieldBasePos.y,
                this._gameFieldBasePos.z,
            );
            this.syncBackgroundRotationWithGameField(true, portrait);
            return;
        }

        const preset = this.pickGameFieldPreset(long, short);
        const s = preset.scale * mul;
        const rotate =
            this.gameFieldRotateInLandscape &&
            !portrait &&
            Math.abs(Number(this.gameFieldLandscapeEulerZ) || 0) > 1e-3;
        if (rotate) {
            const dz = Number(this.gameFieldLandscapeEulerZ) || 0;
            this.gameField.setRotationFromEuler(
                this._gameFieldBaseEuler.x,
                this._gameFieldBaseEuler.y,
                this._gameFieldBaseEuler.z + dz,
            );
        } else {
            this.gameField.setRotationFromEuler(
                this._gameFieldBaseEuler.x,
                this._gameFieldBaseEuler.y,
                this._gameFieldBaseEuler.z,
            );
        }
        this.gameField.setScale(
            this._gameFieldBaseScale.x * s,
            this._gameFieldBaseScale.y * s,
            this._gameFieldBaseScale.z,
        );
        this.gameField.setPosition(
            this._gameFieldBasePos.x,
            this._gameFieldBasePos.y + preset.offsetY,
            this._gameFieldBasePos.z,
        );
        this.syncBackgroundRotationWithGameField(false, portrait);
    }
}



