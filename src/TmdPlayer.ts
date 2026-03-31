export class TmdPlayer {
  readonly playerId: string;
  readonly name: string;

  constructor(playerId: string, name: string) {
    this.playerId = playerId;
    this.name = name;
  }
}
