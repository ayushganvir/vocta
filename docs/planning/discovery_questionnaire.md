# MVP Decision Questionnaire

Use this as the practical fill-in questionnaire for Vocta. Tick options, add short notes, and give examples where useful.

Status for each answer: `[ ] Decision` `[ ] Assumption` `[ ] Open` `[ ] Deferred`

For notes marked `EXPLAIN`, `didn't understand`, or similar, see [Questionnaire Explanations](./questionnaire_explanations.md).

## 1. MVP Outcome

| Decision | Options |
|---|---|
| MVP must prove | [ ] Source -> panels [ ] Entity consistency [ ] Asset generation [ ] Asset selection [ ] Ordered export [ ] Debug traceability | yes all
| First demo path | [ ] Raw idea [ ] Full script [ ] Narration  yes all
| Export incomplete projects | [y] Yes with warnings [ ] No [ ] Selected panels only |
| Export blockers | [ ] Missing video [ ] Missing audio [ ] Missing image [ ] Stale warnings [y ] Nothing blocks |

Example:

```text
one internal session.
Answer:
```

## 2. Human Control Rules

Confirm:

- [this should be configurable, user click only by default ] Every AI action requires a visible user click.
- [yes ] AI suggestions do not mutate creative state until applied.
- [yes ] Chat suggestions require Apply.
- [depends on user preference ] No automatic regeneration.
- [ didnt understand please explain] Stale warnings are allowed automatically.
- [ what is batch here, i would only want one asset generated i do not want to replace it ai responses are quite accurate these days, i may cahnge the prompt to replace the image] Batch generation requires explicit selection and click.
- [each panel would have a single asset that would be used in video , so it should be exported ] Only selected assets enter export.

Asset auto-select:

- [ ] Never
- [y, as only one generation happens ] Only first generated candidate
- [ ] Ask user after generation

Example:

```text
Example: Narration changed -> audio marked stale -> user manually regenerates.
Answer:
```

## 3. Users and Permissions

| Decision | Options |
|---|---|
| MVP users | [ ] Producer [y ] Prompt operator [ ] Audio operator [ ] Editor handoff [y ] Developer [ y] Admin |
| Permissions | [y ] Everyone can do everything [ ] Export restricted [ ] Debug restricted [ ] Basic roles |
| Debug access | [y ] Everyone [ ] Developers [ ] Project owners [ ] Env flag |
| Collaboration | [y ] Single-user enough [ ] Small team async [ ] Real-time needed |

First users:

```text
Example: Ayush - product/debug, Riya - editor handoff.
Answer:
```

## 4. Project Setup

| Decision | Options |
|---|---|
| Aspect ratio | [ ] Always 9:16 [ ] Default 9:16, editable | EDITABLE
| Duration | [ ] Always 2-4 min [ ] Default editable [ y] No project duration | 
| Language | [y ] English [y] Hindi [ ] Multiple [ ] Not needed |
| Statuses | [y ] Draft [ ] Active [ ] Ready [ ] Exported [ y] Archived |
| Archived projects | [ ] Read-only [ ] Editable [ y] Later |

Example:

```text
Example: Hindi narration, English internal prompts, target 180 seconds.
Answer:
```

## 5. Source Material

| Decision | Options |
|---|---|
| Source types | [ ] Idea [ ] Notes [ y] Script [ ] Narration [ y] Images [ ] Videos [ ] Audio [ ] Links [ ] PDF/docs [ ] Other files |
| Most common start | [ ] Idea [ y] Script [ ] Narration [ ] Notes [ ] Mixed |
| Previews | [ y] Image thumbnails [y ] Video thumbnails [y ] Video playback [ ] Audio playback [ ] None first |
| Link handling | [ ] Store link only [ ] Fetch after click [ ] Summarize after click | EXPLAIN

Upload limits:

```text
Images: one, or start and end frame
Videos: 0
Audio: 0
Other: 0
```

Example:

```text
Example: Paste 1,200-word script, upload 5 images, add 2 YouTube links.
Answer:
```

## 6. Analyze Story

When user clicks `Analyze Story`, produce:

- [ y] Story summary
- [y ] Entities
- [y ] Style suggestions
- [y ] Scene structure
- [y ] Panel structure
- [ ] Narration improvements
- [ ] Estimated duration
- [ ] Warnings

Apply mode:

- [ ] Apply all
- [y ] Apply section by section
- [y ] Apply individual suggestions

Example:

```text
Example: Output 5 scenes, 22 panels, 3 characters, 2 places, dark cinematic style.
Answer:
```

## 7. Style Bible

Fields:

- [ y] Characters
- [y ] Places
- [y ] Objects
- [y ] Visual style
- [y ] Color palette
- [y ] Lighting
- [y ] Camera style
- [ ] Negative prompt rules
- [ ] Global references
- [ ] Brand/style notes

Required before generation:

- [ ] Nothing; warnings only
- [ ] Visual style
- [ ] Negative prompt
- [ ] At least one global reference
- [ ] Other: _______________

When Style Bible changes:

- [ y] Mark all panel prompts/assets stale
- [ ] Affect future generations only
- [ ] Warning only

Example:

```text
Example: Cinematic Indian mythological realism, warm temple light, teal shadows, no cartoon, no distorted hands.
Answer:
```

## 8. Entities and References

| Decision | Options |
|---|---|
| Entity types | [y ] Character [ y] Place [ y] Object [ ] Extra type: ______ |
| Future custom types | [y ] Backend supports later [ ] No |
| Entity fields | [ y] Name [ y] Type [ ] Description [ y] Visual prompt [ ] Notes [ ] One selected reference [ ] Metadata |
| Reference required | [ y] Required [ ] Warning only [ ] Optional |
| Delete mapped entity | [ ] Block [y ] Warn [ ] Allow |

Example:

```text
Name: Aarav
Type: Character
Description: Young historian, serious, observant.
Visual prompt: Indian man in late 20s, linen shirt, tired eyes, consistent face/hair.
Reference: aarav_ref_01.png
```

## 9. Entity Extraction and Mapping - Explain all 

| Decision | Options |
|---|---|
| Extract from | [ ] All sources [ ] Selected sources [ ] Existing panels [ ] Script/narration only |
| Extraction output | [ ] Draft list [ ] Duplicate detection [ ] Type suggestion [ ] Visual prompt [ ] Source rationale |
| Mapping scope | [ ] All panels [ ] Selected panels [ ] One scene |
| Apply mappings | [ ] Replace [ ] Merge [ ] Ask per panel [ ] Never auto-apply |
| Show mapping details | [ ] Confidence [ ] Rationale [ ] Missing refs [ ] Unmapped panels/entities |

Example:

```text
Panel: Aarav enters the flooded temple.
Mapped: Aarav, Flooded Temple, Ancient Lantern.
Notes: Keep face consistent; use temple reference.
```

## 10. Scenes and Panels

| Decision | Options |
|---|---|
| Scenes | [ y] Required [ ] Optional grouping [ ] Not MVP |
| Ordering | [ ] Global panel order [ y] Scene order [ ] Both |
| Numbering | [ ] Renumber on reorder [ y] Preserve original [ ] Show order + stable ID |
| Operations | [ y] Create [ y] Delete [ y] Duplicate [ y] Reorder [ ] Split [ ] Merge [ y] Edit text/prompts/references [ ] Swap selected assets |

Generation requirements:

```text
Before image generation require: prompt exists + at least one image reference, or prompt exists + no images
Before video generation require: prompt exists + at least one image reference, or prompt exists + no images
Before voice generation require: prompt + voiceover exists 
```

Example:

```text
Panel 012
Title: Aarav enters the flooded temple
Narration: Aarav stepped through the broken archway...
Visual: Wide shot of flooded stone temple interior.
Motion: Slow push-in, water ripples, torch flicker.
Target duration: 8 seconds.
```

## 11. Prompt System

Prompt layers:

- [ y] Global project intent
- [ y] Source material summary
- [ y] Story context
- [ y] Style Bible
- [y ] Entity references
- [ y] Scene context
- [ y] Panel context
- [ y] User notes/manual edits
- [ ] Model-specific formatting

Editable in normal mode:

- [ y] Structured fields only
- [ y] User notes
- [ y] Prompt layers
- [ ] Raw final prompt
- [ ] Negative prompt

Raw override:

- [ y] No
- [ ] Per panel
- [ ] Per asset type
- [ ] Per job

Debug prompt inspector shows:

- [ y] Final prompt
- [ y] Layer breakdown
- [ y] References
- [ y] Request payload
- [ y] Response summary
- [ y] Cost/token estimate

Example:

```text
Generate a 9:16 cinematic keyframe of Aarav entering the flooded temple. Maintain Aarav's face from reference. Use warm torchlight and teal shadows. Avoid cartoon style and distorted hands.
```

## 12. Generation Modes

| Decision | Options |
|---|---|
| Image candidates/click | [ y] 1 [ ] 2 [ ] 4 [ ] User chooses |
| Image references | [ y] Entity refs [ y] Panel refs [ ] Global refs [ ] User chooses |
| First/last frame | [ ] Required before video [ y] Optional [ ] Not MVP |
| Video inputs | [ ] Prompt only [ ] Selected image [ ] First/last [ ] Motion prompt [ ] Entity refs if supported [ ] Audio if supported | Video Input not required
| Default video duration | [ ] 4 sec [ ] 6 sec [ ] 8 sec [ ] Narration estimate [ ] User-entered | Narration + script estimate
| Provider limitations | [ ] Hide unsupported controls [ ] Disable with explanation [ ] Show warning | Show warning but not disable

## 13. Voiceover and Lip-Sync Strategy

| Decision | Options |
|---|---|
| Voice provider | [ ] Google TTS [ y] Google Voice [ ] Other:  ______ |GOogle Voice
| Voice selection | [ ] Project-level [ ] Panel override [ ] Per character | Project level, there could be multiple speakers, so when ai entity creates character, it should create character with voices that can be previewd, and also include the narrator as a speaker as well and to be added as an entity, but narrators wont have images, so lets keep the people entity to suppor this
| Pace | [ ] Slow/normal/fast [ ] Numeric [ ] Free text | Mentioned in the script, in Slow/normal/fast, with tone and emotion
| Emotion | [ ] Presets [ y] Free text [ ] Not MVP | Free text
| Audio format | [ ] WAV [ ] MP3 [y ] Both | 
| Sync metadata | [ ] Narration [ ] Pace [ ] Emotion [ ] Target duration [ ] Audio duration [ ] Video duration [ ] Editor notes | EXPLAIN

Example:

```text
Voice: Hindi male narrator. Pace: slow. Emotion: suspenseful. Output: WAV.
```

## 14. Asset History and Selection

| Decision | Options |
|---|---|
| Selected per panel | [ y] One image [ ] One video [y ] One audio [ y] One first frame [y ] One last frame |
| Asset states | [y ] Selected/not selected only [ ] Maybe [ ] Rejected [ ] Approved |
| New selection | [y ] Auto-deselect previous [ ] Ask confirmation [y ] Allow multiple only for first last frame |
| Deletion | [ ] None [ ] Soft delete [ y] Admin hard delete |
| Reuse across panels | [ ] Yes [ ] No [y ] Later |
| Export unselected assets | [y ] No [ ] Optional debug folder [ ] Yes |

## 15. Jobs and Queue

Job types:

- [y ] Story analysis
- [ y] Style Bible draft
- [ y] Entity extraction
- [y ] Scene/panel split
- [y ] Entity mapping
- [y ] Prompt generation/enhancement
- [y ] Image generation
- [y ] Video generation
- [y ] Audio generation
- [y ] Export package

Concurrency:

- [ ] Use defaults: prompt 10, image 5, video 2, audio 3 , DIDNT UNDERSTAND PLS EXPLAIN
- [ ] Custom: 

```text
Prompt:
Image:
Video:
Audio:
```

Queue behavior: EXPLAIN THESE

- [ ] Polling updates
- [ ] SSE updates
- [ ] WebSockets
- [ ] Manual retry only
- [ ] Auto-retry technical failures
- [ ] Cancel queued jobs
- [ ] Cancel running jobs if supported

## 16. Debug Mode

Show:

- [ y] Final prompt, colored showing which can from which layer
- [ y] Layers
- [ y] References
- [ y] Provider/model
- [ y] Request payload
- [ y] Response summary
- [ y] Error payload
- [ y] Logs
- [ y] Token usage
- [ y] Cost estimate
- [ y] Generation time
- [ ] Provider request ID

Payload storage:

- [ ] Store redacted payload
- [ ] Store full payload, redact on display
- [ ] Store summary only

Never display:

- [ ] API keys
- [ ] Auth headers
- [ ] Signed URL secrets
- [ ] Sensitive user data

Debug UI:

- [ ] Right sidebar
- [ ] Panel detail tab
- [ ] Job drawer
- [ ] Separate screen

## 17. Scoped Chat

| Decision | Options |
|---|---|
| Chat scopes | [y ] Project [ y] Entity [y ] Scene [y ] Panel |
| Chat suggests | [] Narration [ ] Visual intent [ ] Motion intent [ ] Prompts [ ] Entity edits [ ] Style Bible [ ] Entity mappings | 
Lets keep these configuraable


| Apply behavior | [ ] Never direct mutation [ ] Apply whole card [ ] Apply field by field | DIDNT UNDERSAND EXPLAIN

Example:

```text
User: Make this panel more emotional.
AI suggests narration + visual intent + prompt note.
User applies narration only.
```

## 18. Stale State

Create stale warnings when:

- [ y] Entity description/reference changes
- [ y] Style Bible changes
- [ y] Narration changes
- [ y] Visual/motion intent changes
- [ y] Prompt layer changes
- [ y] References change
- [ y] Panel reorder/split/merge
- [ ] Model Stack changes
- [ y] Source material changes

Show stale warnings:

- [y ] Panel cards
- [ y] Panel detail
- [ y] Asset cards
- [ y] Export readiness
- [ ] Manifest
- [ ] Debug only

Resolve by:

- [ y] Regenerate
- [ y] Recompile prompt
- [ y] Mark reviewed
- [y ] Clear manually

Confirm:

- [ y] Stale warnings never trigger automatic regeneration.

## 19. Export Package

| Decision | Options |
|---|---|
| Include | [y ] Ordered folders [y ] Selected video [y ] Selected audio [ ] Selected image [ ] First/last frames [ ] metadata.json [y ] JSON manifest [y ] CSV manifest |
| Optional include | [ ] Style Bible [ ] Entity refs [ ] Source material [ ] Debug data |
| Blocking | [ ] Missing video [ ] Missing audio [ ] Missing image [ ] Stale warnings [ ] Warnings only |
| Root naming | [ ] `project_name_export` [y ] `project_name_export_YYYYMMDD_HHMM` |
| Panel folder naming | [ ] `001_panel_intro` [ ] `001_intro` [y ] `panel_001` |
| File naming | [y ] `video.mp4/audio.wav/image.png` [ ] Include asset IDs [ ] Preserve original names |

Manifest fields:

- [y ] Project title
- [y ] Export timestamp
- [ ] Aspect ratio
- [ ] Scene/panel order
- [ ] Selected asset paths
- [ ] Narration
- [ ] Target/actual durations
- [ ] Pace/emotion
- [ ] Editor notes
- [ ] Stale warnings
- [ ] Entity mappings
- [ ] Provider/model metadata
- [ ] Generation job IDs

Example:

```text
myth_temple_export_20260510/
  001_arrival/
    video.mp4
    audio.wav
    image.png
    metadata.json
  timeline_manifest.json
```

## 20. Model Stack and Providers

Defaults:

```text
Text model:
Image model:
Video provider/model:
Voice provider/model:
```

Config level:

- [ y] Project-level only
- [ ] Per-job override
- [ ] Admin settings only

Capabilities to confirm:

- [y ] Image: 9:16
- [y ] Image: reference images
- [ ] Image: negative prompt
- [y ] Video: prompt-only
- [y ] Video: image-to-video
- [y ] Video: first/last frame
- [ y] Video: duration
- [ y] Video: 9:16
- [ y] Video: audio/lip-sync
- [y ] Voice: pace
- [y ] Voice: emotion/style
- [ y] Voice: WAV/MP3

Unknowns:

```text
Example: Need to verify whether Grok Imagine API accepts first and last frames.
Answer:
```

## 21. Technical Architecture

| Area | Options |
|---|---|
| Frontend | [y ] Next.js [ ] React + Vite [ ] Other: ______ |
| Backend | [ ] Next API [ ] Node/Fastify/Express [y ] Python/FastAPI [ ] Other: ______ |
| Database | [ ] PostgreSQL [y ] SQLite prototype [ ] Supabase Postgres [ ] Other: ______ |
| ORM | [y ] Prisma [ ] Drizzle [ ] SQLAlchemy [ ] Other: ______ |
| Queue | [y ] BullMQ + Redis [ ] Celery + Redis [ ] Cloud queue [ ] Other: ______ |
| Storage | [ ] AWS S3 [y ] Cloudflare R2 [ ] Supabase Storage [ ] GCS [ ] Local prototype |
| Local dev | [ ] Docker [ ] Fake providers [ ] Seed data [ ] Real-provider staging | EXPAIN, I would use env and diffreent iterm terminals
| API style | [ y] REST [ ] tRPC [ ] GraphQL [ ] Mixed |
| Uploads | [ ] Backend API [ ] Presigned URLs [y ] Local first |
| Media processing | [ ] Durations [ ] Thumbnails [ ] Waveforms [y ] Not MVP |
| Signed URLs | [ ] Yes [ ] No internal MVP [ y] Later |

Example:

```text
Example: Next.js + Fastify API + Postgres + Prisma + BullMQ/Redis + R2 + fake providers locally.
Answer:
```

## 22. UI Layout

| Decision | Options |
|---|---|
| Main layout | [y ] Left sidebar + main workspace + right inspector [ ] Table + drawer [ ] Timeline strip + detail |
| Default panel view | [ ] Scene list [ ] Card board [ ] Dense table [ y] Split list/detail |
| Right sidebar | [ ] Chat [ ] AI actions [y ] Prompt inspector [ ] Debug [ ] Stale warnings |
| Panel card | [y ] Number [y ] Title [y ] Narration [ y] Entities [y ] Image preview [y ] Video preview [ y] Audio status [y ] Durations [y ] Stale badges [ y] Buttons |
| Density | [ y] Compact/power-user [ ] Media-heavy [ ] Toggle |

## 23. Testing and Launch Checklist

Required tests:

- [ y] Prompt compiler
- [y ] Entity reference propagation
- [y ] Stale state
- [y ] Provider adapter contracts
- [y ] Queue/job lifecycle
- [y ] Export ZIP structure
- [y ] Manifest schema
- [y ] Debug redaction
- [y ] UI smoke tests

Provider tests: By providers i would use api keys, if this is not what you mean EXPLAIN

- [ ] Always mocked
- [ ] Fake providers locally
- [ ] Real providers only in staging/manual tests

MVP demo must show:

- [y ] Create project
- [y ] Add source material
- [y ] Analyze story
- [y ] Apply scenes/panels
- [y ] Create Style Bible
- [y ] Create/map entities
- [y ] Generate image
- [y ] Generate first/last frames
- [y ] Generate video
- [y ] Generate voiceover
- [y ] Select assets
- [y ] Inspect debug details
- [y ] Show stale warning
- [y ] Export ordered ZIP
- [ y] Manually import into editor

Demo acceptance:

```text
Example: Export a 12-panel sample project with selected image/audio/video assets and valid timeline_manifest.json.
Answer:
```

## 24. Risks and Immediate Decisions

Risks:

- [ ] Video provider API capability unknown
- [y ] Voice pace/emotion support unknown
- [ ] Entity consistency may be weak
- [ ] Cost may be too high
- [ ] Export needs may change after editor testing
- [ ] Debug logs may expose sensitive data
- [ ] Scope may drift toward full editor

Top risks:

```text
1.
2.
3.
```

Immediate decisions: 

```text
1. Preferred tech stack:
2. Storage provider:
3. Queue system:
4. Default text model: chatgpt
5. Default image model: image2
6. Default video provider/API: grok imagine
7. Default voice provider: google voice
8. Export blocking rules:
9. Debug access rule:
10. First demo project:
```
