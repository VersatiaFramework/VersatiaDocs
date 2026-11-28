---
title: ItemViews module
counterpart: /admin/experimental/item-views
description: How a plugin shows its items differently to each player, with the window they look at, through the ItemViews module, while the items on the server stay as they are.
---

# ItemViews module

The ItemViews module shows items to each player apart. Your plugin registers a view for its items,
and the module renders their name and lore for every player in the packets that player receives:
a requirement in red for a player who misses it, a price in a shop's window, the owner of a ticket.
The items on the server never change, so a player who drops, trades or stores an item hands over
the item, not what they saw of it.

:::admin

Installing the module, and what players notice of it, is on the
[ItemViews module](/admin/experimental/item-views) page of the server admin guide.

:::

## Using the module {/* #using-the-module */}

The module's API is `dev.versatia:VersatiaModule-ItemViews`; the module is experimental, so
VersatiaStarter does not export it:

```kotlin title="build.gradle.kts"
dependencies {
    compileOnly("dev.versatia:VersatiaAPI:0.0.1")
    compileOnly("dev.versatia:VersatiaModule-ItemViews:0.0.1")
    ksp("dev.versatia:VersatiaAPI-ksp:0.0.1")
}
```

```yaml title="plugin.yml"
depend:
  - VersatiaCore
  - VersatiaModule-ItemViews
```

A plugin that works without the module lists it under `softdepend:` instead and puts
[`@ConditionalOnPlugin("VersatiaModule-ItemViews")`](/docs/optional-plugins)
on every class that names its API. Each plugin gets its own `ItemViews` (package
`dev.versatia.itemviews`), and what it registered and attached goes when it stops.

## A view of your items {/* #a-view-of-your-items */}

A view renders every item whose persistent data holds the key it is registered for. Register it as
your plugin starts:

```kotlin
@LocalBean
class TicketView(private val views: ItemViews, private val messages: Messages, plugin: Plugin) : ItemView {
    private val owner = NamespacedKey(plugin, "ticket-owner")

    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun register() = views.register(owner, this)

    override fun look(item: ItemStack, viewer: Player, context: Any?): ItemLook? {
        val name = item.persistentDataContainer.get(owner, PersistentDataType.STRING) ?: return null
        val line = if (name == viewer.name) "ticket.yours" else "ticket.of"
        return ItemLook(lore = messages[line].lines(arg("owner", name)))
    }
}
```

An `ItemLook` replaces the item's `name`, its `lore`, or both; null for either keeps the item's
own, and a null look shows the item as it is. A view goes into the player's inventory, their cursor,
the windows they open and the results of merchants' trades. Implementations of `ItemView` are named
after the items they show and end in `View`.

## What a view may read {/* #what-a-view-may-read */}

`look` runs on the thread of the player's connection, whenever the module has no look of the item
for that player yet. It reads the item, the context and what your plugin worked out on the server
thread; [`Messages` and `Text`](/docs/messages#corner-cases) are safe there. The state of the server
is not, and neither is anything slow:

```kotlin title="Wrong"
override fun look(item: ItemStack, viewer: Player, context: Any?): ItemLook {
    // error-next-line
    val vip = viewer.hasPermission("shop.vip")
    return ItemLook(lore = messages[if (vip) "price.vip" else "price.normal"].lines())
}
```

```kotlin title="Right"
private val vips = ConcurrentHashMap.newKeySet<UUID>()

@EventHandler
fun onJoin(event: PlayerJoinEvent) {
    // fix-next-line
    if (event.player.hasPermission("shop.vip")) vips += event.player.uniqueId
    views.refresh(event.player)
}

override fun look(item: ItemStack, viewer: Player, context: Any?): ItemLook {
    val vip = viewer.uniqueId in vips
    return ItemLook(lore = messages[if (vip) "price.vip" else "price.normal"].lines())
}
```

The module keeps every look it got for a player, so a look depends only on the item (never on its
amount), the context and what your plugin keeps of the viewer. When that changes, call
`views.refresh(player)` on the server thread: the module forgets that player's looks and sends what
they see again.

## The window an item is seen in {/* #the-window-an-item-is-seen-in */}

A plugin that opens a window of its own attaches a context to it, any object, and every view gets it
as `context` while a player has the window open: the items of the window and of the player's own
inventory below it.

```kotlin
class SellWindow(val shop: Shop)

fun open(player: Player, shop: Shop) {
    val inventory = Bukkit.createInventory(null, 27, messages["sell.title"].get())
    views.attach(inventory, SellWindow(shop))
    player.openInventory(inventory)
}

override fun look(item: ItemStack, viewer: Player, context: Any?): ItemLook? {
    val window = context as? SellWindow ?: return null
    return ItemLook(lore = messages["sell.price"].lines(arg("price", window.shop.priceOf(item))))
}
```

When the window closes, the player's inventory is sent again without the context. Attaching to an
inventory a player already has open renders it again at once.

## Conventions {/* #conventions */}

- **A view is named after the items it shows and ends in `View`**: `TicketView`, `ItemsView`.
- **Register views as your plugin starts**, in a `PLUGIN_START_ONLY` function, so that every item is
  shown through them from the first player on.
- **A window's context is named after the window**: `SellWindow`, `UpgradeWindow`, a class of your
  own holding what its views need.
- **What a view reads of a player is worked out on the server thread**, kept in a concurrent map, and
  followed by `views.refresh(player)` when it changes; see
  [What a view may read](#what-a-view-may-read).

## Corner cases {/* #corner-cases */}

- **A creative player** sends back the item they were shown; the module puts the item's own name
  and lore back before the server takes it, so a look never lands in an item.
- **The items on the server carry no look.** Code that reads an item's lore on the server reads the
  item's own; a hover over an item in chat, an item frame and an item on the ground show it too.
- **A merchant's trades** show their results through the views; their costs stay as they are, since
  the client matches them against the items it holds.
- **One key has one view.** Registering a key another plugin registered fails, naming it; your own
  key registered again replaces your view.
- **A view that throws** is logged once, and the item shows as it is wherever it throws.
- **After a click** in a window the server sends the clicked slots once more, because the client's
  items differ from the server's; they are rendered from the looks the module keeps.
