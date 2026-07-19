import { AlgorithmHandler } from './AlgorithmContext';

export class AlgorithmRegistry {
  private static handlers: Map<string, AlgorithmHandler> = new Map();

  public static register(actionNames: string[], handler: AlgorithmHandler) {
    for (const name of actionNames) {
      this.handlers.set(name, handler);
    }
  }

  public static getHandler(actionName: string): AlgorithmHandler | undefined {
    return this.handlers.get(actionName);
  }
}
