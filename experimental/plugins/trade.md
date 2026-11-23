---
title: VersatiaTrade
counterpart: /admin/experimental/trade
description: Stopping a trade or an offered item, changing how offered items look, following how a trade ends and telling VersatiaTrade which stacks are the same item.
---

# VersatiaTrade

VersatiaTrade opens a trade window for two players. Each clicks the items of their inventory to
offer them, adds money and accepts; every change takes both acceptances back, a short countdown
runs, and the exchange moves everything or nothing. The offered items never leave their owner's
inventory before the exchange, so nothing is lost when a player quits, dies or walks away, or when
the server stops. A trade is asked for with `/trade <player>` or, with
[VersatiaInteractions](interactions.md) on the server, from its menu. Your plugin works with it
through events and, for items that change while they lie in an inventory, an item identity.

:::admin

Installing VersatiaTrade, its permissions, the economy, its `config.yml`, its messages and its
trade log are on the [VersatiaTrade](/admin/experimental/trade) page of the server admin guide.

:::

## Events {/* #events */}

Every event VersatiaTrade fires is in `dev.versatia.trade.event` and fires on the server thread.
Your plugin compiles against `dev.versatia:VersatiaTrade:0.0.1`, and a listener in a plugin that
also runs without VersatiaTrade carries `@ConditionalOnPlugin("VersatiaTrade")`
([Working with a plugin](index.md#working-with-a-plugin)):

| Event | When | A listener can |
|---|---|---|
| `TradeStartEvent` | before a trade opens | [deny it](#stopping-a-trade), with a reason both players read |
| `TradeItemOfferEvent` | a player clicks an item to offer it | [deny it](#keeping-items-out-of-trades), with a reason the player reads |
| `TradeItemRenderEvent` | a window shows an item the partner offers | [change the copy the viewer sees](#showing-offered-items) |
| `TradeCompletedEvent` | after an exchange | [read what changed hands](#after-a-trade) |
| `TradeCancelledEvent` | after a trade ended without an exchange | [read why](#after-a-trade) (`cause`) |

A trade that opened ends with exactly one `TradeCompletedEvent` or `TradeCancelledEvent`. With
VersatiaInteractions on the server, the request that opens a trade fires that plugin's events too,
with the action `trade` ([VersatiaInteractions events](interactions.md#events)).

## Stopping a trade {/* #stopping-a-trade */}

`TradeStartEvent` fires before a trade opens, once VersatiaTrade's own checks passed (permissions,
distance, neither player trading already), however the trade was asked for. `first` is the player
who asked, `second` the one who accepted. Denied, the trade does not open and both players read the
reason, so the reason names whom it concerns:

```kotlin title="Wrong: the partner reads that they are in combat"
@EventHandler
fun onStart(event: TradeStartEvent) {
    // error-next-line
    if (combat.isTagged(event.first)) event.deny(messages["combat.you-cannot-trade"].get())
}
```

```kotlin title="Right"
@EventHandler
fun onStart(event: TradeStartEvent) {
    val tagged = listOf(event.first, event.second).firstOrNull(combat::isTagged) ?: return
    // fix-next-line
    event.deny(messages["combat.no-trade"].get(arg("player", tagged)))
}
```

The plugin's messages hold `combat.no-trade: "<negative>{player} is in combat and cannot trade."`.
An event cancelled without a reason (`isCancelled = true`) shows VersatiaTrade's own sentence,
`deny.unavailable`.

## Keeping items out of trades {/* #keeping-items-out-of-trades */}

`TradeItemOfferEvent` fires when `player` clicks an item of their inventory, in the lower part of
the window, to offer it to `partner`, before it joins the offer. `item` is a copy of one item of the
kind clicked, and `amount` how many the click asks for, the stack or one; fewer join when the player
has no more or the offer is full. Denied, the item stays out of the offer and `player` reads the
reason; cancelled without one, VersatiaTrade's `trade.item-denied` sentence names the item:

```kotlin
@ConditionalOnPlugin("VersatiaTrade")
class BoundItems(private val bindings: Bindings, private val messages: Messages) : Listener {
    @EventHandler
    fun onOffer(event: TradeItemOfferEvent) {
        if (bindings.isBound(event.item)) event.deny(messages["item.bound"].get(arg("item", event.item)))
    }
}
```

The event is asked when an item joins an offer, not at the exchange, so an item that becomes
untradeable while offered stays offered.

## Showing offered items {/* #showing-offered-items */}

`TradeItemRenderEvent` fires whenever the window of `viewer` shows an item `owner` offers, at every
redraw. `item` is a copy for the viewer's eyes alone: replace it (`event.item = ...`) to show the
item as your plugin renders it for that player, with the requirements the viewer meets coloured,
say. What the owner offers and what the viewer gets stay as they are. Every redraw fires the event
for every item shown, so keep the listener cheap:

```kotlin
@EventHandler
fun onRender(event: TradeItemRenderEvent) {
    event.item = lore.renderFor(event.viewer, event.item)
}
```

## After a trade {/* #after-a-trade */}

`TradeCompletedEvent` fires after the exchange, once both players' data are saved. `first` and
`second` are the players of `TradeStartEvent`, `firstGave` and `secondGave` copies of the stacks
each gave, as they lay in the inventory, and `firstMoney` and `secondMoney` the money each gave, a
`BigDecimal`, zero when none. Save at once what your plugin keeps of its own for the two, so a crash
cannot undo half a trade; count trades for a quest; report them elsewhere.

`TradeCancelledEvent` fires after a trade ended without an exchange, for its `cause`:

| `cause` | When |
|---|---|
| `CLOSED` | one of the two closed the window, or another plugin opened an inventory over it |
| `QUIT` | one of the two left the server |
| `DEATH` | one of the two died |
| `DISTANCE` | the two moved farther apart than the server's `trade.max-distance`, or into different worlds |
| `PERMISSION` | one of the two may no longer trade, or no longer offer the money they offer |
| `STOPPED` | VersatiaTrade stopped |

Nothing has to be given back after a cancelled trade: the offered items never left their owners'
inventories.

## Items that change in an inventory {/* #item-identities */}

An offer names kinds of items and how many of each, "10 diamonds", not slots. By default two stacks
are the same kind when Bukkit finds them similar: the same type and the same components. An item
whose stack changes while it lies in an inventory, with a lore your plugin renders for the holder
say, would count as gone the moment it changes, and leave the offer. Your plugin says what makes
its items the same with an `ItemIdentity`:

```kotlin
@TradeItemIdentity
class RpgItemIdentity(private val items: Items) : ItemIdentity {
    override fun of(item: ItemStack) = items.instanceIdOf(item)
}
```

`of` returns the identity of an item your plugin knows and null for any other. Two stacks are the
same item when the first identity knowing either of them gives both equal values; a stack it knows
and one it does not are different items, and when no identity knows them, Bukkit's similarity
decides. Identities are asked in the order their plugins started, and one is withdrawn when its
plugin stops. VersatiaTrade calls `of` often, on the server thread, so keep it cheap and free of
side effects. The exchange hands over the stacks it took, as they lay in the inventory, so an item
keeps its own data whatever counts as the same.

`@TradeItemIdentity` makes the class a local bean and carries `@ConditionalOnPlugin("VersatiaTrade")`:
on a server without VersatiaTrade the class is skipped and never loaded. `ItemIdentity` and the
annotation are in the package `dev.versatia.trade`.

## Corner cases {/* #corner-cases */}

- **A refused exchange does not end the trade.** When the countdown ends and the exchange cannot
  happen (an item is gone, a side lacks room or money), the acceptances go, both players are told
  why and the trade goes on; no event fires.
- **The render event never changes the trade.** What the viewer gets is what the owner's inventory
  holds at the exchange, whatever a `TradeItemRenderEvent` listener showed.
- **An offered item that changes** is another kind unless an identity says otherwise: the offer
  shrinks, both acceptances go and the player is told.
- **Requests through VersatiaInteractions** fire its events: a denied
  `InteractionRequestSendEvent` stops the request before the other player sees it, while
  `TradeStartEvent` stops the trade however it was asked for.
- **A denied start ends the request.** A trade asked for in VersatiaInteractions' menu that a
  `TradeStartEvent` listener keeps from opening ends the request with
  `InteractionRequestCancelledEvent` (`UNAVAILABLE`): no acceptance is announced and
  `InteractionRequestAcceptedEvent` does not fire.
- **No economy, no money.** On a server without Vault and an economy plugin trades are items only,
  and `firstMoney` and `secondMoney` are zero.
- **Copies are handed out.** The stacks of `TradeItemOfferEvent` and `TradeCompletedEvent` are
  copies: changing them changes nothing.
