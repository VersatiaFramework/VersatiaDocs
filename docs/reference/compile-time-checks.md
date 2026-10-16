# Compile-time checks

The KSP processor validates the plugin's beans, functions and properties and stops the build with an error
pointing at the offending declaration. When any check fails, **no descriptor is generated**, so a
broken graph can never reach a server. The errors a plugin can still meet on the server are in
[Troubleshooting](troubleshooting.md#at-start-up).

## Bean graph {/* #bean-graph */}

| Problem                                                              | Example message                                                                 |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------|
| dependency cycle                                                     | `Dependency cycle: Alpha -> Beta -> Alpha`                                      |
| several local beans provide a requested type, no `@Qualifier` or single `@Primary` | `Dependency Greeter of Banner is ambiguous; candidates: "friendlyGreeter" (FriendlyGreeter), "grumpy" (UnfriendlyGreeter). Add @Qualifier at the injection point or mark one bean @Primary` |
| several candidates marked `@Primary`                                 | `Dependency Greeter of Banner is ambiguous; several candidates are @Primary: ...` |
| two beans with the same name                                         | `Bean name "clock" is used by Clock, SystemClock; names must be unique within a plugin, rename one with @Qualifier` |
| a bean named `plugin`, the name of the main class's bean             | `Bean name "plugin" is reserved for the plugin's main class; rename Helper with @Qualifier` |
| a scope annotation on the plugin's main class                        | `MyPlugin is the plugin's main class and a local bean already; remove @LocalBean`    |
| `@Qualifier` on the plugin's main class                              | `MyPlugin is the plugin's main class and its bean is always named "plugin"; remove @Qualifier` |
| `@Qualifier` names a bean that does not provide the type             | `Bean "grumpy" (UnfriendlyGreeter) does not provide Clock, required by ComplaintDesk` |
| `@Primary` or `@Qualifier` on a class that is not a bean             | `@Primary on Helper has no effect: the class is not a bean`                      |
| a dependency whose only local provider is [conditional](../optional-plugins.md#conditional-beans), required by a bean without the same condition | `Checkout depends on VaultEconomy, which exists only with @ConditionalOnPlugin("Vault"); make Checkout conditional on the same plugins or declare a provider without the condition` |
| several providers left while some optional plugins are enabled      | `Dependency Economy of Checkout is ambiguous while "Vault" is enabled; candidates: ...` |
| a non-repeatable attribute reaching an element twice, directly and through an [annotation of your own](../dependency-injection/index.md#your-own-attribute-annotations) | `Race has @Qualifier more than once: written directly and inherited from @Fast; keep one` |

Class names in the messages are fully qualified; they are shortened here.

A dependency that **no local bean provides is not an error**. It is expected to come from a bean
exposed by another plugin; the runtime reports it if it does not
([Beans across plugins](../dependency-injection/cross-plugin.md#when-the-bean-is-missing)). A constructor parameter with a
default value may have no provider at all: it is an
[optional dependency](../dependency-injection/index.md#optional-dependencies).

## Bean declarations {/* #bean-declarations */}

A class is rejected as a bean when it

- carries more than one scope annotation;
- is abstract, an interface, an `object`, an inner class, or generic;
- has several constructors and no primary one (`Shop must have a primary constructor or exactly
  one constructor to be a bean`);
- has a constructor parameter that is nullable, generic, `vararg`, a function type or a type
  parameter (`Injected parameter config of Shop must not be nullable`); a `@Value` parameter is
  checked as a [configuration value](#configuration-values) instead.

## Prototypes and the plugin {/* #prototypes-and-the-plugin */}

A `@ExposePrototype` bean whose constructor takes the plugin receives the *consuming* plugin, so
the parameter must be a type every plugin has: `VersatiaPlugin` or one of its supertypes. The
owner's own main class is rejected (`Strict is a prototype, so its AlphaPlugin parameter receives
the consuming plugin; declare it as VersatiaPlugin (or a supertype), which every plugin is`).

## Auto-invoked functions {/* #auto-invoked-functions */}

A function marked `@AutoInvoke` is rejected when it

- belongs to a class that is neither the plugin's main class, a Kotlin `object`, nor a bean
  (`Helper.start cannot be enhanced: Helper is neither the plugin's main class, an object nor a bean`);
- is an extension, `suspend`, abstract or generic function
  (`Main.start must not be suspend to be enhanced`);
- overrides a function that is enhanced too (`Main.start overrides BasePlugin.start, which is
  enhanced too, so the override would run for both; keep the enhancement on one of them`);
- has a parameter the bean rules above would reject, or an ambiguous one.

## Configuration values {/* #configuration-values */}

A property marked [`@Value`](../configuration.md) is rejected when it

- is a `val` (`Shop.tax must be a var to be enhanced`) that holds no `PreviousValueTracking`, a
  nullable `PreviousValueTracking` (`a PreviousValueTracking must not be nullable; the runtime
  fills the cell the property holds`), an extension or abstract property;
- is a constructor parameter that is a `val` or no property at all (`Shop.tax must be a var to be
  enhanced; declare the constructor parameter as a property`), or a parameter of a function
  (`Parameter tax of Shop.open() cannot be enhanced; only properties can, constructor properties
  included`);
- is top-level (`top cannot be enhanced: it is a top-level property; move it into the plugin's
  main class, an object or a bean`) or belongs to a plain class;
- overrides a property that is enhanced too (`Main.limit overrides BasePlugin.limit, which is
  enhanced too, ...`);
- has a type the runtime cannot read (`@Value on Shop.when: Date? is not a supported type;
  supported are ...`), a nullable element (`the elements of List<Int?> must not be nullable`) or a
  map with non-`String` keys, and names no mapper;
- names a mapper that is not an `object` or a class with a no-argument constructor, or whose
  result the property cannot hold (`mapper TicksFromSeconds maps to Long, which Int cannot hold`).

## Attributes the runtime reads {/* #attributes-the-runtime-reads */}

- `@FriendlyName` anywhere but on the main class (`@FriendlyName on Config has no effect: it
  belongs on the plugin's main class`), or with a name that is not one word;
- `@ConditionalOnPlugin` on the main class (`@ConditionalOnPlugin cannot apply to MyPlugin, the
  plugin's main class`), on a class that is neither enhanced nor declares an enhanced function or
  property (`@ConditionalOnPlugin on Tools has no effect: Tools is not enhanced and declares no
  enhanced function or property`), on a function without an enhancement (`@ConditionalOnPlugin on
  Tools.plain() has no effect: the function is not enhanced`), or naming no plugin
  (`@ConditionalOnPlugin on Tools must name plugins, one word each`).

These checks apply to an attribute inherited through an
[annotation of your own](../dependency-injection/index.md#your-own-attribute-annotations) exactly as to one written
directly.

## Enhancement annotations {/* #enhancement-annotations */}

These concern authors of [custom scopes and enhancements](../internals/enhancements.md):

- a scope annotation that inherits `@Bean` but no `@VersatiaEnhancement`
  (`Service inherits @Bean but no @VersatiaEnhancement names its processor`);
- a scope annotation that runs a bean processor at a phase other than plugin start
  (`LateBean runs com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor at PLUGIN_STOP; beans can only be declared at PLUGIN_START_ONLY`);
- a `@VersatiaEnhancement` with an empty `processorClass`
  (`@VersatiaEnhancement on Service has no processorClass`);
- an attribute argument the descriptor cannot hold, such as a nested annotation
  (`Cannot record argument "meta" of @Tagged in the descriptor: values of type ... are not supported`);
- a `@VersatiaEnhancement` that sets both `enhancementPhase` and `enhancementPhaseParamRefName`,
  or neither (`... sets both enhancementPhase and enhancementPhaseParamRefName; exactly one of them
  is required`, `... declares no phase; set enhancementPhase or enhancementPhaseParamRefName`);
- `enhancementPhaseParamRefName` naming a property the annotation does not declare, or one that is
  not a `Phase`;
- an occurrence that leaves that property at `Phase.UNSET`
  (`@AutoInvoke must set phase to a phase other than UNSET; it decides when the enhancement runs`).

Errors point at the annotation declaration when it is in the sources, otherwise at the class using
it.

## Main class {/* #main-class */}

The processor locates the plugin's main class as the **single concrete subclass of `JavaPlugin`**
in the sources. When there is none or there are several, it stops with
`No class extending org.bukkit.plugin.java.JavaPlugin found in the sources, so the plugin's main class is unknown`
or `Several classes extend org.bukkit.plugin.java.JavaPlugin: ...`, each followed by a hint asking
for the explicit form:

```kotlin
ksp {
    arg("versatia.pluginYml", layout.projectDirectory.file("src/main/resources/plugin.yml").asFile.path)
}
```

With the option set, `main:` is read from that file and the sources are not searched. The named
class must still exist, in the sources or on the classpath, since the descriptor records it as a
bean; otherwise the build stops with
`Main class com.example.Missing from .../plugin.yml is neither in the sources nor on the classpath`.

Enhancements that apply to the main class (such as `@ExtractResources`) and the switches of
`@DisableVersatiaFeatures` are checked too; see
[Enhancements on a base class](../internals/enhancements.md#enhancements-on-a-base-class):

| Problem                                                              | Example message                                                                 |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------|
| a plugin enhancement or a switch on a class that is not a `JavaPlugin` subclass | `@ExtractResources on Config has no effect: it belongs on the plugin's main class or on a base class of it` |
| `@DisableVersatiaFeatures` with every switch left `false`            | `@DisableVersatiaFeatures on MyPlugin switches nothing off`                      |
| a switch for an enhancement the plugin does not have                 | `BarePlugin disables @ExtractResources, which neither BarePlugin nor its supertypes carry` |
| the same class carries and switches off an enhancement               | `MyPlugin both carries and disables @ExtractResources`                           |
| a class matched by a subclass enhancement that is inner, generic or has several constructors and no primary one | `Twice is enhanced by @AuditSubclasses on AlphaPlugin and must have a primary constructor or exactly one constructor` |
| a matched class whose constructor parameters are not injectable      | the bean declaration messages above, such as `Injected parameter missing must not be nullable` |
