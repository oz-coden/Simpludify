# Unified input: migration and validation

## Source of truth

Before unification, InputState held an aggregate physical-key set and immutable InputReader frames. KeyboardController converted that frame using KeyMap/Movement while ActionController independently captured logical values and Button transitions. Game scanned Actors for KeyboardController keys in addition to accepting Action bindings. Character and older games still required the physical path.

Now the only gameplay path is:

1. Game's BrowserInput validates physical codes and writes one KeyboardSource. Touch/AI write typed logical ActionSources.
2. InputSystem owns device contributions and registers ActionController boundary participants. It has no implicit scripted writer, physical frame cache, direction calculator or aggregate key-count state.
3. ActionController alone resolves bindings, composes logical values and retains ordered Button transitions. Its immutable frame is captured for every active controller before any input callback runs.
4. Game Components explicitly read their controller or a kind-typed ActionReader. ActionMovement copies an Axis2D reader into Motion. No Action name is prescribed by the engine.

The remaining device-key sets and logical Action values are different facts, not alternative gameplay state stores. Keyboard aliases are ORed across devices, then combined with logical sources according to the existing Button/Axis contracts. Both source handle types share OwnedInputSource for lifetime, clear/dispose and late-neutral-write behavior. Actual Button/Axis composition remains solely in ActionController.

## Removed and retained APIs

| API                                                       | Result                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| InputState, InputReader, InputSource                      | Removed; no raw gameplay state or implicit scripted writer                             |
| KeyMap, KeyMaps, Movement                                 | Removed; KeyboardBindings contains only frozen Axis2D physical binding data            |
| KeyboardController                                        | Replaced by ActionMovement with explicitly injected Axis2D ActionReader                |
| UpdateContext.input                                       | Removed; inject only the Action dependency a Component needs                           |
| Character movement/keys                                   | movement is an optional ActionReader<"axis2d">; keys option removed                    |
| ActionController / ActionSource / defineActions / KeyCode | Retained with existing typed bindings, edge, source and config contracts               |
| InputSystem / KeyboardSource                              | Engine/device routing boundary; typed keyboard adapter and physical-binding tests only |
| BrowserInput                                              | One Game-owned keyboard adapter, accepts active Action bindings only                   |

KeyboardSource is still public so a non-DOM keyboard adapter and physical-binding regression can exercise exactly the same device boundary as Web. It is write-only; it cannot move a Character or supply a raw UpdateContext reader. Ordinary game developers do not need it. Its small maintenance surface is KeyCode validation and the shared source lifetime, not a legacy keyboard game controller. Custom device axes use ActionSource rather than invented key strings. Game already owns BrowserInput; attaching a second one is unnecessary.

## Samples

All six gallery entries retain their existing presentation and game rules. Character, UI/Scenes and Beacon Field explicitly create an ActionController and inject its reader. Signal Run uses ActionMovement, reads the same Move Action to cancel pointer destinations, and writes touch/automation as logical vectors. Blockfall retains ordered command Buttons and game-owned repeat timing. Prism Raid removes its redundant Steering Component in favor of ActionMovement; continuous/short-tap fire and its logical-input autopilot remain game rules. Headless and maintained benchmark entry points were migrated too.

## Remaining review topics

The existing lifecycle regressions still cover disposal during initial activation, dependent Component teardown and phase-independent timers. Repeating timers retain fractional time, drop missed repetitions and invoke at most once per step. This revision does not redesign them.

Renderable investigation: visibility/opacity/zIndex/Transform are live; width/height/color/sprite/shape/fit are immutable. Renderer reconciliation uses component identity and Scene structural revision, so merely adding public setters would leave stale graphics or asynchronous image races. Replacing a Renderable also requires removing dependent Components first. This is a real limitation for animated/custom visuals, but no sample needs a visual mutation API to finish input unification. A separate bounded task should define atomic visual updates, revision tracking, image cancellation and resource tests before adding setters. Sprite sheets/animation remain outside this revision.

Text remains a Web editing stream. [The native typing recipe](action-input.md#text-and-typing-games) covers input/composition, focus and committed-value deduplication. No new parallel key-based text system or TextInput widget is introduced. OS IME UI and physical mobile software keyboards require further device testing.

## Validation status

Implementation checkpoint: typed source and unit checks pass; complete browser/site/build validation and isolated benchmark recording are in progress. No deployment is implied by this checkpoint. Final measurements and commands will be recorded here after verification.
