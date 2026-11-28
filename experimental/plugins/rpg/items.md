---
title: VersatiaRpg-Items
counterpart: /admin/experimental/rpg/items
description: How your plugin makes items of the types of items.yml, adds values of its own to them, changes what they give, and adds parts of the lore and kinds of requirement, with VersatiaRpg-Items.
---

# VersatiaRpg-Items

VersatiaRpg-Items reads the server's types of items from `items.yml`: the material an item is made of,
the stats it gives in its slot through [VersatiaRpg-Stats](stats.md), what a player needs to wear or hold
it, and its lore. Your plugin makes items of a type, keeps values of its own in them, such as a tier or
an upgrade, and adds what the lore shows of them.

:::admin

Installing VersatiaRpg-Items, the types of `items.yml`, the layout of the lore and `/items` are on the
[VersatiaRpg-Items](/admin/experimental/rpg/items) page of the server admin guide.

:::

## Items of a type {/* #items-of-a-type */}

Inject `Items`:

```kotlin
class Rewards(private val items: Items) {
    fun reward(player: Player) {
        player.inventory.addItem(items.create("short_sword"))
    }

    fun isSword(item: ItemStack) = items.typeOf(item)?.id == "short_sword"
}
```

An item keeps the id of its type in its data; its name, lore, model and material follow the type and are
given again whenever the item is touched. Its material's own attributes are gone, their effect too: the
item gives only what `statsOf(item)` says, in its type's slot. `canUse(player, item)` tells whether the
player meets its requirements; one who does not can neither wear nor hold it. With the
[ItemViews module](../../modules/item-views.md) on the server an item carries no lore: Items renders
it for each player, and what they miss of its requirements in a variant the server's admin chooses.

## Values of your own {/* #values-of-your-own */}

Write a value into the item's data as it is made, at `ItemCreateEvent`, and change what the item gives
from it at `ItemStatsEvent`, which the lore follows too:

```kotlin
class Tiers(plugin: Plugin) : Listener {
    private val tier = NamespacedKey(plugin, "tier")

    @EventHandler
    fun onCreate(event: ItemCreateEvent) {
        event.item.editPersistentDataContainer { it.set(tier, PersistentDataType.INTEGER, Random.nextInt(1, 9)) }
    }

    @EventHandler
    fun onStats(event: ItemStatsEvent) {
        val level = event.item.persistentDataContainer.get(tier, PersistentDataType.INTEGER) ?: return
        event.stats.replaceAll { _, amount -> amount * (level + 1) / 4 }
    }
}
```

A value changed later, by your plugin's own action, needs nothing more: the item takes its new look the
next time it is touched. An item can have a description of its own too, shown below its type's, such
as the story of a unique sword; it stays in the item's data:

```kotlin
items.describe(sword, messages["legend.blade-of-dawn"].lines())
```
 While the ItemViews module renders a lore, `ItemStatsEvent` fires on the
thread of the player's connection, as an asynchronous event: read only the item and the event.

## Parts of the lore {/* #parts-of-the-lore */}

The lore is made of parts, in the order the server's `config.yml` gives. A part of yours goes under an
id the admin writes into that order, and a name hook changes the name:

```kotlin
class TierPart(private val messages: Messages, plugin: Plugin) : ItemPart {
    private val tier = NamespacedKey(plugin, "tier")

    override fun lines(item: ItemStack, view: LoreView): List<Component> {
        val level = item.persistentDataContainer.get(tier, PersistentDataType.INTEGER) ?: return emptyList()
        return messages["lore.tier"].lines(arg("tier", level))
    }
}

items.addPart(plugin, "tier", TierPart(messages, plugin))
items.addNameHook(plugin) { item, name, _ -> name.append(Component.text(" +3")) }
```

A part without lines is left out, with its header and the space before it. Its lines keep their own
formatting; the lore's style fills only what they leave open. Parts and hooks go when your plugin
stops.

`lines` and a name hook run whenever a lore is rendered, with the ItemViews module on the thread of a
player's connection: keep them cheap and thread-safe, reading only the item and `view`. `view.viewer`
is the player the lore is rendered for, null for the lore written on the item, and `view.context`
what a plugin [attached](../../modules/item-views.md#the-window-an-item-is-seen-in) to the window
they have open, so that a part shows only there:

A scope hook puts the whole lore of an item in a style, a scope of the server's styles: the names
inside it, a heading, a label or an accent, take the look the scope gives them, so that the headers
of an item show its tier's colour. Your plugin ships the scopes as defaults, which the server's
styles file can change:

```kotlin
val tier = NamespacedKey(plugin, "tier")
items.addScopeHook(plugin) { item, _ -> item.persistentDataContainer.get(tier, PersistentDataType.INTEGER)?.let { "tier$it" } }
```

```yaml title="src/main/resources/styles.yml"
tier4:
  heading: "<gradient:#e335d5:#e962de>"
```

```kotlin
class PricePart(private val messages: Messages) : ItemPart {
    override fun lines(item: ItemStack, view: LoreView): List<Component> {
        val window = view.context as? SellWindow ?: return emptyList()
        return messages["lore.price"].lines(arg("price", window.shop.priceOf(item)))
    }
}
```

## Kinds of requirement {/* #kinds-of-requirement */}

Besides `level`, `classes` and `stats`, `items.yml` takes kinds of requirement your plugin adds, written
under their name, such as `rank: noble`:

```kotlin
class RankRequirement(private val messages: Messages) : Requirement<String> {
    override fun read(section: ConfigurationSection, key: String) = section.getStringOrThrow(key)

    override fun isMet(player: Player, value: String) = player.hasPermission("group.$value")

    override fun lines(value: String, view: LoreView) = messages["lore.rank"].lines(arg("rank", value))
}

items.addRequirement(plugin, "rank", RankRequirement(messages))
```

`read` throws for a wrong value, which fails your plugin's start, naming the place. `isMet` runs on the
server thread, `lines` like a part's. When the state your kind reads changes for a player, call
`items.refresh(player)`: what they wear and hold is checked again, and with the ItemViews module the
lore they see follows.

## Conventions {/* #conventions */}

- **A part of the lore ends in `Part`** (`TierPart`), **a kind of requirement in `Requirement`**
  (`RankRequirement`), each named after what it shows or asks for.
- **Add parts, name hooks and kinds of requirement as your plugin starts**, in a
  `PLUGIN_START_ONLY` function, so that the first lore rendered already has them.
- **Keep your values in the item's persistent data under your plugin's own key**
  (`NamespacedKey(plugin, "tier")`), written at `ItemCreateEvent` or by your plugin's own action, so
  that they travel with the item.

## Events {/* #events */}

| Event | When | A listener can |
|---|---|---|
| `ItemCreateEvent` | while new items of a type are made, before anyone gets them | write values of its own into the item's data |
| `ItemStatsEvent` | whenever the stats of an item are read, for what it gives and for its lore; off the server thread while the ItemViews module renders a lore | change what the item gives from its data |

## Corner cases {/* #corner-cases */}

- **A kind of requirement no plugin adds** is met by nobody; once the server started, a reload of
  `items.yml` naming it fails.
- **The stats an item requires** are read without what items give, so that no item can be worn on the
  stats it gives itself.
- **With the ItemViews module an item on the server holds no lore**, only its name: code that reads
  `lore()` of an item of a type gets nothing.
