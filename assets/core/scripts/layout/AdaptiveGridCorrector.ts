import { _decorator, Node, UITransform, Size, Vec3, Enum } from 'cc';
import { DynamicUI } from './DynamicUI';
import { GameOrientation } from './GameOrientation';
import { AspectRatio, getAspectRatioValue } from './AdaptiveLayout';
const { ccclass, property } = _decorator;

/**
 * Настройки сетки для конкретного соотношения сторон
 */
@ccclass('GridSettings')
export class GridSettings {
    @property({ type: Enum(AspectRatio), tooltip: 'Соотношение сторон экрана' })
    aspectRatio: AspectRatio = AspectRatio.emn_4_3;

    @property({ tooltip: 'Горизонтальный промежуток между элементами' })
    spacingX: number = 10;

    @property({ tooltip: 'Вертикальный промежуток между элементами' })
    spacingY: number = 10;

    @property({ tooltip: 'Минимальный отступ от краёв контейнера' })
    padding: number = 0;
}

/**
 * Группа настроек сетки для ориентации
 */
@ccclass('GridGroup')
export class GridGroup {
    @property([GridSettings])
    settings: GridSettings[] = [];
}

/**
 * Адаптивная сетка, которая автоматически распределяет дочерние элементы
 * в зависимости от размера контейнера и соотношения сторон экрана.
 * Наследуется от DynamicUI для автоматического обновления при изменении размера экрана.
 */
@ccclass('AdaptiveGridCorrector')
export class AdaptiveGridCorrector extends DynamicUI {
    // === PORTRAIT ===
    @property({ type: GridGroup, group: "Portrait", tooltip: 'Настройки для портретной ориентации' })
    portraitSettings: GridGroup = new GridGroup();

    // === LANDSCAPE ===
    @property({ type: GridGroup, group: "Landscape", tooltip: 'Настройки для ландшафтной ориентации' })
    landscapeSettings: GridGroup = new GridGroup();

    // === DEFAULT (если настроек нет) ===
    @property({ group: "Default", tooltip: 'Горизонтальный промежуток по умолчанию' })
    defaultSpacingX: number = 10;

    @property({ group: "Default", tooltip: 'Вертикальный промежуток по умолчанию' })
    defaultSpacingY: number = 10;

    @property({ group: "Default", tooltip: 'Отступ от краёв по умолчанию' })
    defaultPadding: number = 0;

    private _containerTransform: UITransform | null = null;
    private _currentSpacingX: number = 10;
    private _currentSpacingY: number = 10;
    private _currentPadding: number = 0;

    protected override onLoad() {
        this._containerTransform = this.node.getComponent(UITransform);
        this._currentSpacingX = this.defaultSpacingX;
        this._currentSpacingY = this.defaultSpacingY;
        this._currentPadding = this.defaultPadding;
        this.updateLayout();
    }

    protected override onEnable(): void {
        this.node.on(Node.EventType.CHILD_ADDED, this.onChildChanged, this);
        this.node.on(Node.EventType.CHILD_REMOVED, this.onChildChanged, this);
        this.node.on(Node.EventType.SIZE_CHANGED, this.onSizeChanged, this);
    }

    protected override onDisable(): void {
        this.node.off(Node.EventType.CHILD_ADDED, this.onChildChanged, this);
        this.node.off(Node.EventType.CHILD_REMOVED, this.onChildChanged, this);
        this.node.off(Node.EventType.SIZE_CHANGED, this.onSizeChanged, this);
    }

    /**
     * Вызывается при изменении размера (от DynamicUI)
     */
    public override onResize(newSize: Size = new Size()): void {
        super.onResize(newSize);

        GameOrientation.setResize(newSize);

        // Определяем ориентацию
        const isPortrait = GameOrientation.isPort;

        // Выбираем соответствующую группу
        const targetGroup = isPortrait ? this.portraitSettings : this.landscapeSettings;

        // Вычисляем текущее соотношение сторон
        const currentAspectRatio = (Math.max(newSize.width, newSize.height) / Math.min(newSize.width, newSize.height)) + 0.01;

        // Находим подходящие настройки
        const matchedSettings = this.findMatchingSettings(targetGroup, currentAspectRatio);

        if (matchedSettings) {
            this._currentSpacingX = matchedSettings.spacingX;
            this._currentSpacingY = matchedSettings.spacingY;
            this._currentPadding = matchedSettings.padding;
        } else {
            // Используем настройки по умолчанию
            this._currentSpacingX = this.defaultSpacingX;
            this._currentSpacingY = this.defaultSpacingY;
            this._currentPadding = this.defaultPadding;
        }

        this.updateLayout();
    }

    /**
     * Находит подходящие настройки на основе соотношения сторон
     */
    private findMatchingSettings(group: GridGroup, currentAspectRatio: number): GridSettings | null {
        if (!group.settings || group.settings.length === 0) {
            return null;
        }

        // Сортируем настройки по соотношению сторон (от меньшего к большему)
        const sortedSettings = [...group.settings].sort((a, b) => {
            const ratioA = getAspectRatioValue(a.aspectRatio);
            const ratioB = getAspectRatioValue(b.aspectRatio);
            return ratioA - ratioB;
        });

        // Находим наибольшую настройку, где соотношение сторон <= текущего
        let bestMatch: GridSettings | null = null;
        for (const settings of sortedSettings) {
            const settingsAspectRatio = getAspectRatioValue(settings.aspectRatio);
            if (settingsAspectRatio <= currentAspectRatio) {
                bestMatch = settings;
            } else {
                break;
            }
        }

        // Если не нашли подходящую, используем первую (с минимальным соотношением)
        if (!bestMatch && sortedSettings.length > 0) {
            bestMatch = sortedSettings[0] ?? null;
        }

        return bestMatch;
    }

    private onChildChanged(): void {
        this.scheduleOnce(() => this.updateLayout(), 0);
    }

    private onSizeChanged(): void {
        this.updateLayout();
    }

    /**
     * Основной метод обновления расположения элементов
     */
    public updateLayout(): void {
        const children = this.node.children;
        if (children.length === 0) return;

        if (!this._containerTransform) {
            this._containerTransform = this.node.getComponent(UITransform);
        }

        if (!this._containerTransform) {
            console.error('AdaptiveGridCorrector: UITransform отсутствует на контейнере!');
            return;
        }

        const containerWidth = this._containerTransform.width - this._currentPadding * 2;
        const containerHeight = this._containerTransform.height - this._currentPadding * 2;

        // Получаем размеры первого дочернего элемента как эталон
        const firstChildTransform = children[0]?.getComponent(UITransform);
        if (!firstChildTransform) {
            console.warn('AdaptiveGridCorrector: Дочерние элементы должны иметь UITransform.');
            return;
        }

        const childWidth = firstChildTransform.width;
        const childHeight = firstChildTransform.height;
        const childCount = children.length;

        // Вычисляем оптимальное количество колонок
        const { columns } = this.calculateOptimalGrid(
            containerWidth,
            containerHeight,
            childWidth,
            childHeight,
            childCount
        );

        // Вычисляем фактические размеры сетки
        const actualRows = Math.ceil(childCount / columns);
        const totalWidth = columns * childWidth + (columns - 1) * this._currentSpacingX;
        const totalHeight = actualRows * childHeight + (actualRows - 1) * this._currentSpacingY;

        // Начальные координаты для центрирования
        const startX = -(totalWidth / 2) + childWidth / 2;
        const startY = totalHeight / 2 - childHeight / 2;

        // Размещаем элементы
        for (let i = 0; i < childCount; i++) {
            const child = children[i];
            if (!child) continue;

            const col = i % columns;
            const row = Math.floor(i / columns);

            const posX = startX + col * (childWidth + this._currentSpacingX);
            const posY = startY - row * (childHeight + this._currentSpacingY);

            child.setPosition(new Vec3(posX, posY, 0));
        }
    }

    /**
     * Рассчитывает оптимальное количество колонок и строк для размещения элементов
     */
    private calculateOptimalGrid(
        containerWidth: number,
        containerHeight: number,
        childWidth: number,
        childHeight: number,
        childCount: number
    ): { columns: number; rows: number } {
        // Базовый расчёт колонок на основе ширины контейнера
        let columns = Math.max(1, Math.floor((containerWidth + this._currentSpacingX) / (childWidth + this._currentSpacingX)));
        let rows = Math.ceil(childCount / columns);

        // Проверяем, помещаются ли все строки по высоте
        let requiredHeight = rows * childHeight + (rows - 1) * this._currentSpacingY;

        // Если не помещается - добавляем больше колонок
        while (rows > 1 && requiredHeight > containerHeight) {
            columns++;
            rows = Math.ceil(childCount / columns);
            requiredHeight = rows * childHeight + (rows - 1) * this._currentSpacingY;
        }

        return { columns, rows };
    }
}
