// How the bookcase is shown: shared by the toolbar (main bundle) and the 3D scene (loaded later).
import { create } from 'zustand';

export type Camera = 'front' | 'angle' | 'side';
export const useView = create<{ camera: Camera; dims: boolean; open: boolean; nonce: number }>(() => ({ camera: 'angle', dims: false, open: false, nonce: 0 }));

/** Same viewpoint asked again: the scene flies back to it after the visitor has turned the view. */
export const setCamera = (camera: Camera) => { useView.setState((s) => ({ camera, nonce: s.nonce + 1 })); };
export const toggleDims = () => { useView.setState((s) => ({ dims: !s.dims })); };
export const toggleOpen = () => { useView.setState((s) => ({ open: !s.open })); };

/** Set by the 3D scene once it renders: returns a PNG of the current view. */
let capturer: (() => string) | null = null;
export const setCapturer = (fn: (() => string) | null) => { capturer = fn; };
export const capture = () => capturer?.() ?? null;
