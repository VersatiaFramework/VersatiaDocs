# Names, qualifiers and primary beans

Most of the time one bean provides a requested type and nothing needs to be declared. When two
beans implement the same interface, two annotations decide which one is injected.

## Bean names

Every bean has a name, unique within its plugin. By default it is the simple class name with a
lower-case first letter:

| Class                    | Default name     |
|--------------------------|------------------|
| `FriendlyGreeter`        | `friendlyGreeter` |
| `Settings.MessageFormat` | `messageFormat`  |

`@Qualifier("...")` on the class replaces it.

One name is fixed: the bean backed by your main class is always called `plugin`, whatever the
class is named, and no other bean may use that name. See
[The plugin itself](index.md#the-plugin-itself).

## `@Qualifier` and `@Primary`

```kotlin
import com.github.marcoral.versatia.di.LocalBean
import com.github.marcoral.versatia.di.Primary
import com.github.marcoral.versatia.di.Qualifier

@LocalBean @Primary
class FriendlyGreeter : Greeter

@LocalBean @Qualifier("grumpy")
class UnfriendlyGreeter : Greeter

@LocalBean
class Banner(greeter: Greeter)                               // FriendlyGreeter, the @Primary

@LocalBean
class ComplaintDesk(@Qualifier("grumpy") greeter: Greeter)   // UnfriendlyGreeter, by name
```

- **`@Qualifier("name")` on a parameter** (of a constructor or of an
  [auto-invoked function](../lifecycle/auto-invoke.md)) asks for the bean with that name.
- **`@Qualifier("name")` on a class** renames the bean.
- **`@Primary` on a class** makes it the default among several beans providing a type, for
  parameters without a qualifier.

`@Primary` and `@Qualifier` on a class that is not a bean are compile errors: they would have no
effect.

## Resolution rules

For a parameter of type `T`, the same rules apply at compile time (to the plugin's own beans) and at
runtime (to beans exposed by other plugins):

1. Take the **local** beans providing `T`. With a qualifier, keep only the one with that name.
2. If that set is empty, take the **exposed** beans of plugins enabled earlier, filtered the same
   way.
3. One candidate wins. Among several, a single `@Primary` wins. Otherwise it is an error listing
   the candidates by name and class.

Two consequences worth knowing:

- The qualifier filters **before** the local-first preference. A `@Qualifier` can therefore pick an
  exposed bean on purpose, even though a local bean of the same type exists. Without a qualifier a
  local bean always wins.
- Names are **not a global registry**. Two plugins may expose beans with the same name; that only
  matters when both provide a type somebody asks for, and then it is reported like any other
  ambiguity.

## Messages

Ambiguity without a decision, at compile time:

```
Dependency com.example.Greeter of com.example.Banner is ambiguous;
candidates: "friendlyGreeter" (com.example.FriendlyGreeter), "grumpy" (com.example.UnfriendlyGreeter).
Add @Qualifier at the injection point or mark one bean @Primary
```

A qualifier naming a bean that does not provide the type:

```
Bean "grumpy" (com.example.UnfriendlyGreeter) does not provide com.example.Clock,
required by com.example.ComplaintDesk
```

A qualifier naming a bean that does not exist locally is not an error at compile time: it may name
an exposed bean of another plugin.

At runtime the same situations surface as an `EnhancementException` out of the plugin's `onEnable`,
prefixed with the plugin name and with the owning plugin added to each candidate:

```
Plugin Report: com.example.Clock named "system" required by com.example.Report is ambiguous;
candidates: "system" (com.example.SystemClock, from Shop), "system" (com.example.OtherClock, from Other).
Add @Qualifier at the injection point or mark one bean @Primary
```

:::note[No fallback to parameter names]

The parameter name is never used to pick a bean. Only an explicit `@Qualifier` or a `@Primary`
decides, so renaming a parameter can never change what gets injected.

:::
