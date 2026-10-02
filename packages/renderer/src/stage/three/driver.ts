import type { StageSample } from '../model/sampler';

export type SampleConsumer = (sample: StageSample) => void;

/**
 * One sample per rendered frame, handed to every part of the scene in the
 * order they registered (bodies before the edges and labels that hang off
 * them). Parts never sample on their own, so they can never disagree.
 */
export class StageDriver {
  private consumers: SampleConsumer[] = [];

  register(consumer: SampleConsumer): () => void {
    this.consumers.push(consumer);
    return () => {
      this.consumers = this.consumers.filter((c) => c !== consumer);
    };
  }

  publish(sample: StageSample): void {
    for (const c of this.consumers) c(sample);
  }
}
