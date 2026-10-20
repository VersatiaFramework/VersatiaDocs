---
description: The everyday code of a Bukkit plugin next to the same plugin written with Versatia, and what each Bukkit idiom becomes.
---

# Coming from Bukkit

You know `JavaPlugin`, `onEnable` and `getConfig()`. This page shows the code a Bukkit or Paper
plugin usually carries, in **Java**, next to the same behaviour **with Versatia**, in Kotlin. The
plugin is a small shop throughout; each scenario ends with the line count of the code shown
(non-blank lines) and what you no longer write. Imports are left out, IntelliJ adds them.

Nothing of the Paper API goes away: events, players, items, the scheduler and `plugin.yml` are the
ones you know. Versatia takes over the wiring around them. Two things change at once: the main
class extends `VersatiaPlugin`, which seals `onEnable` and `onDisable`, and `plugin.yml` lists
`VersatiaCore` under `depend:` (see [Installation](installation.md#pluginyml)).

## The main class {/* #the-main-class */}

Saving the default files, creating the services, registering listeners and commands:

```java title="Bukkit: ShopPlugin.java"
public final class ShopPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        saveDefaultConfig();
        if (!new File(getDataFolder(), "messages.yml").exists()) saveResource("messages.yml", false);

        PriceList prices = new PriceList(this);
        PluginManager plugins = getServer().getPluginManager();
        plugins.registerEvents(new JoinListener(prices), this);
        PluginCommand shop = Objects.requireNonNull(getCommand("shop"), "shop is missing from plugin.yml");
        shop.setExecutor(new ShopCommand(prices));
    }
}

public final class JoinListener implements Listener {
    private final PriceList prices;

    public JoinListener(PriceList prices) {
        this.prices = prices;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage(prices.todaysOffer());
    }
}

public final class ShopCommand implements CommandExecutor {
    private final PriceList prices;

    public ShopCommand(PriceList prices) {
        this.prices = prices;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Only players can use /shop");
            return true;
        }
        if (args.length != 1) return false;
        player.sendMessage(prices.describe(args[0]));
        return true;
    }
}
```

```kotlin title="Versatia: ShopPlugin.kt"
class ShopPlugin : VersatiaPlugin()

class JoinListener(private val prices: PriceList) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) = event.player.sendMessage(prices.todaysOffer())
}

@ConditionalOnPlugin("CommandAPI")
object ShopCommand {
    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun register(plugin: ShopPlugin, prices: PriceList) = commandAPICommand("shop", plugin) {
        stringArgument("item")
        playerExecutor { player, args -> player.sendMessage(prices.describe(args["item"] as String)) }
    }

    @AutoInvoke(Phase.PLUGIN_STOP)
    fun unregister() = CommandAPI.unregister("shop", true)
}
```

The files to save go under `src/main/resources/resources/` (`config.yml`, `messages.yml`, any
other) and are [extracted](../resources.md) into the data folder at start, never overwriting the
administrator's copy. `PriceList` is a bean, created before anything needs it
([below](#services-and-passing-the-plugin-around)).

**38 → 15 lines.** What you no longer write: `onEnable`, `saveDefaultConfig` and the
`saveResource` guards, `registerEvents` for every listener, the `getCommand` null check, the
sender cast and the argument count. A class implementing `Listener` is
[registered](../events.md) with its constructor injected; the command is the
[CommandAPI Kotlin DSL](../commands.md) in an `object`, so CommandAPI stays a soft dependency and
the arguments are typed. Bukkit's `commands:` in `plugin.yml` with `setExecutor` keeps working in
a `PLUGIN_START_ONLY` function if you would rather not use CommandAPI.

## Reading configuration {/* #reading-configuration */}

A setting needs a default, a type check and a way to be read again:

```java title="Bukkit: ShopSettings.java"
public final class ShopSettings {
    private final JavaPlugin plugin;
    private int maxOffers;
    private double tax;
    private Material currency;

    public ShopSettings(JavaPlugin plugin) {
        this.plugin = plugin;
        load();
    }

    public void load() {
        plugin.reloadConfig();
        FileConfiguration config = plugin.getConfig();
        maxOffers = config.getInt("shop.max-offers", 10);
        tax = config.getDouble("shop.tax", 0.05);
        String name = config.getString("shop.currency", "EMERALD");
        Material material = Material.matchMaterial(name);
        if (material == null) {
            plugin.getLogger().warning("Unknown material " + name + " in shop.currency, using EMERALD");
            material = Material.EMERALD;
        }
        currency = material;
    }

    public int maxOffers() { return maxOffers; }
    public double tax() { return tax; }
    public Material currency() { return currency; }
}
```

```kotlin title="Versatia: ShopSettings.kt"
@LocalBean
class ShopSettings {
    @Value("shop.max-offers")
    var maxOffers = 0

    @Value("shop.tax")
    var tax = Percent.ZERO

    @Value("shop.currency")
    lateinit var currency: Material
}
```

```yaml title="src/main/resources/resources/config.yml"
shop:
  max-offers: 10
  tax: 5%
  currency: emerald
```

**26 → 9 lines.** What you no longer write: the getters, the defaults repeated in the code, the
lookup of the enum, the warning and the fallback, the `load()` call in `onEnable` and in the reload
command. A [`@Value` property](../configuration.md) is a `var` (or a `val` holding a
[`PreviousValueTracking`](../configuration.md#reacting-to-a-change)); its initializer is only a
placeholder, the default is the shipped file. Where `getInt` silently returns the default for `ten`, a
wrong value stops the start, or a reload, with the key and the file:

```
Plugin Shop: com.example.shop.ShopSettings.tax could not be read from config.yml: Value at "shop.tax" is not a percent string such as "12.5%" (0-100): "8"
```

The values are read all-or-nothing, so a broken file at a reload leaves every value as it was.
Reload support costs nothing: `/versatia reload` sets the properties again.

## Services and passing the plugin around {/* #services-and-passing-the-plugin-around */}

The services are created in `onEnable` in the right order and reached through the plugin:

```java title="Bukkit: ShopPlugin.java"
public final class ShopPlugin extends JavaPlugin {
    private static ShopPlugin instance;
    private ShopSettings settings;
    private PriceList prices;
    private Checkout checkout;

    @Override
    public void onEnable() {
        instance = this;
        settings = new ShopSettings(this);
        prices = new PriceList(settings);
        checkout = new Checkout(this, prices, settings);
    }

    @Override
    public void onDisable() {
        instance = null;
    }

    public static ShopPlugin getInstance() { return instance; }
    public ShopSettings getSettings() { return settings; }
    public PriceList getPrices() { return prices; }
    public Checkout getCheckout() { return checkout; }
}

// anywhere else
ShopPlugin.getInstance().getCheckout().buy(player, Material.DIAMOND);
```

```kotlin title="Versatia: Shop.kt"
@LocalBean
class PriceList(private val settings: ShopSettings) {
    // ...
}

@LocalBean
class Checkout(private val plugin: ShopPlugin, private val prices: PriceList, private val settings: ShopSettings) {
    fun buy(player: Player, item: Material) { /* ... */ }
}

class SignListener(private val checkout: Checkout) : Listener {
    @EventHandler
    fun onClick(event: PlayerInteractEvent) = checkout.buy(event.player, Material.DIAMOND)
}
```

**23 → 12 lines.** What you no longer write: the static instance, the fields and getters on the
main class, the construction order, the `onDisable` clean-up. Every bean says what it needs in its
constructor; the runtime creates them in [dependency order](../dependency-injection/index.md) and
a cycle or an ambiguous dependency is a compile error. The main class is the bean `plugin`, so a
bean that needs it takes `ShopPlugin` or `JavaPlugin` as a parameter. Constructors may be private
and beans `internal`; nothing has to be made visible for the framework.

## An optional plugin: Vault {/* #an-optional-plugin-vault */}

Using Vault when it is installed, without a `NoClassDefFoundError` when it is not:

```java title="Bukkit: Payments.java"
// in onEnable: VaultPayments is the only class that refers to Vault, loaded only behind the check
Payments payments = getServer().getPluginManager().isPluginEnabled("Vault")
        ? VaultPayments.create(this)
        : new FreePayments();
checkout = new Checkout(this, prices, payments);

final class VaultPayments implements Payments {
    private final Economy economy;

    private VaultPayments(Economy economy) {
        this.economy = economy;
    }

    static Payments create(JavaPlugin plugin) {
        RegisteredServiceProvider<Economy> provider = plugin.getServer().getServicesManager().getRegistration(Economy.class);
        if (provider == null) throw new IllegalStateException("Vault is installed, but no economy plugin registered with it");
        return new VaultPayments(provider.getProvider());
    }

    @Override
    public boolean charge(Player player, int price) {
        return economy.withdrawPlayer(player, price).transactionSuccess();
    }
}
```

```kotlin title="Versatia: Payments.kt"
@LocalBean
class FreePayments : Payments {
    override fun charge(player: Player, price: Int) = true
}

@ConditionalOnPlugin("Vault")
@LocalBean @Primary
class VaultPayments : Payments {
    private val economy = VersatiaEngine.loadService<Economy>()

    override fun charge(player: Player, price: Int) = economy.withdrawPlayer(player, price.toDouble()).transactionSuccess()
}

@LocalBean
class Checkout(private val payments: Payments)   // VaultPayments with Vault, FreePayments without
```

`Payments` is the same interface on both sides, and both list Vault under `softdepend:` in `plugin.yml`.

**20 → 12 lines.** What you no longer write: the `isPluginEnabled` check, the care that no other
class mentions a Vault type, the factory method, the `ServicesManager` lookup and its null check.
A bean whose [`@ConditionalOnPlugin`](../optional-plugins.md) is unmet does not exist and its
class is never loaded, so its `@Primary` does not count and `FreePayments` is injected instead.
The build checks both cases: a bean that needs `VaultPayments` without being conditional on Vault
itself is a compile error. `VersatiaEngine.loadService<Economy>()` fails with the name of the
service when none is registered.

## A repeating task {/* #a-repeating-task */}

An announcement every few seconds, rescheduled when the interval changes:

```java title="Bukkit: Announcer.java"
public final class Announcer {
    private final JavaPlugin plugin;
    private BukkitTask task;
    private long intervalSeconds = -1;

    public Announcer(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    // called from onEnable and from the reload command
    public void schedule() {
        long seconds = plugin.getConfig().getLong("announce.interval-seconds", 300);
        if (seconds == intervalSeconds) return;
        intervalSeconds = seconds;
        if (task != null) task.cancel();
        long ticks = seconds * 20;
        task = plugin.getServer().getScheduler().runTaskTimer(plugin,
                () -> Bukkit.broadcast(Component.text("Visit the shop with /shop")), ticks, ticks);
    }
}
```

```kotlin title="Versatia: AnnouncerTask.kt"
@LocalBean
class AnnouncerTask : BackgroundTask {
    @Value("announce.interval")
    var interval = 5.minutes

    override suspend fun run() {
        every(interval) { VersatiaEngine.broadcast(text("Visit the shop with /shop")) }
    }
}
```

```yaml title="config.yml"
announce:
  interval: 5m
```

**18 → 9 lines.** What you no longer write: the task handle, the remembered previous interval, the
default in the code, the conversion to ticks, the calls from `onEnable` and from the reload
command. A [`BackgroundTask`](../tasks.md#background-tasks) runs by itself from the tick after the
start; every reload cancels it once the values are set and calls `run()` again, so the new interval
applies, and the plugin's stop cancels it. `every` counts real time and `interval` is a
[`Duration`](../configuration.md#durations), written `5m` in the file; `everyTicks` counts game
ticks. The [scheduler helpers](../utilities/misc.md#scheduler) remain for plain Bukkit tasks, with
the period first, `runTaskTimer(periodTicks, delayTicks = 0)`, the reverse of `BukkitScheduler`.

## Messages with placeholders {/* #messages-with-placeholders */}

A configurable message with the player, the item and the price in it:

```java title="Bukkit: ShopMessages.java"
public final class ShopMessages {
    private final JavaPlugin plugin;
    private YamlConfiguration messages;

    public ShopMessages(JavaPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        File file = new File(plugin.getDataFolder(), "messages.yml");
        if (!file.exists()) plugin.saveResource("messages.yml", false);
        messages = YamlConfiguration.loadConfiguration(file);
    }

    public void sendBought(Player player, ItemStack item, int price) {
        String raw = messages.getString("shop.bought", "<green><player> bought <item> for <gold><price></gold> coins.");
        player.sendMessage(MiniMessage.miniMessage().deserialize(raw,
                Placeholder.component("player", player.displayName()),
                Placeholder.component("item", item.displayName()),
                Placeholder.unparsed("price", String.valueOf(price))));
    }
}
```

```kotlin title="Versatia: Shop.kt"
@LocalBean
class Shop(private val messages: Messages) {
    fun sell(player: Player, item: ItemStack, price: Int) =
        messages["shop.bought"].send(player, arg("player", player), arg("item", item), arg("price", price))
}
```

```yaml title="src/main/resources/resources/messages/shop.yml"
shop:
  bought: "<green>{player} bought {item} for <gold>{price}</gold> coins."
```

**20 → 5 lines.** What you no longer write: loading and reloading the file, the default text in
the code, one placeholder resolver per value and a method per message. The
[Messages module](../modules/messages.md) reads every file under `messages/` and reloads with the
plugin; the text decides what to show of an argument, so an administrator changes `{player}` to
`{player.name}` or `{item.amount}` without a rebuild. Where a mistyped `<plaer>` reaches the
player as text, a mistyped `{plaer}` fails at its first use with the key, the file and what
exists:

```
Plugin Shop: message "shop.bought" in messages/shop.yml cannot be shown: No argument "plaer"; the arguments are: player, item, price
```

The plugin lists `VersatiaModule-Messages` under `depend:`; the API comes with VersatiaStarter.

## A reload command {/* #a-reload-command */}

A command that re-reads everything without a restart:

```java title="Bukkit: ShopReloadCommand.java"
public final class ShopReloadCommand implements CommandExecutor {
    private final ShopPlugin plugin;

    public ShopReloadCommand(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        try {
            plugin.getSettings().load();
            plugin.getMessages().reload();
            plugin.getAnnouncer().schedule();
            sender.sendMessage(Component.text("Shop reloaded", NamedTextColor.GREEN));
        } catch (RuntimeException e) {
            sender.sendMessage(Component.text("Reload failed: " + e.getMessage(), NamedTextColor.RED));
            plugin.getLogger().log(Level.SEVERE, "Reload failed", e);
        }
        return true;
    }
}
```

```kotlin title="Versatia: ShopPlugin.kt"
@FriendlyName("shop")
class ShopPlugin : VersatiaPlugin()
```

**19 → 2 lines**, plus the `commands:` and `permissions:` entries in `plugin.yml` that disappear.
What you no longer write: the command, its permission, the list of what to reload and keeping that
list complete. VersatiaCore's [`/versatia reload shop`](../lifecycle/reload.md), there whenever
CommandAPI is installed, extracts missing resources, sets the `@Value` properties again, reloads the messages, restarts
every background task, `AnnouncerTask` included, and runs every `PLUGIN_RELOAD_OR_START` function. A failure reaches the sender
with its cause and leaves the previous values in place. `@FriendlyName` only shortens the name;
without it the plugin reloads under its `plugin.yml` name. From code, `plugin.versatiaReload()`
does the same.

## plugin.yml, not paper-plugin.yml {/* #pluginyml-not-paper-pluginyml */}

A Versatia plugin is a Bukkit plugin described by `plugin.yml`, as in the
[installation](installation.md#pluginyml). A `paper-plugin.yml` turns the JAR into a Paper plugin,
which Paper loads with its own loader: every plugin gets an isolated class
loader, reaches another plugin's classes only through a dependency declared with
`join-classpath`, and has no `depend:`, `softdepend:` or `libraries:` keys. Paper reads
`paper-plugin.yml` in preference to `plugin.yml` when a JAR holds both. Versatia relies on what
`depend: [VersatiaCore]` gives a Bukkit plugin: the Kotlin runtime and VersatiaAPI come from
VersatiaCore, the module APIs from the module plugins, and `softdepend:` orders the plugins that
[`@ConditionalOnPlugin`](../optional-plugins.md#softdepend) checks. A Paper plugin is therefore
not a supported Versatia plugin. The `checkPluginYml` task of the
[template](https://github.com/VersatiaFramework/VersatiaExample-Template) fails the build when
`src/main/resources/paper-plugin.yml` exists, with
`Versatia plugins use plugin.yml; remove paper-plugin.yml (...)`.

```yaml title="Wrong: src/main/resources/paper-plugin.yml"
name: MyPlugin
version: '1.0.0'
main: com.example.myplugin.MyPlugin
api-version: '1.21'
# error-start
dependencies:
  server:
    VersatiaCore:
      load: BEFORE
      join-classpath: true
# error-end
```

```yaml title="Right: src/main/resources/plugin.yml"
name: MyPlugin
version: '1.0.0'
main: com.example.myplugin.MyPlugin
api-version: '1.21'
# fix-start
depend:
  - VersatiaCore
# fix-end
```

## Bukkit concept → Versatia {/* #bukkit-concept-versatia */}

| Bukkit                                                           | Versatia                                                                                         |
|------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `onEnable()`                                                     | [`@AutoInvoke(Phase.PLUGIN_START_ONLY)`](../lifecycle/auto-invoke.md), or `PLUGIN_RELOAD_OR_START` for what a reload repeats |
| `onDisable()`                                                    | `@AutoInvoke(Phase.PLUGIN_STOP)`                                                                 |
| `saveDefaultConfig()`, `saveResource(...)`                       | files under `src/main/resources/resources/`, [extracted](../resources.md) at start and reload    |
| `getConfig().getInt("key", 10)`                                  | [`@Value("key") var key = 0`](../configuration.md), the default in the shipped file              |
| a type check with a fallback                                     | the [supported types](../configuration.md#supported-types) and [mappers](../configuration.md#mappers); a wrong value is an error naming the key |
| `reloadConfig()` and a reload command                            | [`/versatia reload <name>`](../lifecycle/reload.md), `versatiaReload()`, `VersatiaEngine.reload(name)` |
| `registerEvents(new MyListener(...), this)`                      | any class implementing `Listener`, [registered](../events.md) at start                           |
| `getCommand("shop").setExecutor(...)`                            | the [CommandAPI Kotlin DSL](../commands.md) in an `object`                                       |
| a static `getInstance()`, services built in `onEnable`           | [beans](../dependency-injection/index.md) with constructor injection; the main class is the bean `plugin` |
| `isPluginEnabled("Vault")` with class-loading guards             | [`@ConditionalOnPlugin("Vault")`](../optional-plugins.md) and `softdepend:`                      |
| `getServicesManager().getRegistration(Economy.class)`            | [`VersatiaEngine.loadService<Economy>()`](../utilities/index.md#start-with-versatiaengine)        |
| a service shared with other plugins through the `ServicesManager` | [`@ExposeSingleton`, `@ExposePrototype`](../dependency-injection/cross-plugin.md)               |
| `getScheduler().runTaskTimer(plugin, task, delay, period)`       | a [`BackgroundTask`](../tasks.md#background-tasks) with `everyTicks` or `every`, restarted by every reload; [`plugin.runTaskTimer(periodTicks, delayTicks)`](../utilities/misc.md#scheduler) for a plain Bukkit task |
| `runTaskLater`, `runTaskAsynchronously` and back with `runTask`  | a coroutine of the injected [`PluginScope`](../tasks.md#your-own-coroutines): `delayTicks(20)`, `withContext(Dispatchers.IO) { }` |
| `Bukkit.broadcast(...)`, `Bukkit.getPlayerExact(name)`           | [`VersatiaEngine.broadcast(...)`, `VersatiaEngine.playerOrNull(name)`](../utilities/index.md#start-with-versatiaengine) |
| `messages.yml`, `%player%` replacements, `TagResolver`s          | the [Messages module](../modules/messages.md): `messages["key"].send(player, arg("player", player))` |
| `getLogger().info(...)`                                          | `logger.info(...)` in the main class, an [injected `Logger`](../dependency-injection/index.md#beans-every-plugin-has) in a bean |
| `paper-plugin.yml`                                               | not supported; [`plugin.yml`](installation.md#pluginyml) with `depend: [VersatiaCore]`           |

Next: [Your first plugin](first-plugin.md) builds a plugin step by step, and the
[example plugins](../examples/index.md) show one feature each.
