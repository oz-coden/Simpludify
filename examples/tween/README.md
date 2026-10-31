# Tween lab

Run `npm run dev -- --example tween` or choose Tween lab in the documentation gallery. Standard Scene, Actor, SpriteAnimation, Canvas UI and Tween APIs build the sample; game code does not manage DOM or Pixi objects.

The three lanes compare Linear, OutCubic and InOutCubic. WASD moves the sprite's world position while its draw offset animates independently. The second lane also rotates, scales and fades. Pause game freezes simulation while display-time UI, Slider and HP animations continue. Pause/Resume tweens retain claims; Cancel all releases them. Finish finite completes finite recipes. Sequence/Parallel demonstrates child timing and channel replacement.

Fade/Slide UI moves a subtree and its native text editor. Tween value to 80 changes the Slider's actual value (program events); dragging takes control immediately. Damage HP changes logical HP immediately, with a read-only bar that catches up through displayValue. Tween plain state animates an ordinary numeric record. Leave/Recreate Scene exercises automatic cleanup.

Draw offsets do not move collision bodies. Canvas presentation supports translation/opacity only. Native editor geometry is tested automatically; real OS IME and physical mobile keyboards require separate device validation. See [Tween reference](../../docs/tween.md) for time, ownership, conflict and error contracts.
