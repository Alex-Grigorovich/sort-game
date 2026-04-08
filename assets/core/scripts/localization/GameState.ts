import { _decorator, Canvas, Component, SpriteFrame } from 'cc';

export interface GameState {
    canvas: Canvas,
    component: Component,
    localizedAssets: { [key: string]: SpriteFrame },
    skinnedAssets: { [key: string]: SpriteFrame },
}

//@ts-ignore
export const GameState: GameState = {};




