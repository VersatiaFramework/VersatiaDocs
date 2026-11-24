---
title: VersatiaInteractions
counterpart: /admin/experimental/interactions
description: Adding a button to the menu VersatiaInteractions opens on a player, sending its request from code, and denying or following requests through their events.
---

# VersatiaInteractions

import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

VersatiaInteractions opens a menu when a player Shift + right clicks another player, with one
button per action that plugins add: a trade, a duel. Your plugin adds an action with one class and
says what happens once a request is accepted. VersatiaInteractions does everything around it: the
request a click sends, its timeout and countdown, the button's state in both players' menus, the
receiver's clickable chat line, the sounds, two requests to each other accepting each other, and
requests ending when a player quits, dies or walks away. A player busy in one action, a trade say,
cannot be asked for another.

:::admin

Installing VersatiaInteractions, its permissions, its `config.yml` and its messages are on the
[VersatiaInteractions](/admin/experimental/interactions) page of the server admin guide.

:::

## Adding an action {/* #adding-an-action */}

A class annotated `@InteractionAction` that implements `Interaction` adds a button to the menu. It
is a local bean of your plugin, so its constructor is injected, and the annotation carries
`@ConditionalOnPlugin("VersatiaInteractions")`: on a server without VersatiaInteractions the class
is skipped and never loaded, and your plugin runs without the button. Your build compiles against
the plugin with `compileOnly`, `plugin.yml` lists it under `softdepend:`, and your messages hold
the action's name:

<CodeCards>
<CodeCard title="DuelInteraction.kt">

```kotlin
@InteractionAction("duel")
class DuelInteraction(private val duels: Duels) : Interaction {
    override fun engagedWith(player: Player) = duels.opponentOf(player)
    override fun check(from: Player, to: Player) = duels.check(from, to)
    override fun accepted(from: Player, to: Player) = duels.start(from, to)
}
```

</CodeCard>
<CodeCard title="build.gradle.kts">

```kotlin
dependencies {
    compileOnly("dev.versatia:VersatiaInteractions:0.0.1")
}
```

</CodeCard>
<CodeCard title="plugin.yml">

```yaml
softdepend:
  - VersatiaInteractions
```

</CodeCard>
<CodeCard title="messages/duel.yml">

```yaml
interaction:
  name: "Duel"
```

</CodeCard>
</CodeCards>

The id, `duel`, names the action on the server: the admin sets its button's slot, icons and sounds
under `actions.duel` of `plugins/VersatiaInteractions/config.yml`. It is made of lower-case
letters, digits, `_` and `-`, and one plugin owns it. The API is in the package
`dev.versatia.interactions`.

## What an action answers {/* #what-an-action-answers */}

VersatiaInteractions calls the three functions of `Interaction` on the server thread:

| Function | Answers | Called |
|---|---|---|
| `engagedWith(player)` | who `player` is engaged with in the action right now, however it started (the opponent in a duel), or null; null by default | for every button drawn, before a request is sent or accepted, and once per second while a request waits |
| `check(from, to)` | `InteractionCheck.Allowed`, or `InteractionCheck.Denied(reason)` while the action's own rules forbid it; `Allowed` by default | as often as `engagedWith` |
| `accepted(from, to)` | whether it started the action, which it does now: `to` accepted the request of `from`, or the two sent each other one; false when the action cannot start, once both players were told why | once per accepted request, after both players' menus closed |

Keep `engagedWith` and `check` cheap and free of side effects. VersatiaInteractions checks its own
rules (exempt players, distance, engagements) before `check`, which holds only what is particular
to the action: an arena where duels are not allowed, a cooldown.

The reason of a denial is a whole sentence from your plugin's messages that says whom it concerns,
since the button shows it to whoever looks, and a waiting request is cancelled with it:

```kotlin title="Wrong: a fragment the server cannot edit"
override fun check(from: Player, to: Player) = when {
    // error-next-line
    duels.inArena(to) -> InteractionCheck.Denied(Component.text("in an arena"))
    else -> InteractionCheck.Allowed
}
```

```kotlin title="Right"
override fun check(from: Player, to: Player) = when {
    // fix-next-line
    duels.inArena(to) -> InteractionCheck.Denied(messages["duel.in-arena"].get(arg("player", to)))
    else -> InteractionCheck.Allowed
}
```

The class injects `Messages`, and the messages hold
`duel.in-arena: "<negative>{player} is in an arena and cannot fight now."`.

An action can still fail to start once accepted, when another plugin denies its own start event,
say. `accepted` then tells both players why in your messages and answers false: VersatiaInteractions
announces no acceptance and ends the request as `UNAVAILABLE`. Answering true regardless tells the
sender their request was accepted while nothing started:

```kotlin title="Wrong: the sender reads that the duel was accepted although it never started"
override fun accepted(from: Player, to: Player): Boolean {
    duels.start(from, to)
    // error-next-line
    return true
}
```

```kotlin title="Right: Duels.start answers whether the duel started"
// fix-next-line
override fun accepted(from: Player, to: Player) = duels.start(from, to)
```

## The action's sentences {/* #sentences */}

Every sentence about an action comes from its plugin's messages, under `interaction`. The rest of
the menu comes from VersatiaInteractions' own messages, which name an action only by its bare name
after a colon (`Offer: Duel`), so no language has to inflect it:

| Key | Required | Used for |
|---|---|---|
| `interaction.name` | yes | `{action}`, the action's bare name |
| `interaction.busy` | no | the reason on a button while another player is busy with the action; `{target}` is that player |
| `interaction.busy-self` | no | the reason while the viewer is busy with it |
| `interaction.button.<state>.name`, `.lore` | no | the button's name or lore in one state, in place of the menu's default |
| `interaction.offer.<event>` | no | a chat line of an offer in the action's own words, `{sender} challenges you to a duel.`, in place of VersatiaInteractions' `offer.<event>`: `sent`, `received`, `accepted`, `declined`, `expired` or `cancelled` |

The states are `available`, `waiting`, `offered`, `busy`, `denied` and `active`; a button's text
takes `{target}`, the other player, `{action}`, `{seconds}`, the seconds left, and `{reason}`:

```yaml title="messages/duel.yml"
interaction:
  name: "Duel"
  busy: "<warning>{target} is fighting"
  busy-self: "<warning>You are fighting"
  button:
    available:
      lore:
        - "<hint>Challenge {target} to a duel."
        - "<hint>Click to send the challenge."
```

An action's own `offer.received` writes the answer buttons itself, as VersatiaInteractions' does:
`<click:run_command:'/interact accept {sender.name} {action.id}'>[Accept]</click>`, and the same
with `decline`.

A plugin with a second action gives it a prefix of its own:
`@InteractionAction("spar", messages = "spar")` reads `spar.name`.

## Busy players {/* #busy-players */}

An action is exclusive unless `@InteractionAction(exclusive = false)` says otherwise. While a player
is engaged in an exclusive action, which `engagedWith` reports, they can neither send, receive nor
accept a request of any exclusive action, and the buttons say who is busy: a player in a trade
cannot be challenged to a duel. A non-exclusive action, such as a look at someone's equipment, is
never blocked and blocks nothing. Two players engaged with each other see the action's button in
the `active` state.

VersatiaInteractions acts on events and does not ask the actions about open menus. When an
engagement starts or ends outside the menu, a duel ending say, call `Interactions.refresh(player)`
for each player: the menus showing them are redrawn and the waiting requests checked at once.
Without it, a menu shows the change at the next click, or at the next countdown redraw while a
request waits.

```kotlin
@ConditionalOnPlugin("VersatiaInteractions")
class DuelMenus(private val interactions: Interactions) : Listener {
    @EventHandler
    fun onEnd(event: DuelEndedEvent) = listOf(event.first, event.second).forEach(interactions::refresh)
}
```

## Requests from code {/* #requests-from-code */}

A plugin offering its action outside the menu too, with a `/duel <player>` command say, injects
`Interactions` into a bean carrying `@ConditionalOnPlugin("VersatiaInteractions")` and calls
`request(from, to, "duel")`. That is the request a click sends, with the same checks, messages and
sounds, and it accepts instead when `to` had asked `from` already. Behind an interface of your own,
the command also works on a server without VersatiaInteractions:

```kotlin
interface DuelRequests {
    fun send(from: Player, to: Player)
}

@LocalBean
class ChatDuelRequests(private val duels: Duels) : DuelRequests {
    override fun send(from: Player, to: Player) = duels.challengeInChat(from, to)
}

@ConditionalOnPlugin("VersatiaInteractions")
@Primary
@LocalBean
class MenuDuelRequests(private val interactions: Interactions) : DuelRequests {
    override fun send(from: Player, to: Player) = interactions.request(from, to, "duel")
}
```

`openMenu(viewer, target)` opens the menu as Shift + right click does, and `actionIds` lists the
registered actions in the menu's order. `request` with an id no plugin registered fails, naming the
registered ids. Every call belongs on the server thread.

## Events {/* #events */}

Every event VersatiaInteractions fires is in `dev.versatia.interactions.event`, fires on the server
thread and names `from`, who sent the request, `to`, who received it, and `action`, the action's id:

| Event | When | A listener can |
|---|---|---|
| `InteractionRequestSendEvent` | before a request is sent | [deny it](#denying-a-request), with a reason the sender reads |
| `InteractionRequestAcceptEvent` | before a request is accepted | [deny it](#denying-a-request), with a reason the accepting player reads |
| `InteractionRequestAcceptedEvent` | after a request was accepted and the action started | [follow it](#how-a-request-ends) |
| `InteractionRequestDeclinedEvent` | after the receiver declined | [follow it](#how-a-request-ends) |
| `InteractionRequestExpiredEvent` | after a request waited its whole time | [follow it](#how-a-request-ends) |
| `InteractionRequestCancelledEvent` | after a request ended otherwise | [read why](#how-a-request-ends) (`cause`) |

A request that was sent ends with exactly one of the last four. A listener in a plugin that also
runs without VersatiaInteractions carries `@ConditionalOnPlugin("VersatiaInteractions")`
([Working with a plugin](index.md#working-with-a-plugin)).

### Denying a request {/* #denying-a-request */}

`InteractionRequestSendEvent` fires once VersatiaInteractions' own rules and the action's `check`
allow the request. `InteractionRequestAcceptEvent` fires before a click, `/interact accept` or the
dialog accepts a request, and before two requests sent to each other accept each other, `to` being
then the player who clicked last. `deny(reason)` stops either with a whole sentence from your
plugin's messages; an event cancelled without a reason shows VersatiaInteractions' `unavailable`
sentence. A denied send sends nothing, and a denied acceptance leaves the request waiting:

```kotlin
@ConditionalOnPlugin("VersatiaInteractions")
class ArenaRules(private val arenas: Arenas, private val messages: Messages) : Listener {
    @EventHandler
    fun onSend(event: InteractionRequestSendEvent) {
        if (event.action == "trade" && arenas.isInside(event.from)) event.deny(messages["arena.no-trade"].get())
    }
}
```

### How a request ends {/* #how-a-request-ends */}

`InteractionRequestAcceptedEvent` fires once the action started, its `accepted` answering true (a
trade window is open, say). `InteractionRequestDeclinedEvent` fires after the receiver
declined, `InteractionRequestExpiredEvent` after the request waited the server's
`requests.timeout`, and `InteractionRequestCancelledEvent` after it ended otherwise, for its
`cause`:

| `cause` | When |
|---|---|
| `WITHDRAWN` | `from` clicked the waiting button, taking the request back |
| `QUIT` | one of the two left the server |
| `DEATH` | one of the two died, while the server's `requests.cancel-on` lists `death` |
| `DISTANCE` | the two moved farther apart than `requests.max-distance`, while `cancel-on` lists `distance` |
| `WORLD_CHANGE` | the two are in different worlds, while `cancel-on` lists `world-change` |
| `UNAVAILABLE` | one of the two became busy, the action's check denies the request now, or the action did not start once accepted (its `accepted` answered false or failed) |
| `STOPPED` | the plugin of the action, or VersatiaInteractions, stopped |

## Corner cases {/* #corner-cases */}

- **One plugin per id.** An id another plugin registered, or one your plugin registers twice, fails
  your plugin's start naming both plugins. An id with other characters than lower-case letters,
  digits, `_` and `-`, or a missing `interaction.name`, fails it too, naming the id or the key.
- **All actions or none.** Your plugin's actions are registered together at its start, once its
  beans exist. When its start fails afterwards, or when it stops, they are withdrawn: their
  requests end (`STOPPED`, without a message) and the menus showing them close.
- **A function that throws** is logged once per action and function: a failing `engagedWith`
  counts as not engaged, a failing `check` as a denial with VersatiaInteractions' `unavailable`
  sentence, and a failing `accepted` tells both players that sentence and ends the request like an
  answer of false.
- **Not started is not accepted.** When `accepted` answers false, the sender reads no acceptance,
  `InteractionRequestAcceptedEvent` does not fire and the request ends with
  `InteractionRequestCancelledEvent` (`UNAVAILABLE`); the action has told both players why.
- **Some players cannot be asked.** No menu opens and no request reaches a player with
  `versatia.interactions.exempt`, a player the viewer cannot see (one a vanish plugin hides) or an
  NPC, and nobody asks themselves.
- **A request is answered once.** Accepting, declining, withdrawing, expiring and cancelling all
  remove it, so a second answer finds nothing.
- **Accepting checks again.** The engagements, `check` and `InteractionRequestAcceptEvent` run
  again when the receiver accepts, so a rule that changed while the request waited holds.
- **Leaving the server always ends a request**, whatever `requests.cancel-on` lists, since nobody
  offline can answer.
- **No action, no menu.** On a server where no plugin registered an action, Shift + right click
  opens nothing.
