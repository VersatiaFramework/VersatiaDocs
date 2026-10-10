# Example plugins

import ExampleCard, {ExampleGrid} from '@site/src/components/ExampleCard';

Every example is a repository of its own in the
[VersatiaFramework](https://github.com/VersatiaFramework) organisation: one Paper 1.21.4 plugin
(two, where the feature is about two plugins) showing exactly one feature, with one file to read,
the log lines to expect and a few things to try. The catalogue with the learning path lives in
[VersatiaExamples](https://github.com/VersatiaFramework/VersatiaExamples); the cards below follow
the same order.

Each repository builds on its own with `./gradlew build` once VersatiaAPI is in your local Maven
repository, and runs on a server with VersatiaCore installed. Repositories are named
`VersatiaExample-<Topic>-<Feature>`, so they sort by topic on GitHub.

## Learning path

<ExampleGrid>
<ExampleCard repo="VersatiaExample-Resources-Extraction" file="src/main/resources/resources" fileLabel="resources/">
Files shipped under <code>resources/</code> in the JAR appear in the data folder when the plugin starts. Nothing to declare.
</ExampleCard>
<ExampleCard repo="VersatiaExample-DI-Beans" file="src/main/kotlin/com/github/marcoral/versatia/example/beans/Beans.kt">
Three local beans created in dependency order, one of them taking the plugin instance, which is a bean without any annotation.
</ExampleCard>
<ExampleCard repo="VersatiaExample-DI-Qualifiers" file="src/main/kotlin/com/github/marcoral/versatia/example/qualifiers/Greeters.kt">
Two beans provide one interface: <code>@Primary</code> picks the default, <code>@Qualifier</code> asks for the other by name.
</ExampleCard>
<ExampleCard repo="VersatiaExample-DI-CustomScope" file="src/main/kotlin/com/github/marcoral/versatia/example/customscope/Service.kt">
A scope annotation of your own, <code>@Service</code>, inheriting <code>@LocalBean</code>: one declaration, no runtime code.
</ExampleCard>
<ExampleCard repo="VersatiaExample-DI-PrivateBeans" file="src/main/kotlin/com/github/marcoral/versatia/example/privatebeans/Vault.kt">
Private beans, constructors and functions: the generated code falls back to reflection, nothing has to be widened.
</ExampleCard>
<ExampleCard repo="VersatiaExample-Lifecycle-AutoInvoke" file="src/main/kotlin/com/github/marcoral/versatia/example/autoinvoke/AutoInvokePlugin.kt">
Functions run at start, reload or stop with injected parameters: on the main class, on a bean and on an object.
</ExampleCard>
<ExampleCard repo="VersatiaExample-Events-Listeners" file="src/main/kotlin/com/github/marcoral/versatia/example/listeners/Listeners.kt">
Listeners registered automatically: a plain class with injected dependencies and a bean registered with its instance.
</ExampleCard>
<ExampleCard repo="VersatiaExample-DI-SharedBeans" file="provider/src/main/kotlin/com/github/marcoral/versatia/example/sharedbeans/SharedBeans.kt">
Two plugins: a provider exposing a singleton and a prototype, and a consumer injecting both through <code>depend:</code>.
</ExampleCard>
<ExampleCard repo="VersatiaExample-Enhancements-FeatureSwitches" file="src/main/kotlin/com/github/marcoral/versatia/example/switches/SwitchesPlugin.kt">
<code>@DisableVersatiaFeatures</code> on a base class and on the main class; the nearest declaration wins.
</ExampleCard>
<ExampleCard repo="VersatiaExample-Enhancements-Custom" file="library/src/main/kotlin/com/github/marcoral/versatia/example/timing/TimedEnhancementProcessor.kt">
An enhancement of your own: a library plugin defines <code>@Timed</code> and its processor, another plugin uses it.
</ExampleCard>
</ExampleGrid>

## Adding an example

Start from [VersatiaExample-Template](https://github.com/VersatiaFramework/VersatiaExample-Template)
("Use this template"), keep the README sections, add the example to the catalogue and put an
example card on the documentation page it illustrates.
