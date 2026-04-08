import { Color, Component, error, Label, Node, screen, Sprite, Tween, tween, UIOpacity, UITransform, Vec2 } from "cc";

export function first<T>(arr: T[]) {
    return arr[0];
}

export function last<T>(arr: T[]) {
    return arr[arr.length - 1];
}

export function isEmpty<T>(arr: T[] | string) {
    return arr.length == 0;
}

export function Map_find<K, V>(map: Map<K, V>, pred: (k: K, v: V) => boolean): { k: K, v: V } | undefined {
    let value = undefined;
    for (const kv of map) {
        if (pred(kv[0], kv[1])) {
            value = { k: kv[0], v: kv[1] };
            break;
        }
    }
    return value;
}

export function getChildByPath(parent: Node, path: string): Node | null {
    const child = parent.getChildByPath(path);
    if (!child) {
        error("child by path (", path, ") not found, parent: ", parent.name);
        return null;
    }
    return child;
}

export function getChildByName(parent: Node, name: string): Node | null {
    const child = parent.getChildByName(name);
    if (!child) {
        error("child by name (", name, ") not found, parent: ", parent.name);
        return null;
    }
    return child;
}

declare type Constructor<T = unknown> = new (...args: any[]) => T;
declare type AbstractedConstructor<T = unknown> = abstract new (...args: any[]) => T;

export function getComponentInChildByName<T extends Component>(parent: Node, name: string, type: Constructor<T> | AbstractedConstructor<T>): T | null {
    const node = parent.getChildByName(name);
    if (!node) {
        error("getComponentInChildByName(parent: ", parent.name, ", name: ", name, ", type: ", type.name, ") failed, child not found");
        return null;
    }

    const comp = node.getComponent(type);
    if (!comp) {
        error("getComponentInChildByName(parent: ", parent.name, ", name: ", name, ", type: ", type.name, ") failed, component in ", node.name, " not found");
        return null;
    }

    return comp as T;
}

export function getComponentInChildByPath<T extends Component>(parent: Node, path: string, type: Constructor<T> | AbstractedConstructor<T>): T | null {
    const node = parent.getChildByPath(path);
    if (!node) {
        error("getComponentInChildByPath(parent: ", parent.name, ", path: ", path, ", type: ", type.name, "), failed, child not found");
        return null;
    }

    const comp = node.getComponent(type);
    if (!comp) {
        error("getComponentInChildByPath(parent: ", parent.name, ", name: ", path, ", type: ", type.name, "), component in ", node.name, " not found");
        return null;
    }

    return comp as T;
}

export function rfind<T>(arr: Array<T>, pred: (comp: T) => boolean): T | undefined {
    let value = undefined;
    for (let i = arr.length - 1; i >= 0; --i) {
        if (pred(arr[i]!)) {
            value = arr[i]!;
            break;
        }
    }
    return value;
}

export function colorTween(target: Sprite | Label, dst: Color, time = 0.3): Tween<Color> {
    const color = target.color.clone();
    return tween(color)
        .to(time, { x: dst.x, y: dst.y, z: dst.z, a: dst.a },
            {
                onUpdate() {
                    target.color = color.clone();
                }
            })
}

export function opacityTween(target: Node, time: number, to: number, from?: number): Tween<UIOpacity> {
    let opacity = target.getComponent(UIOpacity);
    if (!opacity)
        opacity = target.addComponent(UIOpacity);
    Tween.stopAllByTarget(opacity);
    if (from === undefined)
        from = opacity.opacity;
    opacity.opacity = from;
    return tween(opacity).to(time, { opacity: to });
}

export function transformAnchorPoint(target: UITransform, to: Vec2): void {
    const size = target.contentSize;
    const anchorPoint = target.anchorPoint.clone();
    target.setAnchorPoint(to);

    const diff = to.clone().subtract(anchorPoint);
    const pos = target.node.getPosition();

    pos.x += diff.x * size.x;
    pos.y += diff.y * size.y;

    target.node.setPosition(pos);
}


export type Milliseconds = number;

export function timeToMillis(hours: number, minutes: number, seconds: number): Milliseconds {
    seconds = (minutes + hours * 60) * 60 + seconds;
    return seconds * 1000;
}

export function timeMillisToSeconds(millis: Milliseconds): number {
    return millis / 1000;
}

export function timeMillisToMinutes(millis: Milliseconds): number {
    return millis / 1000 / 60;
}

export function timeMillisToHours(millis: Milliseconds): number {
    return millis / 1000 / 60 / 60;
}

export function timeToString(milli: Milliseconds): string {
    let seconds = timeMillisToSeconds(milli);
    seconds = Math.abs(Math.ceil(seconds));
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;

    if (minutes <= 0) {
        return seconds.toString() + "s";
    }
    else {
        const hours = Math.floor(minutes / 60);
        if (hours <= 0) {
            return minutes.toString() + "m " + seconds.toString() + "s";
        }
        else {
            const days = Math.floor(hours / 24);
            if (days <= 0) {
                return hours + "h " + (minutes - 60 * hours).toString() + "m";
            }
            else {
                return days + "d " + (hours - 24 * days).toString() + "h";
            }
        }
    }
}

export function timeToStringDotted(time: number, isMilli: boolean): string {
    if (time < 0)
        return "00:00";

    let seconds = isMilli ? timeMillisToSeconds(time) : time;
    seconds = Math.abs(Math.ceil(seconds));
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let secondsStr = "";
    if (seconds < 10)
        secondsStr += "0";
    secondsStr += seconds.toString();
    return minutes.toString() + ":" + secondsStr;
}

export function timeToStringDottedHours(milli: Milliseconds): string {
    let seconds = timeMillisToSeconds(milli);
    seconds = Math.abs(Math.ceil(seconds));

    const hours: number = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes: number = Math.floor(seconds / 60);
    seconds = seconds % 60;

    const strHours = (hours > 0 ? hours + ":" : "");
    const strMinutes = (minutes > 0 ? (minutes < 10 ? "0" : "") + minutes : "00");
    const strSeconds = (seconds < 10 ? "0" : "") + seconds;

    return strHours + strMinutes + ":" + strSeconds;
}


export function remap(source: number, sourceFrom: number, sourceTo: number, targetFrom: number, targetTo: number) {
    return targetFrom + (source - sourceFrom) * (targetTo - targetFrom) / (sourceTo - sourceFrom);
}

export function getScreenAspect(): number {
    return screen.windowSize.x / screen.windowSize.y;
}

export function getOpacityComp(node: Node): UIOpacity {
    let opacity = node.getComponent(UIOpacity);
    if (!opacity)
        opacity = node.addComponent(UIOpacity)!;
    return opacity;
}

export function getOpacity(node: Node): number {
    let opacity = node.getComponent(UIOpacity);
    if (!opacity)
        opacity = node.addComponent(UIOpacity)!;
    return opacity.opacity;
}

export function setOpacity(node: Node, value: number): void {
    let opacity = node.getComponent(UIOpacity);
    if (!opacity)
        opacity = node.addComponent(UIOpacity)!;
    opacity.opacity = value;
}


export function playerInfoGetObject<T>(key: string): T | undefined {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
}

export function playerInfoGetInt(key: string): number | undefined {
    const value = localStorage.getItem(key);
    return value ? parseInt(value) : undefined;
}

export function playerInfoGetBool(key: string): boolean | undefined {
    const value = localStorage.getItem(key);
    return value ? Boolean(parseInt(value)) : undefined;
}

export function playerInfoGetFloat(key: string): number | undefined {
    const value = localStorage.getItem(key);
    return value ? parseFloat(value) : undefined;
}

export function playerInfoGetString(key: string): string | undefined {
    return localStorage.getItem(key) ?? undefined;
}

export function playerInfoSet(key: string, value: number | string | boolean | object | undefined) {
    if (value === undefined) {
        console.log("player info reset key: ", key);
        localStorage.removeItem(key);
    }
    else {
        if (typeof value === 'boolean')
            value = Number(value);
        else if (typeof value === 'object')
            value = JSON.stringify(value);

        console.log("player info set key: ", key, ", value: ", value);
        localStorage.setItem(key, typeof value === 'string' ? value : value.toString());
    }
}

export function swap<T>(arr: T[], a: number, b: number): void {
    const temp = arr[a]!;
    arr[a] = arr[b]!;
    arr[b] = temp;
}

export function swapWithLast<T>(arr: T[], a: number): void {
    swap(arr, a, arr.length - 1);
}

export function swapWithFirst<T>(arr: T[], a: number): void {
    swap(arr, a, 0);
}

export function swapFirstWithLast<T>(arr: T[]): void {
    swap(arr, 0, arr.length - 1);
}
export function isObject(obj: any): boolean {
    return obj !== null && typeof obj === 'object';
}

export function secsToString(seconds: number): string {
    seconds = Math.abs(Math.ceil(seconds));
    const hours: number = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes: number = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return (hours > 0 ? hours + ":" : "") +
        (minutes > 0 ? (minutes < 10 ? "0" : "") + minutes : "00") + ":" +
        (seconds < 10 ? "0" : "") + seconds;
}

export function shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr]; // создаем копию массива
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

