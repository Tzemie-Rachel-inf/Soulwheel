# Routes

No router. One page (`/`, index.html -> src/main.tsx -> src/App.tsx) with ARIA tabs held in React state:

| Tab | Component | Renders |
|---|---|---|
| Create | `CreateTab` in src/App.tsx | Wheel title, the spinning wheel (FateWheels/SpinWheel canvas with gold rim + gules hub), result reveal plaque (RollReveal), seed panel, odds list |
| Adventures | src/ui/AdventureTab.tsx | The hero's road: same wheel + reveal, battle HUD, quest/stakes panels |
| Chronicle | src/ui/ChronicleTab.tsx | World record: graveyard, hall of fame, houses |
| Settings | src/ui/SettingsTab.tsx | Spell mode, pacing |
| Wheels (dev) | src/devtools/WheelInspector.tsx | Dev wheel browser |

Right column (lg+): CharacterCard (gilt-framed hero card) + WorldPanel.
