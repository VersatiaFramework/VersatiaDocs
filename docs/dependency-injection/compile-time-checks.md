# Compile-time checks

The KSP processor validates the plugin's beans and functions and stops the build with an error
pointing at the offending declaration. When any check fails, **no descriptor is generated**, so a
broken graph can never reach a server.

## Bean graph

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

Class names in the messages are fully qualified; they are shortened here.

A dependency that **no local bean provides is not an error**. It is expected to come from a bean
exposed by another plugin; the runtime reports it if it does not
([Beans across plugins](cross-plugin.md#when-the-bean-is-missing)).

## Bean declarations

A class is rejected as a bean when it

- carries more than one scope annotation;
- is abstract, an interface, an `object`, an inner class, or generic;
- does not have exactly one constructor (`Shop must have exactly one constructor to be a bean`);
- has a constructor parameter that is nullable, generic, `vararg` or a type parameter
  (`Injected parameter config must not be nullable`).

## Prototypes and the plugin

A `@ExposePrototype` bean whose constructor takes the plugin receives the *consuming* plugin, so
the parameter must be a type every plugin has: `VersatiaPlugin` or one of its supertypes. The
owner's own main class is rejected (`Strict is a prototype, so its AlphaPlugin parameter receives
the consuming plugin; declare it as VersatiaPlugin (or a supertype), which every plugin is`).

## Auto-invoked functions

A function marked `@AutoInvoke` is rejected when it

- belongs to a class that is neither the plugin's main class, a Kotlin `object`, nor a bean
  (`start cannot be enhanced: Helper is neither the plugin's main class, an object nor a bean`);
- is an extension, `suspend`, abstract or generic function
  (`start must not be suspend to be enhanced`);
- has a parameter the bean rules above would reject, or an ambiguous one.

## Enhancement annotations

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
  not an `EventType`;
- an occurrence that leaves that property at `EventType._NULL`
  (`@AutoInvoke must set phase to a phase other than _NULL; it decides when the enhancement runs`).

Errors point at the annotation declaration when it is in the sources, otherwise at the class using
it.

## Main class

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
| a class matched by a subclass enhancement that is inner, generic or has several constructors | `Twice is enhanced by @AuditSubclasses on AlphaPlugin and must have exactly one constructor` |
| a matched class whose constructor parameters are not injectable      | the bean declaration messages above, such as `Injected parameter missing must not be nullable` |
