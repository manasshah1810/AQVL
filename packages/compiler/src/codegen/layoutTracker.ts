/**
 * Tracks which structures received an explicit `LAYOUT` statement in
 * source, so the generator's default-layout backfill
 * (`AQIRGenerator.generateDefaultLayout`) can skip any target that already
 * has one — see docs/design/aqir-geometry-spec.md §4 (backward
 * compatibility). Populated by a pre-scan of the SEQUENCE block before
 * DECLARE processing runs, then consulted (and added to) as explicit
 * `LAYOUT` statements are generated in program order.
 */
export class LayoutTracker {
  private explicitTargets = new Set<string>();

  /** Records that `targetId` has (or will have) an explicit LAYOUT statement. */
  public markExplicit(targetId: string): void {
    this.explicitTargets.add(targetId);
  }

  /** True if `targetId` already has an explicit LAYOUT statement — the default-layout backfill must skip it. */
  public hasExplicitLayout(targetId: string): boolean {
    return this.explicitTargets.has(targetId);
  }

  public reset(): void {
    this.explicitTargets.clear();
  }
}
