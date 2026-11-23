import type { Action } from '../sim/player.ts';

export type Command = Action | 'pause' | 'confirm';
export type Device = 'touch' | 'keyboard' | 'gamepad';
export type CommandHandler = (cmd: Command, device: Device) => void;
