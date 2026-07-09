# Architecture

Quiet Hours is a Bolt for JavaScript app (Socket Mode) that observes Slack channel activity, decides via a transparent heuristic whether one human is carrying an incident alone late at night, and — with that human's consent — hands the incident off to a rested backup. It leans on three technologies that each do real work: **Slack RTS** for detection, an **MCP server** for the PagerDuty handoff, and **Slack AI** for the assistant surface, the AI-drafted handoff note (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback), and the morning Canvas.

## Component diagram

```mermaid
flowchart LR
    subgraph SL[Slack]
        Chan[Watched channels]
        DMsurface[DM / Assistant]
        Home[App Home]
        Cv[Canvas]
    end

    subgraph APP[Bolt app · src/app.js]
        Cfg[config.js]
        subgraph DET[detection]
            Watch[watcher.js]
            RTS[rtsClient.js]
            Heur[heuristic.js]
        end
        subgraph AG[agent]
            Eng[interventionEngine.js]
            HO[handoff.js]
        end
        subgraph UI[ui]
            DMB[dmBlocks.js]
            CanvasB[canvas.js]
            HomeB[appHome.js]
            Copy[copy.js]
        end
        subgraph MCPc[mcp]
            PDClient[pagerdutyClient.js]
        end
        Led[(ledger.js<br/>ledger.json)]
    end

    subgraph EXT[External]
        Claude[(LLM<br/>Gemini · Claude · Cerebras)]
        PDServer[pagerdutyServer.js<br/>MCP server]
        PD[(PagerDuty API)]
    end

    Chan -->|RTS API| RTS --> Watch
    Watch --> Heur
    Cfg --> Watch
    Heur -->|4 signals pass| Eng
    Eng --> DMB --> DMsurface
    DMsurface -->|button events| Eng
    Eng --> HO --> Claude
    Eng --> PDClient
    PDClient <-->|MCP: get_oncall / page_backup| PDServer <--> PD
    Eng <--> Led
    Eng --> CanvasB --> Cv
    Eng --> HomeB --> Home
    Copy -.-> DMB
    Copy -.-> CanvasB
    Copy -.-> HomeB
```

## Sequence: the full flow

```mermaid
sequenceDiagram
    autonumber
    participant Ch as Slack channel
    participant W as watcher / rtsClient
    participant H as heuristic
    participant E as interventionEngine
    participant U as Human (DM)
    participant M as pagerdutyClient ↔ MCP server
    participant C as LLM (Gemini · Claude · Cerebras)
    participant L as ledger.json
    participant Cv as Canvas

    Ch->>W: new message (RTS event)
    W->>W: pull RTS context (sender counts, last human reply, timestamps)
    W->>H: evaluate window
    H->>H: check 4 signals (≥30 msgs · no reply ≥60m · ≥23:00 or ≥3h · opted-in)
    H-->>E: trigger (all signals pass)
    E->>L: open IncidentSession
    E->>U: DM — observed facts + buttons
    U-->>E: click "Get me a backup" (consent)
    E->>M: get_oncall (find rested backup)
    M-->>E: backup user + schedule slot
    E->>C: draftHandoffNote(channel context)
    C-->>E: handoff note (honest, observed facts only)
    E->>M: page_backup(backup, note)
    M-->>E: page acknowledged
    E->>L: record handoff, backup, timestamps
    Note over E,U: non-critical pings held/silenced
    E->>Cv: next morning — build Canvas from ledger
    Cv-->>U: "thank you" Canvas (observed data only)
```

## Data model

The single persisted entity is the **IncidentSession**, stored in the JSON-file ledger (`src/ledger/ledger.js`). It captures only observed facts so the morning Canvas can be reconstructed truthfully.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Session id (channel + window). |
| `channelId` | string | Watched channel where the incident was detected. |
| `carrierUserId` | string | The human carrying the incident. |
| `startedAt` | ISO timestamp | First message in the detected window. |
| `messageCount` | number | Messages the carrier sent in the window (observed). |
| `lastOtherHumanReplyAt` | ISO timestamp \| null | When any other human last replied. |
| `carrierLocalHour` | number | Carrier's local hour at trigger (from `QH_TIMEZONE_OFFSET_HOURS`). |
| `soloDurationMins` | number | Minutes solo (observed). |
| `signals` | object | The 4 boolean signal results at trigger (for transparency). |
| `state` | enum | `detected` → `dm_sent` → `consented` \| `snoozed` \| `keep_going` → `handed_off` → `closed`. |
| `consentAt` | ISO timestamp \| null | When the human consented. |
| `backupUserId` | string \| null | Rested backup returned by `get_oncall`. |
| `handoffNote` | string \| null | AI-drafted note actually sent (LLM: Gemini · Claude · Cerebras, or templated fallback). |
| `pagedAt` | ISO timestamp \| null | When `page_backup` was acknowledged. |
| `canvasPostedAt` | ISO timestamp \| null | When the morning Canvas went out. |

Everything the Canvas prints is drawn from these fields — no derived "scores," no inferred state.

## Why RTS and MCP are load-bearing (not decorative)

**Slack RTS is the sensory system.** The entire premise — "one person is carrying this alone right now" — is a *real-time, cross-message* judgment. It cannot be made from a single event payload; it needs to know who else has spoken, how recently, and how the message rate is trending across the window. RTS is what supplies that context to the heuristic. Swap it out and there is no detection at all — the agent goes blind.

**The MCP server is the actuator.** Detecting the problem is worthless if the fix is "post a message and hope someone volunteers." The value is in *actually paging a rested human*, which requires reading a live on-call schedule and issuing a page. `pagerdutyServer.js` exposes exactly two tools — `get_oncall` (who is rested and available) and `page_backup` (page them with the handoff note) — and the intervention engine calls them through a standard MCP client. Remove the MCP integration and the agent can notice the problem but can't resolve it; the handoff becomes a suggestion instead of an action.

Together they close the loop: RTS turns raw channel traffic into an honest observation, and the MCP server turns the human's consent into a real, rested backup on the pager. Slack AI carries the human-facing half — the assistant conversation, the AI-drafted handoff (provider chain: Anthropic → Gemini → Cerebras, with a templated fallback), and the morning Canvas — so the whole exchange stays warm and legible rather than mechanical.
