# Keyboard-only Walkthrough: Playback Controls

## Overview
This document verifies the implementation of Task T7: Playback control feedback and keyboard focus.

## Verification Steps
1. **Load a Program**: Open the playground and load an example program (e.g. Array Reversal). Wait for it to compile and run.
2. **Tab Navigation**:
   - Press `Tab` repeatedly until focus moves into the visualizer playback controls.
   - Verify that the `Step back`, `Play`/`Pause`/`Replay`, and `Step forward` buttons receive a high-contrast focus ring (2px solid cream with a 2px offset).
3. **Keyboard Activation**:
   - With focus on the `Play`/`Pause` button, press `Space` or `Enter`.
   - Verify the state toggles visually (icon changes from Play to Pause and vice versa, background matches the playing state).
   - Press `Tab` to focus on the `Step forward` button. Press `Enter` to step forward.
4. **Active/Pressed State**:
   - While pressing `Enter` or `Space` on any transport button, verify it shrinks slightly (`scale(0.92)` for small buttons, `scale(0.96)` for the play button) and its background color darkens, indicating a clear "pressed" state.
5. **Scrubber Focus**:
   - Press `Tab` to reach the scrubber. Verify the scrubber thumb scales up (`scale(1.25)`) and shows the focus ring.
6. **Disabled States**:
   - Clear the editor to remove the loaded program.
   - Verify the transport controls remain visible but are styled as explicitly disabled (`opacity: 0.4`, `cursor: not-allowed`), preventing interaction and clearly indicating the empty state.

## Conclusion
All criteria for T7 are met. Controls are fully keyboard-navigable with distinct hover, pressed, disabled, and focus states.
