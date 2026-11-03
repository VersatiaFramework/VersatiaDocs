# Value types

import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

What a [`@Value` property](index.md) may hold: the supported types, durations and secrets written in
their own notation, and mappers for any other type.

## Supported types {/* #supported-types */}

| Type                                             | Read as                                                         |
|--------------------------------------------------|-----------------------------------------------------------------|
| `Boolean`, `Int`, `Long`, `Float`, `Double`, `UInt`, `ULong`, `String`, `Percent`, `Duration`, `Secret` | one value, with the [strict getters](../utilities/configuration.md): `3000000000` is not an `Int`, `-1` is not a `UInt`, an unquoted `01234` is not a `String`, `12.5%` is a `Percent`, `30s` is a `Duration`, and a [`Secret`](#secrets) is text, `${env:NAME}`, `${file:PATH}` or `${pluginfile:PATH}` |
| any enum                                         | one value, matched by constant name ignoring case; `java.time.DayOfWeek` and `Material` included |
| `Color`, `Location`, `OfflinePlayer`, `Vector`, `ItemStack`, `ConfigurationSection` | one value, with Bukkit's own deserialisation |
| `List<T>`, `Set<T>`                              | a YAML list of `T`, for `T` among the scalars and enums above, every element checked like a single value; a single value where the list belongs is an error, not a list of one |
| `Map<String, T>`                                 | a YAML section whose children are `T`, for the same `T`         |

A nullable type makes the value optional: `var closedOn: DayOfWeek? = null` stays `null` when the
key is absent. Every other type, a `MutableList`, a nullable element, a data class, is rejected
at compile time with the list of what is supported, unless a [mapper](#mappers) reads it.

### Durations {/* #durations */}

A `kotlin.time.Duration` is written with its unit, in Kotlin's notation or in ISO-8601, so the file
says what it means and the code needs no conversion:

<CodeCards>
<CodeCard title="Shop.kt">

```kotlin
@Value("auto-broadcast.period")
var period = 30.seconds

@Value("cooldowns")
var cooldowns: List<Duration> = emptyList()
```

</CodeCard>
<CodeCard title="config.yml">

```yaml
auto-broadcast:
  period: 5m          # also 30s, 1h 30m, 500ms, 2d or PT5M
cooldowns: [10s, 1m]
```

</CodeCard>
</CodeCards>

A bare number is not a duration: `period: 300` fails with `Value at "auto-broadcast.period" is
not a duration such as "30s", "5m" or "1h 30m" (units d, h, m, s, ms; must not be negative): "300"`. The value goes
straight into [`every(period)` or `delay(period)`](../tasks/index.md#ticks-and-time), so a negative
duration such as `-5s` and `Infinity` are rejected the same way.

### Secrets {/* #secrets */}

A password, a token or an API key is a `Secret` (`dev.versatia.util.type`). It
prints as `****`, so a log line, a message or an exception never shows it, and the file may name
where the secret is instead of holding it:

<CodeCards>
<CodeCard title="DiscordBridge.kt">

```kotlin
import dev.versatia.util.type.Secret

@LocalBean
class DiscordBridge(private val logger: Logger) {
    @Value("discord.token")
    var token = Secret.EMPTY

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun connect() {
        logger.info("Connecting with token $token")      // Connecting with token ****
        client.login(token.reveal())                      // the secret itself, only where it is needed
    }
}
```

</CodeCard>
<CodeCard title="config.yml">

```yaml
discord:
  token: ${env:SHOP_DISCORD_TOKEN}                     # an environment variable of the server process
  # token: ${file:/run/secrets/shop_discord_token}     # or a file holding only the secret
  # token: ${pluginfile:discord-token.txt}             # or a file in the plugin's folder, plugins/Shop/discord-token.txt
  # token: 'mfa.3kX9...'                               # or the secret itself
```

</CodeCard>
<CodeCard title="Console" output>

```text
[Shop] Connecting with token ****
```

</CodeCard>
</CodeCards>

| Written                  | Becomes                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| text                     | the text, as written                                                    |
| `${env:NAME}`            | the environment variable `NAME` of the server process                   |
| `${file:PATH}`           | the content of the file, read as UTF-8 without its trailing line breaks; a relative path starts at the server folder, the one holding `server.properties`, and an absolute one (`/etc/minecraft/token.txt`, `C:/secrets/token.txt`) is taken as it is |
| `${pluginfile:PATH}`     | the same for a file in the plugin's data folder: `${pluginfile:api-key.txt}` in `plugins/Shop/config.yml` reads `plugins/Shop/api-key.txt` |
| both inside text         | each one replaced: `Bot ${env:SHOP_TOKEN}`                              |

The references are resolved at every start and reload, so a secret rotated in its file or
variable is picked up by `/versatia reload <name>`. A variable that is not set or a file that is
missing fails like any wrong value, naming the key and the reference, never the secret:

```
Plugin Shop: com.example.DiscordBridge.token could not be read from config.yml: Value at "discord.token" uses ${env:SHOP_DISCORD_TOKEN}, which is not set; set that environment variable for the server, or write the value instead
```

An empty secret, the default of a shipped file, switches its feature off by
[convention](../reference/best-practices.md#secrets): check `token.isEmpty()`. Docker and Kubernetes
hand secrets to a container as files under `/run/secrets/`, which is what `${file:PATH}` is for. `List<Secret>` and `Map<String, Secret>` read every element the same way.

:::admin

How the server admin hands over a secret, with `${env:...}`, `${file:...}` or `${pluginfile:...}`, is
explained in [Secrets](/admin/configuration-files#secrets) of the server admin guide.

:::

## Mappers {/* #mappers */}

A type of your own, or a value that is not what the file says, is read by a `ValueMapper` named
in the annotation:

<CodeCards>
<CodeCard title="Shop.kt">

```kotlin
import dev.versatia.config.SectionMapper
import dev.versatia.config.ValueMapper

object TicksFromSeconds : ValueMapper<Long> {
    override fun map(section: ConfigurationSection, key: String) = section.getLongOrThrow(key) * 20
}

data class PriceRange(val min: Int, val max: Int) {
    object Mapper : SectionMapper<PriceRange>() {
        override fun map(section: ConfigurationSection): PriceRange {
            val min = section.getIntOrThrow("min")
            return PriceRange(min, section.getIntOrThrow("max").validateAtLeast(min))
        }
    }
}

data class Ore(val name: String, val veins: Int)

object Ores : SectionMapper<List<Ore>>() {
    override fun map(section: ConfigurationSection) = section.mapChildren { name, ore -> Ore(name, ore.getIntOrThrow("veins")) }
}

@LocalBean
class Shop {
    @Value("shop.restock-seconds", mapper = TicksFromSeconds::class)
    var restockTicks = 0L

    @Value("shop.price-range", mapper = PriceRange.Mapper::class)
    var priceRange = PriceRange(0, 0)

    @Value("ores", mapper = Ores::class)
    var ores: List<Ore> = emptyList()
}
```

</CodeCard>
<CodeCard title="config.yml">

```yaml
shop:
  restock-seconds: 30
  price-range:
    min: 5
    max: 50
ores:
  iron:
    veins: 8
  gold:
    veins: 3
```

</CodeCard>
</CodeCards>

The mapper receives the section holding the key and the key, so it reads with the
[strict getters](../utilities/configuration.md), reports with their messages (the full key path
included) and validates with the [guards](../utilities/misc.md#validation); whatever it throws fails
the event like a wrong value would. It is an `object` or a class with a no-argument constructor,
and it is called only when the key is present: a missing key follows the nullability of the
property, as for any value. The compile-time step checks that what the mapper maps to fits the
property (`mapper TicksFromSeconds maps to Long, which Int cannot hold`), so a mismatch never
reaches a server. With a mapper, the property may have any type.

A value written as a section of its own, the usual shape of a data class, takes a `SectionMapper`,
as `PriceRange.Mapper` above: its `map(section)` receives that section, and a key holding
anything else fails with `Value at "shop.price-range" is not a section: "5"`.

## Corner cases {/* #corner-cases */}

- **A duration needs its unit.** `300` is an error, not 300 seconds or ticks; write `300s` or `5m`.
- **A `String` or a `Secret` is text.** An unquoted `01234`, `1.10`, `yes` or `2024-01-01` is
  something else to YAML (668, 1.1, `true`, a date), and Bukkit's `getString` would quietly return
  `"668"`. Such a value is an error asking for quotes instead: `Value at "code" is read as a number
  (668), not text; quote it, ...`; write `code: '01234'`. A secret's message never shows the value.
- **A secret's references are resolved once.** What a variable or a file holds is taken as written,
  even when it contains `${env:...}`. Any other `${...}` in a secret is an error naming the reference
  (`${DB_PASSWORD}` gets "did you mean `${env:DB_PASSWORD}`?"), so a secret that really contains `${`
  goes into a file or a variable. An unclosed `${` is plain text.
- **A secret's file is read whole.** Its content without a byte order mark and without the line
  breaks at its end is the secret, so a multi-line key keeps its inner line breaks; a file that is
  not UTF-8 is an error.
- **An empty secret prints as `''`**, so a log line tells an unset password from a set one, which
  prints as `****`.
- **A duration is finite and not negative.** `-5s`, `-Infinity` and `Infinity` are errors: the value
  is a wait or a period, so `0s` is the shortest one.
- **A single value where a list belongs** (`hours: 9` for a `List<Int>`) is an error, not a list
  of one. An absent key is never an empty list: it is a missing value, `null` for a nullable
  `List<Int>?` and an error otherwise; write `hours: []` for an empty one.
